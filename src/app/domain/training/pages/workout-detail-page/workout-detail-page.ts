import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatIcon } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  catchError,
  finalize,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';

import { TrainingApiService } from '../../api/training-api.service';
import type { LogExerciseSetRequest } from '../../training.models';
import {
  extractWorkoutExercises,
  extractWorkoutHeader,
  type MonthWorkoutSummary,
  type UserTrainingMonthItem,
  type WorkoutDetailResponse,
  type WorkoutExerciseEntry,
} from '../../training.models';

const MAX_SETS_PER_EXERCISE = 20;

interface SetDraft {
  draftId: string;
  set_number: number;
  weight_used: number | null;
  reps_completed: number | null;
  saving: boolean;
  saved: boolean;
  error: string | null;
}

interface ExerciseRow {
  entry: WorkoutExerciseEntry;
  drafts: SetDraft[];
}

interface WorkoutHeader {
  title: string;
  description?: string;
  day_number?: number;
  day_name?: string;
}

interface SetLogItem {
  row: ExerciseRow;
  draft: SetDraft;
  body: LogExerciseSetRequest;
}

@Component({
  selector: 'ra-workout-detail-page',
  imports: [FormsModule, RouterLink, MatIcon],
  templateUrl: './workout-detail-page.html',
  styleUrl: './workout-detail-page.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkoutDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly trainingApi = inject(TrainingApiService);
  private readonly sanitizer = inject(DomSanitizer);

  /** Cache `url -> SafeResourceUrl` para nao re-sanitizar a cada CD. */
  private readonly safeUrlCache = new Map<string, SafeResourceUrl>();

  readonly monthId = signal<string>('');
  readonly workoutId = signal<string>('');
  /** Mes de treino (1..n) via GET /me/training/months. */
  readonly monthNumber = signal<number | null>(null);

  readonly header = signal<WorkoutHeader | null>(null);
  /** Titulo da barra: "Mês 1 (Segunda-feira)". */
  readonly workoutTopBarTitle = computed(() => {
    const h = this.header();
    const mn = this.monthNumber();
    const num = mn ?? '?';
    const raw = h?.day_name?.trim();
    const day =
      raw && raw.length > 0
        ? raw.charAt(0).toUpperCase() + raw.slice(1)
        : this.weekdayFromDayNumber(h?.day_number);
    return day ? `Mês ${num} (${day})` : `Mês ${num}`;
  });

  readonly exercises = signal<ExerciseRow[]>([]);

  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly weekNumber = signal<number>(1);
  readonly completionNotes = signal<string>('');
  readonly isCompleting = signal(false);
  readonly completeError = signal<string | null>(null);

  readonly completionId = signal<string | null>(null);
  /** True apos `complete` + envio de todas as series pendentes com sucesso. */
  readonly sessionSynced = signal(false);

  ngOnInit(): void {
    const monthId = this.route.snapshot.paramMap.get('monthId');
    const workoutId = this.route.snapshot.paramMap.get('workoutId');
    if (!workoutId) {
      this.loadError.set('Treino invalido.');
      this.isLoading.set(false);
      return;
    }
    if (monthId) {
      this.monthId.set(monthId);
    }
    this.workoutId.set(workoutId);
    this.load(workoutId, monthId);
  }

  private load(workoutId: string, monthId: string | null): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.trainingApi
      .getWorkout(workoutId)
      .pipe(
        catchError((err: HttpErrorResponse) => {
          this.loadError.set(this.parseErrorMessage(err, 'treino'));
          return of<WorkoutDetailResponse | null>(null);
        }),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe((res) => {
        if (!res) {
          this.exercises.set([]);
          return;
        }
        this.applyResponse(res);
      });

    if (monthId) {
      this.loadMonthNumber(monthId);
      this.loadHeaderFromMonth(monthId, workoutId);
    }
  }

  private loadMonthNumber(monthId: string): void {
    this.trainingApi
      .listMonths()
      .pipe(catchError(() => of<UserTrainingMonthItem[]>([])))
      .subscribe((rows) => {
        const match = rows.find((r) => String(r.month_id) === monthId);
        if (
          match &&
          typeof match.month_number === 'number' &&
          Number.isFinite(match.month_number)
        ) {
          this.monthNumber.set(match.month_number);
        }
      });
  }

  private applyResponse(res: WorkoutDetailResponse): void {
    const headerFromBody = extractWorkoutHeader(res);
    if (headerFromBody.title || headerFromBody.day_number) {
      this.header.set({
        title: headerFromBody.title ?? '',
        description: headerFromBody.description,
        day_number: headerFromBody.day_number,
        day_name: headerFromBody.day_name,
      });
    }

    const entries = extractWorkoutExercises(res);
    const sorted = [...entries].sort(
      (a, b) => (a.order_position ?? 0) - (b.order_position ?? 0),
    );
    this.exercises.set(
      sorted.map((entry) => ({
        entry,
        drafts: this.buildDrafts(entry.sets),
      })),
    );
  }

  private loadHeaderFromMonth(monthId: string, workoutId: string): void {
    this.trainingApi
      .listMonthWorkouts(monthId)
      .pipe(catchError(() => of<MonthWorkoutSummary[]>([])))
      .subscribe((rows) => {
        const match = rows.find((r) => r.workout_id === workoutId);
        if (!match) {
          return;
        }
        const current = this.header();
        this.header.set({
          title: match.title || current?.title || '',
          description: current?.description,
          day_number: match.day_number ?? current?.day_number,
          day_name: match.day_name || current?.day_name,
        });
      });
  }

  private newDraft(setNumber: number): SetDraft {
    return {
      draftId: crypto.randomUUID(),
      set_number: setNumber,
      weight_used: null,
      reps_completed: null,
      saving: false,
      saved: false,
      error: null,
    };
  }

  private buildDrafts(setsCount: number | undefined): SetDraft[] {
    const raw =
      typeof setsCount === 'number' && Number.isFinite(setsCount) && setsCount > 0
        ? Math.floor(setsCount)
        : 3;
    const total = Math.min(Math.max(raw, 1), MAX_SETS_PER_EXERCISE);
    const out: SetDraft[] = [];
    for (let i = 1; i <= total; i += 1) {
      out.push(this.newDraft(i));
    }
    return out;
  }

  changeWeekNumber(n: number): void {
    if (n < 1 || n > 4) return;
    if (this.sessionSynced()) return;
    this.weekNumber.set(n);
  }

  setNotes(value: string): void {
    if (this.sessionSynced()) return;
    this.completionNotes.set(value);
  }

  addSet(row: ExerciseRow): void {
    if (this.isCompleting()) return;
    this.exercises.set(
      this.exercises().map((r) => {
        if (r.entry.workout_exercise_id !== row.entry.workout_exercise_id) {
          return r;
        }
        if (r.drafts.length >= MAX_SETS_PER_EXERCISE) {
          return r;
        }
        const nextNum = r.drafts.reduce((m, d) => Math.max(m, d.set_number), 0) + 1;
        return {
          ...r,
          drafts: [...r.drafts, this.newDraft(nextNum)],
        };
      }),
    );
  }

  canAddSet(row: ExerciseRow): boolean {
    return !this.isCompleting() && row.drafts.length < MAX_SETS_PER_EXERCISE;
  }

  hasSetPayload(draft: SetDraft): boolean {
    if (draft.weight_used !== null && draft.weight_used !== undefined) {
      return true;
    }
    if (draft.reps_completed !== null && draft.reps_completed !== undefined) {
      return true;
    }
    return false;
  }

  /** Salvar uma serie na API (apos existir `completion_id`: extras ou retentativa). */
  logSet(row: ExerciseRow, draft: SetDraft): void {
    const completionId = this.completionId();
    if (!completionId || draft.saving || draft.saved || !this.hasSetPayload(draft)) {
      return;
    }
    draft.saving = true;
    draft.error = null;
    this.exercises.set([...this.exercises()]);

    this.trainingApi
      .logExerciseSet(completionId, this.buildLogBody(row, draft))
      .pipe(
        catchError((err: HttpErrorResponse) => {
          draft.error = this.parseErrorMessage(err, 'serie');
          return of(null);
        }),
        finalize(() => {
          draft.saving = false;
          this.exercises.set([...this.exercises()]);
        }),
      )
      .subscribe((res) => {
        if (!res) {
          return;
        }
        draft.saved = true;
      });
  }

  /** Conclui o treino na API e envia as series em lote (ou so o lote, se ja houver `completion_id` apos falha anterior). */
  finishWorkoutAndSync(): void {
    if (this.isCompleting() || this.sessionSynced()) {
      return;
    }
    this.completeError.set(null);
    this.isCompleting.set(true);

    const items = this.collectPendingSetItems();
    const existingCid = this.completionId();

    if (existingCid && items.length > 0) {
      this.runSetsBatchOnly(existingCid, items);
      return;
    }

    if (existingCid && items.length === 0) {
      this.sessionSynced.set(true);
      this.isCompleting.set(false);
      return;
    }

    const notes = this.completionNotes().trim();

    this.trainingApi
      .completeWorkout(this.workoutId(), {
        week_number: this.weekNumber(),
        ...(notes ? { notes } : {}),
      })
      .pipe(
        catchError((err: HttpErrorResponse) => {
          this.completeError.set(this.parseErrorMessage(err, 'conclusao'));
          return of(null);
        }),
        switchMap((res) => {
          if (!res?.completion_id) {
            return of(false as const);
          }
          this.completionId.set(res.completion_id);
          if (items.length === 0) {
            return of(true as const);
          }
          return this.logSetsBatch$(res.completion_id, items);
        }),
        finalize(() => this.isCompleting.set(false)),
      )
      .subscribe({
        next: (ok) => {
          if (ok === true) {
            this.sessionSynced.set(true);
          }
        },
        error: () => {
          this.completeError.set(
            'Não foi possível concluir o treino. Verifique os dados e tente de novo.',
          );
        },
      });
  }

  /** Retentativa apos `complete` ok e lote com erro: envia apenas `POST .../sets/batch`. */
  private runSetsBatchOnly(completionId: string, items: SetLogItem[]): void {
    this.logSetsBatch$(completionId, items)
      .pipe(finalize(() => this.isCompleting.set(false)))
      .subscribe({
        next: (ok) => {
          if (ok === true) {
            this.sessionSynced.set(true);
          }
        },
      });
  }

  private logSetsBatch$(completionId: string, items: SetLogItem[]) {
    const sets = items.map((item) => item.body);
    return this.trainingApi.logExerciseSetsBatch(completionId, { sets }).pipe(
      tap(() => {
        for (const item of items) {
          item.draft.saved = true;
          item.draft.error = null;
        }
        this.exercises.set([...this.exercises()]);
      }),
      map(() => true as const),
      catchError((err: HttpErrorResponse) => {
        this.completeError.set(this.parseErrorMessage(err, 'series'));
        return of(false as const);
      }),
    );
  }

  private collectPendingSetItems(): SetLogItem[] {
    const out: SetLogItem[] = [];
    const rows = [...this.exercises()].sort(
      (a, b) => (a.entry.order_position ?? 0) - (b.entry.order_position ?? 0),
    );
    for (const row of rows) {
      const drafts = [...row.drafts].sort((a, b) => a.set_number - b.set_number);
      for (const draft of drafts) {
        if (!draft.saved && this.hasSetPayload(draft)) {
          out.push({ row, draft, body: this.buildLogBody(row, draft) });
        }
      }
    }
    return out;
  }

  private buildLogBody(
    row: ExerciseRow,
    draft: SetDraft,
  ): LogExerciseSetRequest {
    return {
      workout_exercise_id: row.entry.workout_exercise_id,
      set_number: draft.set_number,
      ...(draft.weight_used !== null && draft.weight_used !== undefined
        ? { weight_used: Number(draft.weight_used) }
        : {}),
      ...(draft.reps_completed !== null && draft.reps_completed !== undefined
        ? { reps_completed: Number(draft.reps_completed) }
        : {}),
    };
  }

  showSaveOneSetButton(draft: SetDraft): boolean {
    return Boolean(this.completionId()) && !draft.saved && !this.isCompleting();
  }

  inputsLocked(draft: SetDraft): boolean {
    return draft.saved || this.isCompleting();
  }

  goBackToMonth(): void {
    const monthId = this.monthId();
    if (monthId) {
      void this.router.navigate(['/treinos', 'mes', monthId]);
      return;
    }
    void this.router.navigate(['/treinos']);
  }

  retry(): void {
    if (this.workoutId()) {
      this.load(this.workoutId(), this.monthId() || null);
    }
  }

  safeEmbedUrl(url: string | undefined | null): SafeResourceUrl | null {
    if (!url || typeof url !== 'string') {
      return null;
    }
    const cached = this.safeUrlCache.get(url);
    if (cached) {
      return cached;
    }
    const safe = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    this.safeUrlCache.set(url, safe);
    return safe;
  }

  private weekdayFromDayNumber(d: number | undefined): string {
    if (typeof d !== 'number' || !Number.isFinite(d) || d < 1 || d > 7) {
      return '';
    }
    const names = [
      '',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
      'Domingo',
    ];
    return names[d] ?? '';
  }

  private parseErrorMessage(err: HttpErrorResponse, target: string): string {
    const body = err.error as
      | { detail?: string; title?: string; error?: string; message?: string }
      | string
      | null
      | undefined;
    if (typeof body === 'string' && body.trim()) {
      return body;
    }
    if (body && typeof body === 'object') {
      return (
        body.detail ||
        body.title ||
        body.error ||
        body.message ||
        `Falha ao processar ${target} (HTTP ${err.status}).`
      );
    }
    return `Falha ao processar ${target} (HTTP ${err.status}).`;
  }
}

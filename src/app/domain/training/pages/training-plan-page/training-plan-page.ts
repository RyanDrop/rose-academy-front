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
import { MatIcon } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import {
  TrainingPlansApiService,
  type TrainingPlanView,
} from '../../../home/api/training-plans-api.service';
import { TrainingApiService } from '../../api/training-api.service';
import {
  normalizeLevel,
  type TrainingLevel,
  type UserActivePlanResponse,
  type UserTrainingMonthItem,
} from '../../training.models';

interface MonthRow {
  month_id: string;
  month_number: number;
  title: string;
  description: string;
  is_started: boolean;
  is_completed: boolean;
  /** Liberado no catalogo GET /training-plans (`active`). */
  active: boolean;
}

@Component({
  selector: 'ra-training-plan-page',
  imports: [RouterLink, MatIcon],
  templateUrl: './training-plan-page.html',
  styleUrl: './training-plan-page.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingPlanPage implements OnInit {
  private readonly trainingApi = inject(TrainingApiService);
  private readonly trainingPlansApi = inject(TrainingPlansApiService);
  private readonly router = inject(Router);

  readonly plan = signal<UserActivePlanResponse | null>(null);
  readonly months = signal<MonthRow[]>([]);
  readonly availablePlans = signal<TrainingPlanView[]>([]);

  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly isSelectingLevel = signal<TrainingLevel | null>(null);
  readonly selectError = signal<string | null>(null);

  readonly startingMonth = signal<number | null>(null);
  readonly startError = signal<string | null>(null);

  readonly hasPlan = computed(() => this.plan() !== null);

  ngOnInit(): void {
    this.loadAll();
  }

  private loadAll(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    forkJoin({
      active: this.trainingApi.getActivePlan().pipe(
        catchError((err: HttpErrorResponse) => {
          if (err.status === 404) {
            return of<UserActivePlanResponse | null>(null);
          }
          this.loadError.set('Não foi possível carregar seu plano agora.');
          return of<UserActivePlanResponse | null>(null);
        }),
      ),
      catalog: this.trainingPlansApi
        .listTrainingPlans()
        .pipe(catchError(() => of<TrainingPlanView[]>([]))),
    }).subscribe(({ active, catalog }) => {
      this.plan.set(active);
      this.availablePlans.set(catalog);
      if (!active) {
        this.months.set([]);
        this.isLoading.set(false);
        return;
      }
      this.trainingApi
        .listMonths()
        .pipe(
          catchError((err: HttpErrorResponse) => {
            if (err.status !== 404) {
              this.loadError.set(
                'Não foi possível carregar os meses do seu plano.',
              );
            }
            return of<UserTrainingMonthItem[]>([]);
          }),
          finalize(() => this.isLoading.set(false)),
        )
        .subscribe((rows) => {
          this.months.set(this.toRows(rows, catalog, active.plan_id));
        });
    });
  }

  private toRows(
    items: UserTrainingMonthItem[],
    catalog: TrainingPlanView[],
    activePlanId: string,
  ): MonthRow[] {
    const catPlan = catalog.find((p) => p.id === activePlanId);
    return [...items]
      .map((m) => {
        const catMonth = catPlan?.months.find(
          (c) => c.month_number === m.month_number,
        );
        const active = catMonth?.active === true;
        return {
          month_id: String(m.month_id ?? ''),
          month_number: Number.isFinite(m.month_number) ? m.month_number : 0,
          title: typeof m.title === 'string' ? m.title : '',
          description:
            typeof m.description === 'string' ? m.description : '',
          is_started: Boolean(m.is_started),
          is_completed: Boolean(m.is_completed),
          active,
        };
      })
      .sort((a, b) => a.month_number - b.month_number);
  }

  selectLevel(level: TrainingLevel): void {
    if (this.isSelectingLevel()) {
      return;
    }
    this.selectError.set(null);
    this.isSelectingLevel.set(level);
    this.trainingApi
      .selectTrainingPlan({ level })
      .pipe(
        catchError((err: HttpErrorResponse) => {
          this.selectError.set(this.parseErrorMessage(err, 'plano'));
          return of(null);
        }),
        finalize(() => this.isSelectingLevel.set(null)),
      )
      .subscribe((res) => {
        if (!res) {
          return;
        }
        this.loadAll();
      });
  }

  startMonth(month: MonthRow): void {
    if (!month.active) {
      return;
    }
    if (this.startingMonth() !== null) {
      return;
    }
    this.startError.set(null);
    this.startingMonth.set(month.month_number);
    this.trainingApi
      .startMonth(month.month_number)
      .pipe(
        catchError((err: HttpErrorResponse) => {
          this.startError.set(this.parseErrorMessage(err, 'mes'));
          return of(null);
        }),
        finalize(() => this.startingMonth.set(null)),
      )
      .subscribe((res) => {
        if (!res) {
          return;
        }
        void this.router.navigate(['/treinos', 'mes', month.month_id]);
      });
  }

  goToMonth(month: MonthRow): void {
    void this.router.navigate(['/treinos', 'mes', month.month_id]);
  }

  retry(): void {
    this.loadAll();
  }

  isCurrentLevel(level: string): boolean {
    const current = this.plan()?.level;
    if (!current) {
      return false;
    }
    return normalizeLevel(current) === normalizeLevel(level);
  }

  niceLevel(level: string): string {
    const n = normalizeLevel(level);
    if (n === 'iniciante') return 'Iniciante';
    if (n === 'intermediario') return 'Intermediário';
    if (n === 'avancado') return 'Avançado';
    return level;
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

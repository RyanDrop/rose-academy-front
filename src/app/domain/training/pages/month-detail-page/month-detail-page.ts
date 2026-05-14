import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LineChartModule } from '@swimlane/ngx-charts';
import { catchError, finalize, of } from 'rxjs';

import { TrainingApiService } from '../../api/training-api.service';
import type {
  MonthStatisticsRow,
  MonthWorkoutSummary,
  MonthlyProgressionSummaryRow,
  WeeklyBestPerformanceRow,
  UserTrainingMonthItem,
  WeightProgressionRow,
} from '../../training.models';
import { buildWeightExerciseChartBlocks } from './weight-chart.helpers';

@Component({
  selector: 'ra-month-detail-page',
  imports: [DatePipe, DecimalPipe, RouterLink, LineChartModule, MatIcon],
  templateUrl: './month-detail-page.html',
  styleUrl: './month-detail-page.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthDetailPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly trainingApi = inject(TrainingApiService);

  private readonly onResize = (): void => this.updateChartView();

  readonly monthId = signal<string>('');
  /** Numero do mes de treino (1..n) a partir de GET /me/training/months. */
  readonly monthDisplayNumber = signal<number | null>(null);

  readonly workouts = signal<MonthWorkoutSummary[]>([]);
  readonly stats = signal<MonthStatisticsRow | null>(null);
  readonly weight = signal<WeightProgressionRow[]>([]);
  readonly weekly = signal<WeeklyBestPerformanceRow[]>([]);
  readonly progression = signal<MonthlyProgressionSummaryRow[]>([]);

  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly isLoadingReports = signal(false);
  readonly reportsTab = signal<'stats' | 'weight' | 'weekly' | 'progression'>(
    'stats',
  );

  readonly isResetting = signal(false);
  readonly resetError = signal<string | null>(null);
  readonly resetSuccess = signal(false);

  readonly chartView = signal<[number, number]>([720, 300]);

  readonly weightChartBlocks = computed(() =>
    buildWeightExerciseChartBlocks(this.weight()),
  );

  readonly weightChartHasData = computed(() =>
    this.weightChartBlocks().some((b) =>
      b.results.some((s) => s.series.length > 0),
    ),
  );

  readonly chartColorScheme = {
    name: 'rose-academy',
    selectable: true,
    group: 'ordinal',
    domain: [
      '#582933',
      '#803a47',
      '#1f9d69',
      '#7a3846',
      '#cb3a31',
      '#ffd166',
      '#6f6b68',
    ],
  };

  readonly hasAnyReport = computed(
    () =>
      this.stats() !== null ||
      this.weight().length > 0 ||
      this.weekly().length > 0 ||
      this.progression().length > 0,
  );

  readonly monthDetailTopTitle = computed(() => {
    const n = this.monthDisplayNumber();
    return n !== null ? `Detalhe do mês ${n}` : 'Detalhe do mês';
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('monthId');
    if (!id) {
      this.loadError.set('Mês inválido.');
      this.isLoading.set(false);
      return;
    }
    this.monthId.set(id);
    this.loadMonthNumber(id);
    this.loadAll(id);

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onResize);
      this.updateChartView();
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onResize);
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
          this.monthDisplayNumber.set(match.month_number);
        }
      });
  }

  private updateChartView(): void {
    if (typeof window === 'undefined') {
      return;
    }
    const w = Math.max(280, Math.min(window.innerWidth - 48, 960));
    this.chartView.set([w, 300]);
  }

  private loadAll(monthId: string): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.trainingApi
      .listMonthWorkouts(monthId)
      .pipe(
        catchError((err: HttpErrorResponse) => {
          this.loadError.set(this.parseErrorMessage(err, 'mes'));
          return of<MonthWorkoutSummary[]>([]);
        }),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe((rows) => {
        const sorted = [...rows].sort((a, b) => a.day_number - b.day_number);
        this.workouts.set(sorted);
      });

    this.loadReports(monthId);
  }

  private loadReports(monthId: string): void {
    this.isLoadingReports.set(true);
    let pending = 4;
    const done = () => {
      pending -= 1;
      if (pending <= 0) {
        this.isLoadingReports.set(false);
      }
    };

    this.trainingApi
      .getMonthStatistics(monthId)
      .pipe(catchError(() => of<MonthStatisticsRow | null>(null)))
      .subscribe((row) => {
        this.stats.set(row);
        done();
      });

    this.trainingApi
      .getWeightProgression(monthId)
      .pipe(catchError(() => of<WeightProgressionRow[]>([])))
      .subscribe((rows) => {
        this.weight.set(rows);
        done();
      });

    this.trainingApi
      .getWeeklyPerformance(monthId)
      .pipe(catchError(() => of<WeeklyBestPerformanceRow[]>([])))
      .subscribe((rows) => {
        this.weekly.set(rows);
        done();
      });

    this.trainingApi
      .getProgressionSummary(monthId)
      .pipe(catchError(() => of<MonthlyProgressionSummaryRow[]>([])))
      .subscribe((rows) => {
        this.progression.set(rows);
        done();
      });
  }

  switchTab(tab: 'stats' | 'weight' | 'weekly' | 'progression'): void {
    this.reportsTab.set(tab);
    if (tab === 'weight') {
      queueMicrotask(() => this.updateChartView());
    }
  }

  goToWorkout(w: MonthWorkoutSummary): void {
    void this.router.navigate([
      '/treinos',
      'mes',
      this.monthId(),
      'treino',
      w.workout_id,
    ]);
  }

  resetProgress(): void {
    if (this.isResetting()) {
      return;
    }
    if (
      !confirm(
        'Tem certeza de que quer apagar conclusões e séries deste mês? Essa ação não pode ser desfeita.',
      )
    ) {
      return;
    }
    this.resetError.set(null);
    this.resetSuccess.set(false);
    this.isResetting.set(true);
    this.trainingApi
      .resetMonthProgress(this.monthId())
      .pipe(
        catchError((err: HttpErrorResponse) => {
          this.resetError.set(this.parseErrorMessage(err, 'reset'));
          return of(null);
        }),
        finalize(() => this.isResetting.set(false)),
      )
      .subscribe((res) => {
        if (!res) {
          return;
        }
        this.resetSuccess.set(true);
        this.loadAll(this.monthId());
      });
  }

  retry(): void {
    if (this.monthId()) {
      this.loadAll(this.monthId());
    }
  }

  completionPercentageDisplay(): number {
    const s = this.stats();
    if (!s) {
      return 0;
    }
    if (
      typeof s.completion_percentage === 'number' &&
      Number.isFinite(s.completion_percentage)
    ) {
      return Math.round(s.completion_percentage);
    }
    const r = s.completion_rate;
    if (typeof r !== 'number' || !Number.isFinite(r)) {
      return 0;
    }
    return r > 1 ? Math.round(r) : Math.round(r * 100);
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
        `Falha ao carregar ${target} (HTTP ${err.status}).`
      );
    }
    return `Falha ao carregar ${target} (HTTP ${err.status}).`;
  }
}

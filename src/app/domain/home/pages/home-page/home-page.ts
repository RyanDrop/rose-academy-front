import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  catchError,
  EMPTY,
  finalize,
  map,
  of,
  switchMap,
} from 'rxjs';

import {
  AuthApiService,
  type ApiUser,
} from '../../../auth/api/auth-api.service';
import { AuthTokenStorageService } from '../../../auth/services/auth-token-storage.service';
import { TrainingApiService } from '../../../training/api/training-api.service';
import {
  normalizeLevel,
  type TrainingLevel,
  type UserActivePlanResponse,
  type UserTrainingMonthItem,
} from '../../../training/training.models';
import {
  TrainingPlansApiService,
  type ApiTrainingMonth,
  type TrainingPlanView,
} from '../../api/training-plans-api.service';

@Component({
  selector: 'ra-home-page',
  imports: [RouterLink],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage implements OnInit {
  private readonly authApi = inject(AuthApiService);
  private readonly authTokenStorage = inject(AuthTokenStorageService);
  private readonly trainingPlansApi = inject(TrainingPlansApiService);
  private readonly trainingApi = inject(TrainingApiService);
  private readonly router = inject(Router);

  readonly user = signal<ApiUser | null>(null);
  readonly loadError = signal(false);
  readonly isLoadingUser = signal(true);

  readonly trainingPlans = signal<TrainingPlanView[]>([]);
  readonly trainingPlansLoading = signal(false);
  readonly trainingPlansError = signal(false);

  readonly openingMonthCardKey = signal<string | null>(null);
  readonly monthOpenError = signal<string | null>(null);

  /** Blocos estáticos de introdução (estilo app de referência). */
  readonly introRail = [
    {
      key: 'support',
      title: 'Grupo suporte',
      line: 'Comunidade no WhatsApp',
      image: 'assets/pngs/suporte.png',
    },
    {
      key: 'watch',
      title: 'Assista antes de treinar',
      line: 'Segurança e boas-vindas',
      image: 'assets/pngs/assista-antes.png',
    },
    {
      key: 'assessment',
      title: 'Faça sua avaliação física',
      line: 'Prepare o corpo para evoluir',
      image: 'assets/pngs/avaliacao.png',
    },
  ] as const;

  ngOnInit(): void {
    const token = this.authTokenStorage.getToken();
    if (!token) {
      this.isLoadingUser.set(false);
      return;
    }

    const cached = this.authTokenStorage.getCachedMe();
    if (cached) {
      this.user.set(cached);
      this.loadError.set(false);
      this.isLoadingUser.set(false);
    } else {
      this.authApi
        .getMe(token)
        .pipe(catchError(() => of(null)))
        .subscribe({
          next: (profile) => {
            if (profile) {
              this.authTokenStorage.setCachedMe(profile);
            }
            this.user.set(profile);
            this.loadError.set(profile === null);
            this.isLoadingUser.set(false);
          },
        });
    }

    this.loadTrainingPlans();
  }

  private loadTrainingPlans(): void {
    if (!this.authTokenStorage.getToken()) {
      return;
    }
    this.trainingPlansLoading.set(true);
    this.trainingPlansError.set(false);
    this.trainingPlansApi.listTrainingPlans().subscribe({
      next: (plans) => {
        this.trainingPlans.set(plans);
        this.trainingPlansLoading.set(false);
      },
      error: () => {
        this.trainingPlans.set([]);
        this.trainingPlansError.set(true);
        this.trainingPlansLoading.set(false);
      },
    });
  }

  monthBadgeLabel(monthNumber: number): string {
    if (!Number.isFinite(monthNumber) || monthNumber < 1) {
      return 'Intro';
    }
    return `${monthNumber}º mês`;
  }

  retryTrainingPlans(): void {
    this.loadTrainingPlans();
  }

  monthCardKey(plan: TrainingPlanView, month: ApiTrainingMonth): string {
    return `${plan.id}-${month.month_number}`;
  }

  /** `active` vem do GET /training-plans (catalogo). */
  isMonthUnlocked(_plan: TrainingPlanView, month: ApiTrainingMonth): boolean {
    return month.active === true;
  }

  /**
   * Resolve plano/mes na API e navega **uma vez** para `/treinos/mes/:id`
   * (sem passar por `/treinos`).
   */
  onMonthCardClick(plan: TrainingPlanView, month: ApiTrainingMonth): void {
    if (!this.isMonthUnlocked(plan, month) || this.openingMonthCardKey()) {
      return;
    }
    const key = this.monthCardKey(plan, month);
    this.openingMonthCardKey.set(key);
    this.monthOpenError.set(null);

    const level = this.planLevelForApi(plan);

    this.trainingApi
      .getActivePlan()
      .pipe(
        catchError(() => of<UserActivePlanResponse | null>(null)),
        switchMap((active) => {
          const same =
            active &&
            active.plan_id === plan.id &&
            normalizeLevel(active.level) === normalizeLevel(plan.level);
          if (same) {
            return of(active);
          }
          return this.trainingApi.selectTrainingPlan({ level }).pipe(
            catchError((err: HttpErrorResponse) => {
              this.monthOpenError.set(this.parseHttpError(err));
              return EMPTY;
            }),
            switchMap(() =>
              this.trainingApi.getActivePlan().pipe(
                catchError(() => of<UserActivePlanResponse | null>(null)),
                switchMap((p) => {
                  if (!p?.plan_id) {
                    this.monthOpenError.set(
                      'Nao foi possivel confirmar o plano apos a selecao.',
                    );
                    return EMPTY;
                  }
                  return of(p);
                }),
              ),
            ),
          );
        }),
        switchMap((active) => {
          if (!active?.plan_id) {
            return EMPTY;
          }
          return this.trainingApi.listMonths().pipe(
            catchError(() => of<UserTrainingMonthItem[]>([])),
            map((rows) => ({ rows, activePlanId: active.plan_id })),
          );
        }),
        switchMap(({ rows, activePlanId }) => {
          const item = this.findUserMonthRow(
            rows,
            plan.id,
            month.month_number,
            activePlanId,
          );
          if (!item?.month_id) {
            this.monthOpenError.set(
              'Mes nao encontrado no seu progresso. Tente em Meus treinos.',
            );
            return EMPTY;
          }
          if (item.is_started) {
            return of(item.month_id);
          }
          return this.trainingApi.startMonth(item.month_number).pipe(
            map(() => item.month_id),
            catchError((err: HttpErrorResponse) => {
              this.monthOpenError.set(this.parseHttpError(err));
              return EMPTY;
            }),
          );
        }),
        finalize(() => this.openingMonthCardKey.set(null)),
      )
      .subscribe({
        next: (monthId) => {
          if (typeof monthId === 'string' && monthId) {
            void this.router.navigate(['/treinos', 'mes', monthId]);
          }
        },
      });
  }

  private findUserMonthRow(
    rows: UserTrainingMonthItem[],
    planId: string,
    monthNumber: number,
    activePlanId: string,
  ): UserTrainingMonthItem | undefined {
    return rows.find((r) => {
      if (r.month_number !== monthNumber) {
        return false;
      }
      const pid =
        typeof r.plan_id === 'string' && r.plan_id.trim()
          ? r.plan_id.trim()
          : undefined;
      if (pid) {
        return pid === planId;
      }
      return activePlanId === planId;
    });
  }

  private planLevelForApi(plan: TrainingPlanView): TrainingLevel {
    const n = normalizeLevel(plan.level);
    if (n === 'intermediario') {
      return 'intermediario';
    }
    if (n === 'avancado') {
      return 'avancado';
    }
    return 'iniciante';
  }

  private parseHttpError(err: HttpErrorResponse): string {
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
        `Nao foi possivel abrir o treino (HTTP ${err.status}).`
      );
    }
    return `Nao foi possivel abrir o treino (HTTP ${err.status}).`;
  }

  imgByPlanId(id: string): string {
    return `assets/pngs/treino-${id}.png`;
  }

  displayName(): string {
    const u = this.user();
    if (u) {
      const raw =
        typeof u.fullName === 'string'
          ? u.fullName
          : typeof u.full_name === 'string'
            ? u.full_name
            : '';
      const first = raw.trim().split(/\s+/)[0];
      if (first) {
        return first;
      }
      if (typeof u.email === 'string' && u.email) {
        const local = u.email
          .split('@')[0]
          ?.replace(/[._-]+/g, ' ')
          .trim();
        if (local) {
          return local.charAt(0).toUpperCase() + local.slice(1);
        }
      }
    }
    return 'aluna';
  }

  logout(): void {
    this.authTokenStorage.clear();
    void this.router.navigate(['/auth', 'login']);
  }
}

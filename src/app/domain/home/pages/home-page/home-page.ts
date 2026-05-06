import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import {
  AuthApiService,
  type ApiUser,
} from '../../../auth/api/auth-api.service';
import { AuthTokenStorageService } from '../../../auth/services/auth-token-storage.service';
import {
  TrainingPlansApiService,
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
  private readonly router = inject(Router);

  readonly user = signal<ApiUser | null>(null);
  readonly loadError = signal(false);
  readonly isLoadingUser = signal(true);

  readonly trainingPlans = signal<TrainingPlanView[]>([]);
  readonly trainingPlansLoading = signal(false);
  readonly trainingPlansError = signal(false);

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

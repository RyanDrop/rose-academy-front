import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { AuthHeroCard } from '../../../../widgets/auth-hero-card/auth-hero-card';
import {
  AuthApiService,
  parseSubscriptionActiveStatus,
  pickPendingAbacatePaymentUrl,
  tokenFromAuthResponse,
} from '../../api/auth-api.service';
import { AuthHeroMetric } from '../../auth.models';
import { postLoginDestination } from '../../user-onboarding-status';
import { AuthTokenStorageService } from '../../services/auth-token-storage.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'ra-login-page',
  imports: [ReactiveFormsModule, RouterLink, AuthHeroCard],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authApi = inject(AuthApiService);
  private readonly authTokenStorage = inject(AuthTokenStorageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly heroMetrics: AuthHeroMetric[] = [
    { label: 'Aulas gravadas', value: '120+' },
    { label: 'Guias praticos', value: '36' },
  ];

  readonly loginForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    rememberSession: [true],
  });

  readonly isSubmitting = signal(false);
  readonly feedbackMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly hasStarted = signal(false);

  constructor() {
    const queryEmail =
      this.route.snapshot.queryParamMap.get('email') ??
      this.authService.lastRegisteredEmail();
    const hasRegisteredFlag =
      this.route.snapshot.queryParamMap.get('registered') === '1';

    if (queryEmail) {
      this.loginForm.controls.email.setValue(queryEmail);
      this.hasStarted.set(true);
    }

    if (hasRegisteredFlag) {
      this.feedbackMessage.set(
        'Conta criada com sucesso. Agora e so entrar e continuar o onboarding.',
      );
      this.hasStarted.set(true);
    }
  }

  ngOnInit(): void {
    this.hasStarted.set(window.innerWidth >= 768);
  }

  beginJourney(): void {
    this.hasStarted.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  submit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.feedbackMessage.set('Revise email e senha antes de continuar.');
      this.successMessage.set(null);
      return;
    }

    this.isSubmitting.set(true);
    this.feedbackMessage.set(null);
    this.successMessage.set(null);

    const email = normalizeEmail(this.loginForm.controls.email.value);
    const password = this.loginForm.controls.password.value.trim();
    const rememberSession = this.loginForm.controls.rememberSession.value;

    this.authApi
      .login({ email, password })
      .pipe(
        switchMap((res) => {
          const token = tokenFromAuthResponse(res);
          this.authTokenStorage.setToken(token, rememberSession);
          return forkJoin({
            profile: this.authApi.getMe(token).pipe(catchError(() => of(null))),
            active: this.authApi.getMyActiveSubscription().pipe(
              catchError(() => of(null)),
            ),
          });
        }),
      )
      .subscribe({
        next: ({ profile, active }) => {
          if (profile) {
            this.authTokenStorage.setCachedMe(profile);
          }
          const subStatus = parseSubscriptionActiveStatus(active);
          const dest = postLoginDestination(profile, subStatus);
          if (dest.kind === 'pending_checkout') {
            this.authApi
              .listAbacateSubscriptions()
              .pipe(
                map((body) => pickPendingAbacatePaymentUrl(body)),
                catchError(() => of(null)),
              )
              .subscribe((payUrl) => {
                this.isSubmitting.set(false);
                if (payUrl) {
                  window.location.assign(payUrl);
                  return;
                }
                const fallback = postLoginDestination(profile, null);
                if (fallback.kind === 'route') {
                  void this.router.navigate(fallback.path, {
                    queryParams: fallback.queryParams,
                  });
                }
              });
            return;
          }
          this.isSubmitting.set(false);
          if (dest.queryParams) {
            void this.router.navigate(dest.path, {
              queryParams: dest.queryParams,
            });
          } else {
            void this.router.navigate(dest.path);
          }
        },
        error: (err: unknown) => {
          this.authTokenStorage.clear();
          this.feedbackMessage.set(loginErrorMessage(err));
          this.isSubmitting.set(false);
        },
      });
  }

  hasError(controlName: 'email' | 'password', errorCode?: string): boolean {
    const control = this.loginForm.controls[controlName];
    return (
      !!control &&
      control.touched &&
      (errorCode ? control.hasError(errorCode) : control.invalid)
    );
  }
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function loginErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 401) {
      return 'Email ou senha incorretos.';
    }
    if (err.status === 400) {
      return 'Revise email e senha e tente novamente.';
    }
  }
  return 'Nao foi possivel entrar. Tente novamente em instantes.';
}

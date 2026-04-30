import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthHeroCard } from '../../../../widgets/auth-hero-card/auth-hero-card';
import { AuthHeroMetric } from '../../auth.models';
import { AuthService } from '../../services/auth';

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
  private readonly route = inject(ActivatedRoute);

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

    this.authService
      .login({
        email: normalizeEmail(this.loginForm.controls.email.value),
        password: this.loginForm.controls.password.value.trim(),
      })
      .subscribe({
        next: (session) => {
          this.successMessage.set(
            `Bem-vinda, ${session.fullName}. O dashboard sera conectado assim que os endpoints forem integrados.`,
          );
          this.isSubmitting.set(false);
        },
        error: () => {
          this.feedbackMessage.set(
            'Nao foi possivel entrar. Tente novamente em instantes.',
          );
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

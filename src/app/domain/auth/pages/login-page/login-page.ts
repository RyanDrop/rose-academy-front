import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
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
export class LoginPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly heroMetrics: AuthHeroMetric[] = [
    { label: 'Aulas gravadas', value: '120+' },
    { label: 'Guias praticos', value: '36' },
    { label: 'Evolucao guiada', value: '7 dias' },
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
  readonly dragOffset = signal(0);
  readonly isDraggingStart = signal(false);
  private dragStartX = 0;
  private dragBaseOffset = 0;
  private dragMax = 220;

  readonly dragProgress = computed(() =>
    Math.min(this.dragOffset() / this.dragMax, 1),
  );

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

  beginJourney(): void {
    this.hasStarted.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  startDrag(event: PointerEvent): void {
    const thumb = event.currentTarget as HTMLElement | null;
    const track = thumb?.parentElement;
    if (thumb && track) {
      this.dragMax = Math.max(track.clientWidth - thumb.clientWidth - 16, 0);
    }

    thumb?.setPointerCapture?.(event.pointerId);
    this.isDraggingStart.set(true);
    this.dragStartX = event.clientX;
    this.dragBaseOffset = this.dragOffset();
  }

  onDrag(event: PointerEvent): void {
    if (!this.isDraggingStart()) {
      return;
    }

    const nextOffset = this.dragBaseOffset + (event.clientX - this.dragStartX);
    this.dragOffset.set(clamp(nextOffset, 0, this.dragMax));
  }

  endDrag(): void {
    if (!this.isDraggingStart()) {
      return;
    }

    this.isDraggingStart.set(false);

    if (this.dragProgress() >= 0.92) {
      this.dragOffset.set(this.dragMax);
      this.beginJourney();
      queueMicrotask(() => this.dragOffset.set(0));
      return;
    }

    this.dragOffset.set(0);
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { PasswordStrength } from '../../../../shared/components/password-strength/password-strength';
import { StepProgress } from '../../../../shared/components/step-progress/step-progress';
import { AuthHeroCard } from '../../../../widgets/auth-hero-card/auth-hero-card';
import { NgxMaskDirective } from 'ngx-mask';
import { PlanSelector } from '../../../../widgets/plan-selector/plan-selector';
import {
  AuthGoal,
  AuthHeroMetric,
  AuthPlan,
  RegisterAccountPayload,
  RegisterProfilePayload,
} from '../../auth.models';
import {
  birthDateValidator,
  fullNameValidator,
  matchingFieldsValidator,
  metricRangeValidator,
  optionalPhoneValidator,
  passwordComplexityValidator,
} from '../../auth.validators';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'ra-register-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AuthHeroCard,
    StepProgress,
    PasswordStrength,
    PlanSelector,
    CurrencyPipe,
    NgxMaskDirective,
  ],
  templateUrl: './register-page.html',
  styleUrl: './register-page.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly steps = ['Conta', 'Perfil', 'Plano'];
  readonly goals: AuthGoal[] = this.authService.getGoals();
  readonly plans: AuthPlan[] = this.authService.getPlans();
  readonly heroMetrics: AuthHeroMetric[] = [
    { label: 'Treinos semanais', value: '5x' },
    { label: 'Planos de estudo', value: 'PDF + video' },
  ];

  readonly registerForm = this.formBuilder.group({
    account: this.formBuilder.nonNullable.group(
      {
        fullName: ['', [Validators.required, fullNameValidator()]],
        email: ['', [Validators.required, Validators.email]],
        password: [
          '',
          [
            Validators.required,
            Validators.minLength(8),
            passwordComplexityValidator(),
          ],
        ],
        confirmPassword: ['', [Validators.required]],
      },
      {
        validators: matchingFieldsValidator('password', 'confirmPassword'),
      },
    ),
    profile: this.formBuilder.group({
      gender: this.formBuilder.nonNullable.control('', [Validators.required]),
      dateBirth: this.formBuilder.nonNullable.control('', [
        Validators.required,
        birthDateValidator(12),
      ]),
      weight: this.formBuilder.control<string>('', [
        Validators.required,
        metricRangeValidator(30, 400),
      ]),
      height: this.formBuilder.control<string>('', [
        Validators.required,
        metricRangeValidator(120, 250),
      ]),
      goalId: this.formBuilder.control<number | null>(null, [
        Validators.required,
      ]),
      profileImg: this.formBuilder.control<string | null>(null),
      cellphone: this.formBuilder.nonNullable.control('', [
        optionalPhoneValidator(),
      ]),
    }),
    plan: this.formBuilder.nonNullable.group({
      taxId: ['', [Validators.required]],
    }),
  });

  readonly currentStep = signal(1);
  readonly hasStarted = signal(false);
  readonly selectedTaxId = signal('');
  readonly pendingAccountId = signal<number | null>(null);
  readonly feedbackMessage = signal<string | null>(null);
  readonly avatarPreview = signal<string | null>(null);
  readonly avatarError = signal<string | null>(null);
  readonly isCreatingAccount = signal(false);
  readonly isSubmittingRegistration = signal(false);
  readonly maxBirthDate = getMaximumBirthDate(12);

  /** 1 a 3 digitos (ex.: 30, 400). */
  readonly weightHeightMask = '099';
  readonly weightSuffix = ' kg';
  readonly heightSuffix = ' cm';
  /** DDD + fixo 8 ou celular 9 digitos. */
  readonly phoneMask = '(00) 0000-0000||(00) 00000-0000';

  readonly selectedPlan = computed(
    () =>
      this.plans.find((plan) => plan.taxId === this.selectedTaxId()) ?? null,
  );

  ngOnInit(): void {
    this.hasStarted.set(window.innerWidth >= 768);
  }

  beginJourney(): void {
    this.hasStarted.set(true);
    this.feedbackMessage.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  continueFromAccount(): void {
    const accountGroup = this.registerForm.controls.account;

    if (accountGroup.invalid) {
      accountGroup.markAllAsTouched();
      this.feedbackMessage.set(
        'Preencha corretamente os dados da conta para continuar.',
      );
      return;
    }

    this.isCreatingAccount.set(true);
    this.feedbackMessage.set(null);

    this.authService.createAccount(this.getAccountPayload()).subscribe({
      next: (response) => {
        this.pendingAccountId.set(response.accountId);
        this.currentStep.set(2);
        this.feedbackMessage.set(
          'Conta base criada. Agora complete o perfil do aluno.',
        );
        this.isCreatingAccount.set(false);
      },
      error: () => {
        this.feedbackMessage.set(
          'Nao foi possivel criar a conta inicial. Tente novamente.',
        );
        this.isCreatingAccount.set(false);
      },
    });
  }

  continueFromProfile(): void {
    const profileGroup = this.registerForm.controls.profile;

    if (profileGroup.invalid) {
      profileGroup.markAllAsTouched();
      this.feedbackMessage.set(
        'Revise os dados fisicos e a meta antes de seguir.',
      );
      return;
    }

    this.feedbackMessage.set(null);
    this.currentStep.set(3);
  }

  goBack(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update((step) => step - 1);
      this.feedbackMessage.set(null);
    }
  }

  selectPlan(taxId: string): void {
    this.selectedTaxId.set(taxId);
    this.registerForm.controls.plan.controls.taxId.setValue(taxId);
    this.registerForm.controls.plan.controls.taxId.markAsTouched();
  }

  submitRegistration(): void {
    const planGroup = this.registerForm.controls.plan;

    if (!this.pendingAccountId()) {
      this.feedbackMessage.set(
        'Crie a conta base primeiro para liberar o restante do cadastro.',
      );
      this.currentStep.set(1);
      return;
    }

    if (this.registerForm.controls.profile.invalid) {
      this.registerForm.controls.profile.markAllAsTouched();
      this.currentStep.set(2);
      this.feedbackMessage.set(
        'Finalize o perfil antes de concluir o cadastro.',
      );
      return;
    }

    if (planGroup.invalid) {
      planGroup.markAllAsTouched();
      this.feedbackMessage.set('Escolha um plano para concluir o cadastro.');
      return;
    }

    this.isSubmittingRegistration.set(true);
    this.feedbackMessage.set(null);

    this.authService
      .completeRegistration({
        ...this.getAccountPayload(),
        ...this.getProfilePayload(),
        taxId: planGroup.controls.taxId.value,
      })
      .subscribe({
        next: async (session) => {
          this.isSubmittingRegistration.set(false);
          await this.router.navigate(['/auth/login'], {
            queryParams: {
              email: session.email,
              registered: '1',
            },
          });
        },
        error: () => {
          this.feedbackMessage.set(
            'Falha ao concluir o cadastro. Tente novamente.',
          );
          this.isSubmittingRegistration.set(false);
        },
      });
  }

  handleProfileImageChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.avatarError.set('Escolha uma imagem valida para o perfil.');
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.avatarError.set('A imagem deve ter no maximo 5 MB.');
      input.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      this.avatarPreview.set(result);
      this.avatarError.set(null);
      this.registerForm.controls.profile.controls.profileImg.setValue(result);
    };

    reader.readAsDataURL(file);
  }

  removeProfileImage(input: HTMLInputElement): void {
    this.avatarPreview.set(null);
    this.avatarError.set(null);
    this.registerForm.controls.profile.controls.profileImg.setValue(null);
    input.value = '';
  }

  hasAccountError(
    controlName: 'fullName' | 'email' | 'password' | 'confirmPassword',
    errorCode?: string,
  ): boolean {
    const control = this.registerForm.controls.account.controls[controlName];
    return (
      !!control &&
      control.touched &&
      (errorCode ? control.hasError(errorCode) : control.invalid)
    );
  }

  hasProfileError(
    controlName:
      | 'gender'
      | 'dateBirth'
      | 'weight'
      | 'height'
      | 'goalId'
      | 'cellphone',
    errorCode?: string,
  ): boolean {
    const control = this.registerForm.controls.profile.controls[controlName];
    return (
      !!control &&
      control.touched &&
      (errorCode ? control.hasError(errorCode) : control.invalid)
    );
  }

  private getAccountPayload(): RegisterAccountPayload {
    const accountValue = this.registerForm.controls.account.getRawValue();

    return {
      fullName: normalizeName(accountValue.fullName),
      email: normalizeEmail(accountValue.email),
      password: accountValue.password.trim(),
    };
  }

  private getProfilePayload(): RegisterProfilePayload {
    const profileValue = this.registerForm.controls.profile.getRawValue();

    return {
      gender: profileValue.gender as RegisterProfilePayload['gender'],
      dateBirth: profileValue.dateBirth,
      weight: parseInt(digitsOnly(String(profileValue.weight)), 10) || 0,
      height: parseInt(digitsOnly(String(profileValue.height)), 10) || 0,
      goalId: Number(profileValue.goalId),
      profileImg: profileValue.profileImg,
      cellphone: profileValue.cellphone
        ? digitsOnly(profileValue.cellphone)
        : null,
    };
  }
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').replace(/[<>]/g, '');
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function getMaximumBirthDate(minimumAge: number): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - minimumAge);
  return date.toISOString().split('T')[0];
}

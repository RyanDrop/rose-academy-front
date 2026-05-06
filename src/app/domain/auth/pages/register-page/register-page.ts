import { CurrencyPipe, DOCUMENT } from '@angular/common';
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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgxMaskDirective } from 'ngx-mask';
import { catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';

import { PasswordStrength } from '../../../../shared/components/password-strength/password-strength';
import { StepProgress } from '../../../../shared/components/step-progress/step-progress';
import { AuthHeroCard } from '../../../../widgets/auth-hero-card/auth-hero-card';
import { PlanSelector } from '../../../../widgets/plan-selector/plan-selector';
import {
  AuthApiService,
  parseSubscriptionActiveStatus,
  pickPendingAbacatePaymentUrl,
  tokenFromAuthResponse,
  type ApiGoal,
  type ApiProduct,
  type ApiUser,
  type CreateAbacateSubscriptionCheckoutOutput,
  type PatchMeBody,
  type SubscriptionActiveApiStatus,
} from '../../api/auth-api.service';
import type { GenderType } from '../../auth.types';
import {
  AuthGoal,
  AuthHeroMetric,
  AuthPlan,
  RegisterAccountPayload,
  RegisterProfilePayload,
} from '../../auth.models';
import {
  birthDateValidator,
  cpfValidator,
  fullNameValidator,
  matchingFieldsValidator,
  metricRangeValidator,
  optionalPhoneValidator,
  passwordComplexityValidator,
} from '../../auth.validators';
import { AuthTokenStorageService } from '../../services/auth-token-storage.service';
import { AuthService } from '../../services/auth.service';
import {
  isPaidSubscriptionStatus,
  isProfileComplete,
  prefillProfileFormFromUser,
} from '../../user-onboarding-status';

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
  private readonly authApi = inject(AuthApiService);
  private readonly authTokenStorage = inject(AuthTokenStorageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);

  readonly steps = ['Conta', 'Perfil', 'Plano'];
  readonly goals = signal<AuthGoal[]>([]);
  readonly plans = signal<AuthPlan[]>([]);
  readonly heroMetrics: AuthHeroMetric[] = [
    { label: 'Treinos semanais', value: '5x' },
    { label: 'Planos de estudo', value: 'PDF + video' },
  ];

  readonly registerForm = this.formBuilder.group({
    account: this.formBuilder.nonNullable.group(
      {
        fullName: ['', [Validators.required, fullNameValidator()]],
        cpf: ['', [Validators.required, cpfValidator()]],
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
      goalId: this.formBuilder.control<string | null>(null, [
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
  readonly feedbackMessage = signal<string | null>(null);
  readonly avatarPreview = signal<string | null>(null);
  readonly avatarError = signal<string | null>(null);
  readonly isCreatingAccount = signal(false);
  readonly isLoadingGoals = signal(false);
  readonly isSavingProfile = signal(false);
  readonly isSubmittingRegistration = signal(false);
  readonly isLoadingPlans = signal(false);
  readonly maxBirthDate = getMaximumBirthDate(12);

  readonly weightHeightMask = '099';
  readonly weightSuffix = ' kg';
  readonly heightSuffix = ' cm';
  readonly phoneMask = '(00) 0000-0000||(00) 00000-0000';
  readonly cpfMask = '000.000.000-00';

  readonly selectedPlan = computed(
    () =>
      this.plans().find((plan) => plan.taxId === this.selectedTaxId()) ?? null,
  );

  ngOnInit(): void {
    this.hasStarted.set(window.innerWidth >= 768);
    this.applyEntryRouting();
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

    if (this.authTokenStorage.hasToken()) {
      this.feedbackMessage.set(null);
      this.syncRegistrationProgressFromServer();
      return;
    }

    this.isCreatingAccount.set(true);
    this.feedbackMessage.set(null);

    const account = this.getAccountPayload();

    this.authApi
      .registerAccount({
        email: account.email,
        full_name: account.fullName,
        password: account.password,
        tax_id: account.cpf,
      })
      .subscribe({
        next: (res) => {
          const token = tokenFromAuthResponse(res);
          this.authTokenStorage.setToken(token, true);
          this.authService.lastRegisteredEmail.set(account.email);
          this.currentStep.set(2);
          this.feedbackMessage.set(
            'Conta criada. Complete seu perfil e escolha o plano.',
          );
          this.isCreatingAccount.set(false);
          this.ensureGoalsLoaded();
        },
        error: (err: unknown) => {
          this.feedbackMessage.set(registerAccountErrorMessage(err));
          this.isCreatingAccount.set(false);
        },
      });
  }

  continueFromProfile(): void {
    const profileGroup = this.registerForm.controls.profile;

    if (profileGroup.invalid) {
      const cached = this.authTokenStorage.getCachedMe();
      if (cached && isProfileComplete(cached)) {
        this.prefillProfileControls(cached);
      }
    }

    if (profileGroup.invalid) {
      profileGroup.markAllAsTouched();
      this.feedbackMessage.set(
        'Revise os dados fisicos e a meta antes de seguir.',
      );
      return;
    }

    if (!this.authTokenStorage.getToken()) {
      this.feedbackMessage.set(
        'Sessao nao encontrada. Volte ao passo 1 e crie a conta novamente.',
      );
      this.currentStep.set(1);
      return;
    }

    this.isSavingProfile.set(true);
    this.feedbackMessage.set(null);

    const patch = this.buildPatchMePayload();

    this.authApi
      .patchMyProfile(patch)
      .pipe(
        tap((user) => this.authTokenStorage.setCachedMe(user)),
        switchMap(() => this.authApi.listProducts()),
      )
      .subscribe({
        next: (products) => {
          this.plans.set(products.map(mapApiProductToAuthPlan));
          if (this.plans().length === 0) {
            this.feedbackMessage.set(
              'Nenhum plano disponivel no momento. Tente mais tarde.',
            );
          }
          this.currentStep.set(3);
          this.isSavingProfile.set(false);
        },
        error: (err: unknown) => {
          this.feedbackMessage.set(profileOrProductsErrorMessage(err));
          this.isSavingProfile.set(false);
        },
      });
  }

  goBack(): void {
    const step = this.currentStep();
    if (step === 2) {
      this.authTokenStorage.clear();
      this.goals.set([]);
    }
    if (step > 1) {
      this.currentStep.set(step - 1);
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

    if (this.registerForm.controls.profile.invalid) {
      const cached = this.authTokenStorage.getCachedMe();
      if (cached && isProfileComplete(cached)) {
        this.prefillProfileControls(cached);
      }
    }

    if (!this.authTokenStorage.hasToken()) {
      this.feedbackMessage.set(
        'Sessao expirada. Volte ao passo 1 para criar a conta.',
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
      this.feedbackMessage.set('Escolha um plano para continuar.');
      return;
    }

    const productId = planGroup.controls.taxId.value.trim();
    const origin = this.document.defaultView?.location?.origin ?? '';

    this.isSubmittingRegistration.set(true);
    this.feedbackMessage.set(null);

    this.authApi
      .createAbacateSubscriptionCheckout({
        product_id: /^\d+$/.test(productId) ? Number(productId) : productId,
        return_url: `${origin}/home`,
        completion_url: `${origin}/home/sucess`,
      })
      .subscribe({
        next: (out) => {
          this.isSubmittingRegistration.set(false);
          const checkoutUrl = pickCheckoutUrl(out);
          if (checkoutUrl && this.document.defaultView) {
            this.document.defaultView.location.href = checkoutUrl;
            return;
          }
          void this.router.navigate(['/home']);
        },
        error: (err: unknown) => {
          this.feedbackMessage.set(checkoutErrorMessage(err));
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
    controlName: 'fullName' | 'cpf' | 'email' | 'password' | 'confirmPassword',
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

  private applyEntryRouting(): void {
    const token = this.authTokenStorage.getToken();
    if (!token) {
      return;
    }
    const stepParam = this.route.snapshot.queryParamMap.get('step');
    forkJoin({
      user: this.authApi.getMe(token).pipe(catchError(() => of(null))),
      active: this.authApi.getMyActiveSubscription().pipe(
        catchError(() => of(null)),
      ),
    }).subscribe(({ user, active }) => {
      if (user) {
        this.authTokenStorage.setCachedMe(user);
      }
      const subStatus = parseSubscriptionActiveStatus(active);
      this.applyResolvedUser(user, stepParam, subStatus);
    });
  }

  private syncRegistrationProgressFromServer(): void {
    const token = this.authTokenStorage.getToken();
    if (!token) {
      return;
    }
    const stepParam = this.route.snapshot.queryParamMap.get('step');
    forkJoin({
      user: this.authApi.getMe(token).pipe(catchError(() => of(null))),
      active: this.authApi.getMyActiveSubscription().pipe(
        catchError(() => of(null)),
      ),
    }).subscribe(({ user, active }) => {
      if (user) {
        this.authTokenStorage.setCachedMe(user);
      }
      const subStatus = parseSubscriptionActiveStatus(active);
      this.applyResolvedUser(user, stepParam, subStatus);
    });
  }

  private applyResolvedUser(
    user: ApiUser | null,
    stepParam: string | null,
    subscriptionStatus: SubscriptionActiveApiStatus,
  ): void {
    if (!user) {
      this.hasStarted.set(true);
      this.currentStep.set(2);
      this.ensureGoalsLoaded();
      return;
    }

    const profileOk = isProfileComplete(user);
    const subPaid = isPaidSubscriptionStatus(subscriptionStatus);

    if (profileOk && subPaid) {
      void this.router.navigate(['/home']);
      return;
    }

    if (profileOk && subscriptionStatus === 'PENDING' && user) {
      this.redirectToPendingAbacateCheckout(user);
      return;
    }

    this.hasStarted.set(true);

    if (!profileOk) {
      this.currentStep.set(2);
      this.ensureGoalsLoaded();
      this.prefillProfileControls(user);
      if (stepParam === '3') {
        this.feedbackMessage.set(
          'Complete o perfil antes de escolher o plano.',
        );
      }
      return;
    }

    if (stepParam === '2') {
      this.currentStep.set(2);
      this.ensureGoalsLoaded();
      this.prefillProfileControls(user);
      return;
    }

    this.currentStep.set(3);
    this.prefillProfileControls(user);
    this.loadProductsForPlanStep();
  }

  private redirectToPendingAbacateCheckout(user: ApiUser): void {
    this.authApi
      .listAbacateSubscriptions()
      .pipe(
        map((body) => pickPendingAbacatePaymentUrl(body)),
        catchError(() => of(null)),
      )
      .subscribe((payUrl) => {
        if (payUrl) {
          this.document.defaultView?.location.assign(payUrl);
          return;
        }
        this.hasStarted.set(true);
        this.currentStep.set(3);
        this.prefillProfileControls(user);
        this.loadProductsForPlanStep();
        this.feedbackMessage.set(
          'Pagamento pendente: nao encontramos o link automatico. Continue no passo do plano.',
        );
      });
  }

  private prefillProfileControls(user: ApiUser): void {
    const p = this.registerForm.controls.profile;
    prefillProfileFormFromUser(user, {
      gender: p.controls.gender,
      dateBirth: p.controls.dateBirth,
      weight: p.controls.weight,
      height: p.controls.height,
      goalId: p.controls.goalId,
      cellphone: p.controls.cellphone,
      profileImg: p.controls.profileImg,
    });
    const img = p.controls.profileImg.value;
    if (img) {
      this.avatarPreview.set(img);
    }
  }

  private loadProductsForPlanStep(): void {
    if (this.plans().length > 0) {
      return;
    }
    this.isLoadingPlans.set(true);
    this.authApi.listProducts().subscribe({
      next: (products) => {
        this.plans.set(products.map(mapApiProductToAuthPlan));
        this.isLoadingPlans.set(false);
      },
      error: () => {
        this.feedbackMessage.set(
          'Nao foi possivel carregar os planos. Tente novamente.',
        );
        this.isLoadingPlans.set(false);
      },
    });
  }

  private ensureGoalsLoaded(): void {
    if (this.goals().length > 0 || this.isLoadingGoals()) {
      return;
    }
    this.isLoadingGoals.set(true);
    this.authApi.listGoals().subscribe({
      next: (list) => {
        this.goals.set(
          list
            .map(mapApiGoalToAuthGoal)
            .filter((goal) => goal.id.length > 0),
        );
        this.isLoadingGoals.set(false);
      },
      error: () => {
        this.feedbackMessage.set(
          'Nao foi possivel carregar as metas. Recarregue a pagina ou tente mais tarde.',
        );
        this.goals.set([]);
        this.isLoadingGoals.set(false);
      },
    });
  }

  private getAccountPayload(): RegisterAccountPayload {
    const accountValue = this.registerForm.controls.account.getRawValue();

    return {
      fullName: normalizeName(accountValue.fullName),
      cpf: digitsOnly(accountValue.cpf),
      email: normalizeEmail(accountValue.email),
      password: accountValue.password.trim(),
    };
  }

  private getProfilePayload(): RegisterProfilePayload {
    const profileValue = this.registerForm.controls.profile.getRawValue();

    return {
      gender: profileValue.gender as GenderType,
      dateBirth: profileValue.dateBirth,
      weight: parseInt(digitsOnly(String(profileValue.weight)), 10) || 0,
      height: parseInt(digitsOnly(String(profileValue.height)), 10) || 0,
      goalId: normalizeGoalIdFromForm(profileValue.goalId),
      profileImg: profileValue.profileImg,
      cellphone: profileValue.cellphone
        ? digitsOnly(profileValue.cellphone)
        : null,
    };
  }

  private buildPatchMePayload(): PatchMeBody {
    const profile = this.getProfilePayload();
    return {
      gender: profile.gender,
      cellphone: profile.cellphone ?? '',
      date_birth: profile.dateBirth,
      email_verified: false,
      goal_id: profile.goalId,
      height: profile.height,
      profile_img: profile.profileImg ?? '',
      weight: profile.weight,
    };
  }
}

function mapApiGoalToAuthGoal(g: ApiGoal): AuthGoal {
  const idRaw = g.id ?? g.goal_id;
  const id =
    idRaw === undefined || idRaw === null
      ? ''
      : typeof idRaw === 'string'
        ? idRaw.trim()
        : String(idRaw).trim();
  const label =
    (typeof g.label === 'string' && g.label) ||
    (typeof g.name === 'string' && g.name) ||
    (id ? `Meta ${id}` : 'Meta');
  return {
    id,
    label,
    description:
      typeof g.description === 'string' && g.description ? g.description : '',
  };
}

function normalizeGoalIdFromForm(
  value: string | null | undefined,
): string {
  if (value === null || value === undefined) {
    return '';
  }
  const s = typeof value === 'string' ? value.trim() : String(value).trim();
  return s === 'NaN' ? '' : s;
}

function mapApiProductToAuthPlan(p: ApiProduct): AuthPlan {
  const extra = p as { product_id?: number | string };
  const rawId =
    p.id ??
    extra.product_id ??
    (typeof p.tax_id === 'string' && p.tax_id ? p.tax_id : '');
  const taxId = String(rawId);
  const name =
    (typeof p.name === 'string' && p.name) ||
    (typeof p.title === 'string' && p.title) ||
    'Plano';
  let price = 0;
  if (typeof p.price === 'number') {
    price = p.price;
  } else if (typeof p.price_reais === 'number') {
    price = p.price_reais;
  } else if (typeof p.price_cents === 'number') {
    price = p.price_cents / 100;
  }
  const bcRaw = String(p.billing_cycle ?? p.billingCycle ?? '').toLowerCase();
  const billingCycle: 'monthly' | 'yearly' =
    bcRaw === 'yearly' || bcRaw === 'annual' || bcRaw === 'year'
      ? 'yearly'
      : 'monthly';
  return {
    taxId,
    name,
    price,
    billingCycle,
    description:
      typeof p.description === 'string' && p.description ? p.description : '',
    perks: Array.isArray(p.perks) ? p.perks : [],
  };
}

function pickCheckoutUrl(
  out: CreateAbacateSubscriptionCheckoutOutput,
): string | null {
  const u = out.checkout_url ?? out.url ?? out.payment_url;
  return typeof u === 'string' && u.trim() ? u.trim() : null;
}

function registerAccountErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 409) {
      return 'Email ou CPF ja cadastrado.';
    }
    if (err.status === 503) {
      return 'Servico de pagamento indisponivel. Tente mais tarde.';
    }
    if (err.status === 400) {
      return 'Dados invalidos. Confira nome, email e senha.';
    }
  }
  return 'Nao foi possivel criar a conta. Tente novamente.';
}

function profileOrProductsErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 401) {
      return 'Sessao invalida. Volte ao passo 1.';
    }
    if (err.status === 400) {
      return 'Revise os dados do perfil e tente novamente.';
    }
  }
  return 'Nao foi possivel salvar o perfil ou carregar planos. Tente novamente.';
}

function checkoutErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 401) {
      return 'Sessao expirada. Faca login novamente.';
    }
    if (err.status === 400) {
      return 'Nao foi possivel iniciar o checkout. Verifique o plano selecionado.';
    }
  }
  return 'Falha ao iniciar o pagamento. Tente novamente.';
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

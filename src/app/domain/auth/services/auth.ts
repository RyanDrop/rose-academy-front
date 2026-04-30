import { Injectable, signal } from '@angular/core';
import { delay, Observable, of } from 'rxjs';

import {
  AuthGoal,
  AuthPlan,
  AuthSession,
  LoginPayload,
  PendingRegistration,
  RegisterAccountPayload,
  RegisterPayload,
} from '../auth.models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly goals: AuthGoal[] = [
    {
      id: 1,
      label: 'Emagrecimento',
      description: 'Treinos com foco em perda de gordura e constancia.',
    },
    {
      id: 2,
      label: 'Hipertrofia',
      description: 'Evolucao de massa muscular com periodizacao inteligente.',
    },
    {
      id: 3,
      label: 'Condicionamento',
      description: 'Mais energia, resistencia e performance no dia a dia.',
    },
    {
      id: 4,
      label: 'Saude e postura',
      description: 'Mobilidade, fortalecimento e prevencao de dores.',
    },
  ];

  private readonly plans: AuthPlan[] = [
    {
      taxId: 'plan-monthly-5490',
      name: 'Mensal',
      price: 54.9,
      billingCycle: 'monthly',
      description: 'Ideal para começar e conhecer a metodologia da academia.',
      perks: ['Aulas gravadas', 'Planos atualizados', 'Suporte via comunidade'],
    },
    {
      taxId: 'plan-yearly-49990',
      name: 'Anual',
      price: 499.9,
      billingCycle: 'yearly',
      description:
        'Melhor custo-beneficio para evolução consistente o ano inteiro.',
      perks: [
        'Economia no valor total',
        'Prioridade em novidades',
        'Acompanhamento prolongado',
      ],
    },
  ];

  private nextMockUserId = 1000;
  readonly lastRegisteredEmail = signal<string | null>(null);

  getGoals(): AuthGoal[] {
    return this.goals;
  }

  getPlans(): AuthPlan[] {
    return this.plans;
  }

  login(payload: LoginPayload): Observable<AuthSession> {
    const normalizedEmail = payload.email.trim().toLowerCase();
    const firstName = normalizedEmail.split('@')[0].replace(/[._-]+/g, ' ');

    return of({
      userId: 1,
      fullName: this.toDisplayName(firstName),
      email: normalizedEmail,
      token: 'mock-auth-token',
    }).pipe(delay(700));
  }

  createAccount(
    payload: RegisterAccountPayload,
  ): Observable<PendingRegistration> {
    const accountId = this.nextMockUserId++;
    const normalizedEmail = payload.email.trim().toLowerCase();

    this.lastRegisteredEmail.set(normalizedEmail);

    return of({
      accountId,
      email: normalizedEmail,
    }).pipe(delay(800));
  }

  completeRegistration(payload: RegisterPayload): Observable<AuthSession> {
    const normalizedEmail = payload.email.trim().toLowerCase();

    this.lastRegisteredEmail.set(normalizedEmail);

    return of({
      userId: this.nextMockUserId++,
      fullName: payload.fullName.trim(),
      email: normalizedEmail,
      token: `mock-token-${Date.now()}`,
    }).pipe(delay(900));
  }

  private toDisplayName(value: string): string {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}

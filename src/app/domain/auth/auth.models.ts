import type { GenderType } from './auth.types';

export type { GenderType } from './auth.types';

export interface AuthGoal {
  /** UUID ou identificador retornado pela API. */
  id: string;
  label: string;
  description: string;
}

export interface AuthPlan {
  taxId: string;
  name: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  description: string;
  perks: string[];
}

export interface AuthHeroMetric {
  label: string;
  value: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterAccountPayload {
  fullName: string;
  /** CPF somente digitos (11). */
  cpf: string;
  email: string;
  password: string;
}

export interface RegisterProfilePayload {
  gender: GenderType;
  dateBirth: string;
  weight: number;
  height: number;
  /** UUID da meta (GET /goals). */
  goalId: string;
  profileImg: string | null;
  cellphone: string | null;
}

export interface RegisterPayload extends RegisterAccountPayload, RegisterProfilePayload {
  taxId: string;
}

export interface PendingRegistration {
  accountId: number;
  email: string;
}

export interface AuthSession {
  userId: number;
  fullName: string;
  email: string;
  token: string;
}

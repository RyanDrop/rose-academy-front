import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment.dev';

import type { GenderType } from '../auth.types';

/** Corpo de `POST /auth/login` (controllers.LoginRequest). */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Resposta de login/cadastro com JWT (controllers.AuthTokenResponse). */
export interface AuthTokenResponse {
  token?: string;
  access_token?: string;
}

export function tokenFromAuthResponse(res: AuthTokenResponse): string {
  const value = res.token ?? res.access_token;
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Resposta de autenticacao sem token.');
  }
  return value.trim();
}

/** Normaliza o corpo de `/subscriptions/active` para o union usado no front. */
export function parseSubscriptionActiveStatus(
  body: unknown,
): SubscriptionActiveApiStatus {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const raw = (body as { status?: unknown }).status;
  if (raw === null || raw === undefined) {
    return null;
  }
  const u = String(raw).toUpperCase().trim();
  if (u === 'PAID') {
    return 'PAID';
  }
  if (u === 'PENDING') {
    return 'PENDING';
  }
  return null;
}

/**
 * Escolhe checkout pendente em `GET /abacate/subscriptions` e devolve URL de pagamento.
 */
export function pickPendingAbacatePaymentUrl(body: unknown): string | null {
  for (const row of abacateSubscriptionsToRows(body)) {
    if (!isPendingSubscriptionRow(row)) {
      continue;
    }
    const url = extractPaymentLikeUrl(row);
    if (url) {
      return url;
    }
  }
  return null;
}

function abacateSubscriptionsToRows(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) {
    return body.filter(
      (x): x is Record<string, unknown> =>
        x !== null && typeof x === 'object' && !Array.isArray(x),
    );
  }
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    for (const key of ['subscriptions', 'data', 'items', 'results']) {
      const v = o[key];
      if (Array.isArray(v)) {
        return v.filter(
          (x): x is Record<string, unknown> =>
            x !== null && typeof x === 'object' && !Array.isArray(x),
        );
      }
    }
  }
  return [];
}

function isPendingSubscriptionRow(row: Record<string, unknown>): boolean {
  const s = String(row['status'] ?? row['state'] ?? '')
    .toUpperCase()
    .trim();
  return (
    s === 'PENDING' ||
    s === 'AWAITING_PAYMENT' ||
    s === 'UNPAID' ||
    s === 'OPEN'
  );
}

function extractPaymentLikeUrl(row: Record<string, unknown>): string | null {
  const keys = [
    'checkout_url',
    'payment_url',
    'url',
    'checkoutUrl',
    'paymentUrl',
    'hosted_url',
    'hostedUrl',
  ];
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'string' && /^https?:\/\//i.test(v)) {
      return v;
    }
  }
  const checkout = row['checkout'];
  if (checkout && typeof checkout === 'object') {
    const c = checkout as Record<string, unknown>;
    for (const k of ['url', 'checkout_url', 'payment_url']) {
      const v = c[k];
      if (typeof v === 'string' && /^https?:\/\//i.test(v)) {
        return v;
      }
    }
  }
  return null;
}

/** Corpo de `POST /auth/register` (controllers.RegisterRequest). */
export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  gender: GenderType;
  dateBirth: string;
  weight: number;
  height: number;
  goalId: string;
  profileImg: string | null;
  cellphone: string | null;
  taxId: string;
}

/** JSON de PATCH /auth/me (snake_case). */
export interface PatchMeBody {
  gender: GenderType;
  cellphone: string;
  date_birth: string;
  email_verified: boolean;
  goal_id: string;
  height: number;
  profile_img: string;
  weight: number;
}

/** Resposta de `GET /subscriptions/active` (prioridade PAID > PENDING > null). */
export type SubscriptionActiveApiStatus = 'PAID' | 'PENDING' | null;

export interface ActiveSubscriptionResponse {
  status: SubscriptionActiveApiStatus;
}

/** Usuário retornado por `GET/PATCH /auth/me` (models.User). */
export interface ApiUser {
  id: number;
  email: string;
  fullName?: string;
  full_name?: string;
  /** Legado; preferir `GET /subscriptions/active` e `parseSubscriptionActiveStatus`. */
  has_active_subscription?: boolean;
  subscription_status?: string;
  needs_checkout?: boolean;
  [key: string]: unknown;
}

/** Item de `GET /goals` (models.Goal). `id` costuma ser UUID. */
export interface ApiGoal {
  id?: string | number;
  goal_id?: string;
  label?: string;
  name?: string;
  description?: string;
  [key: string]: unknown;
}

/** JSON de POST /auth/register (snake_case). */
export interface RegisterAccountApiRequest {
  email: string;
  full_name: string;
  password: string;
  /** CPF (11 digitos). */
  tax_id: string;
}

/** Item de `GET /products` (models.Product). */
export interface ApiProduct {
  id?: number | string;
  name?: string;
  title?: string;
  description?: string;
  price?: number;
  price_reais?: number;
  price_cents?: number;
  billing_cycle?: string;
  billingCycle?: string;
  tax_id?: string;
  perks?: string[];
  [key: string]: unknown;
}

export interface CreateAbacateSubscriptionCheckoutRequest {
  product_id: number | string;
  return_url: string;
  completion_url: string;
}

export interface CreateAbacateSubscriptionCheckoutOutput {
  checkout_url?: string;
  url?: string;
  payment_url?: string;
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl.replace(/\/$/, '');

  login(body: LoginRequest): Observable<AuthTokenResponse> {
    return this.http.post<AuthTokenResponse>(`${this.baseUrl}/auth/login`, body);
  }

  register(body: RegisterRequest): Observable<AuthTokenResponse> {
    return this.http.post<AuthTokenResponse>(`${this.baseUrl}/auth/register`, body);
  }

  /** Cadastro passo 1 — envia só conta; JWT esperado na resposta. */
  registerAccount(body: RegisterAccountApiRequest): Observable<AuthTokenResponse> {
    return this.http.post<AuthTokenResponse>(`${this.baseUrl}/auth/register`, body);
  }

  getMe(accessToken: string): Observable<ApiUser> {
    return this.http.get<ApiUser>(`${this.baseUrl}/auth/me`, {
      headers: this.bearerHeaders(accessToken),
    });
  }

  patchMe(accessToken: string, body: PatchMeBody): Observable<ApiUser> {
    return this.http.patch<ApiUser>(`${this.baseUrl}/auth/me`, body, {
      headers: this.bearerHeaders(accessToken),
    });
  }

  /** PATCH /auth/me com Bearer do interceptor. */
  patchMyProfile(body: PatchMeBody): Observable<ApiUser> {
    return this.http.patch<ApiUser>(`${this.baseUrl}/auth/me`, body);
  }

  listGoals(): Observable<ApiGoal[]> {
    return this.http.get<ApiGoal[]>(`${this.baseUrl}/goals`);
  }

  listProducts(): Observable<ApiProduct[]> {
    return this.http.get<ApiProduct[]>(`${this.baseUrl}/products`);
  }

  /** Bearer via interceptor. */
  getMyActiveSubscription(): Observable<ActiveSubscriptionResponse> {
    return this.http.get<ActiveSubscriptionResponse>(
      `${this.baseUrl}/subscriptions/active`,
    );
  }

  /** Lista assinaturas Abacate (checkout pendente, etc.). Bearer via interceptor. */
  listAbacateSubscriptions(): Observable<unknown> {
    return this.http.get<unknown>(`${this.baseUrl}/abacate/subscriptions`);
  }

  createAbacateSubscriptionCheckout(
    body: CreateAbacateSubscriptionCheckoutRequest,
  ): Observable<CreateAbacateSubscriptionCheckoutOutput> {
    return this.http.post<CreateAbacateSubscriptionCheckoutOutput>(
      `${this.baseUrl}/abacate/subscriptions/checkout`,
      body,
    );
  }

  private bearerHeaders(accessToken: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${accessToken}`,
    });
  }
}

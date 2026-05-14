import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../../../environments/environment.dev';

/** Mês de treino (`training_months`); `is_active` omitido = ativo. */
export interface ApiTrainingMonth {
  id: string;
  month_number: number;
  subtitle: string;
  title: string;
  plan_id?: string;
  is_active?: boolean;
  /** Liberado pela idade da conta (catalogo enriquecido pela API). */
  active?: boolean;
  [key: string]: unknown;
}

/** Plano (`training_plans`); `is_active` omitido = ativo. */
export interface ApiTrainingPlan {
  id: string;
  level: string;
  title: string;
  subtitle: string;
  months: ApiTrainingMonth[];
  is_active?: boolean;
  [key: string]: unknown;
}

/** Plano pronto para exibição: só ativos e meses ativos, ordenados. */
export interface TrainingPlanView {
  id: string;
  level: string;
  title: string;
  subtitle: string;
  months: ApiTrainingMonth[];
}

@Injectable({
  providedIn: 'root',
})
export class TrainingPlansApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl.replace(/\/$/, '');

  listTrainingPlans(): Observable<TrainingPlanView[]> {
    return this.http
      .get<ApiTrainingPlan[]>(`${this.baseUrl}/training-plans`)
      .pipe(map((body) => normalizeTrainingPlans(Array.isArray(body) ? body : [])));
  }
}

function monthNumberValue(n: unknown): number {
  if (typeof n === 'number' && Number.isFinite(n)) {
    return n;
  }
  if (typeof n === 'string' && n.trim()) {
    const v = Number(n);
    return Number.isFinite(v) ? v : 0;
  }
  return 0;
}

export function normalizeTrainingPlans(plans: ApiTrainingPlan[]): TrainingPlanView[] {
  return plans
    .filter((p) => Boolean(p?.id) && p.is_active !== false)
    .map((p) => {
      const months = [...(p.months ?? [])]
        .filter((m) => Boolean(m?.id) && m.is_active !== false)
        .map((m) => ({
          ...m,
          id: String(m.id),
          month_number: monthNumberValue(m.month_number),
          title: typeof m.title === 'string' ? m.title : '',
          subtitle: typeof m.subtitle === 'string' ? m.subtitle : '',
          active: m.active === true,
        }))
        .sort((a, b) => a.month_number - b.month_number);
      return {
        id: String(p.id),
        level: typeof p.level === 'string' ? p.level : '',
        title: typeof p.title === 'string' ? p.title : '',
        subtitle: typeof p.subtitle === 'string' ? p.subtitle : '',
        months,
      };
    })
    .filter((p) => p.months.length > 0);
}

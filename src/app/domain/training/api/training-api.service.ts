import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment.dev';
import type {
  CompleteWorkoutRequest,
  CompleteWorkoutResponse,
  LogExerciseSetRequest,
  LogExerciseSetResponse,
  LogExerciseSetsBatchRequest,
  LogExerciseSetsBatchResponse,
  MonthStatisticsRow,
  MonthWorkoutSummary,
  MonthlyProgressionSummaryRow,
  ResetMonthProgressResponse,
  SelectTrainingPlanRequest,
  SelectTrainingPlanResponse,
  StartMonthProgressResponse,
  UserActivePlanResponse,
  UserTrainingMonthItem,
  WeeklyBestPerformanceRow,
  WeightProgressionRow,
  WorkoutDetailResponse,
} from '../training.models';

/**
 * Cliente HTTP para os endpoints `/me/training/*`.
 *
 * O `authInterceptor` ja injeta `Authorization: Bearer <token>`, entao aqui
 * usamos somente o `HttpClient` cru. Endpoints publicos como `/exercises`
 * tambem ficam aqui por proximidade do dominio.
 */
@Injectable({
  providedIn: 'root',
})
export class TrainingApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl.replace(/\/$/, '');

  // -------- Parte 4: plano + meses --------

  selectTrainingPlan(
    body: SelectTrainingPlanRequest,
  ): Observable<SelectTrainingPlanResponse> {
    return this.http.post<SelectTrainingPlanResponse>(
      `${this.baseUrl}/me/training/plan`,
      body,
    );
  }

  getActivePlan(): Observable<UserActivePlanResponse> {
    return this.http.get<UserActivePlanResponse>(
      `${this.baseUrl}/me/training/plan`,
    );
  }

  listMonths(): Observable<UserTrainingMonthItem[]> {
    return this.http.get<UserTrainingMonthItem[]>(
      `${this.baseUrl}/me/training/months`,
    );
  }

  startMonth(monthNumber: number): Observable<StartMonthProgressResponse> {
    return this.http.post<StartMonthProgressResponse>(
      `${this.baseUrl}/me/training/months/${monthNumber}/start`,
      {},
    );
  }

  // -------- Parte 5: treinos do mes / treino do dia / detalhe --------

  listMonthWorkouts(monthId: string): Observable<MonthWorkoutSummary[]> {
    return this.http.get<MonthWorkoutSummary[]>(
      `${this.baseUrl}/me/training/months/${monthId}/workouts`,
    );
  }

  getWorkoutOfDay(
    dayNumber: number,
    monthId?: string | null,
  ): Observable<WorkoutDetailResponse> {
    let params = new HttpParams();
    if (monthId) {
      params = params.set('month_id', monthId);
    }
    return this.http.get<WorkoutDetailResponse>(
      `${this.baseUrl}/me/training/workouts/day/${dayNumber}`,
      { params },
    );
  }

  getWorkout(workoutId: string): Observable<WorkoutDetailResponse> {
    return this.http.get<WorkoutDetailResponse>(
      `${this.baseUrl}/me/training/workouts/${workoutId}`,
    );
  }

  // -------- Parte 6: conclusao, series, reset, relatorios --------

  completeWorkout(
    workoutId: string,
    body: CompleteWorkoutRequest,
  ): Observable<CompleteWorkoutResponse> {
    return this.http.post<CompleteWorkoutResponse>(
      `${this.baseUrl}/me/training/workouts/${workoutId}/complete`,
      body,
    );
  }

  logExerciseSet(
    completionId: string,
    body: LogExerciseSetRequest,
  ): Observable<LogExerciseSetResponse> {
    return this.http.post<LogExerciseSetResponse>(
      `${this.baseUrl}/me/training/workout-completions/${completionId}/sets`,
      body,
    );
  }

  logExerciseSetsBatch(
    completionId: string,
    body: LogExerciseSetsBatchRequest,
  ): Observable<LogExerciseSetsBatchResponse> {
    return this.http.post<LogExerciseSetsBatchResponse>(
      `${this.baseUrl}/me/training/workout-completions/${completionId}/sets/batch`,
      body,
    );
  }

  resetMonthProgress(monthId: string): Observable<ResetMonthProgressResponse> {
    return this.http.post<ResetMonthProgressResponse>(
      `${this.baseUrl}/me/training/months/${monthId}/progress/reset`,
      {},
    );
  }

  getMonthStatistics(monthId: string): Observable<MonthStatisticsRow> {
    return this.http.get<MonthStatisticsRow>(
      `${this.baseUrl}/me/training/months/${monthId}/statistics`,
    );
  }

  getWeightProgression(monthId: string): Observable<WeightProgressionRow[]> {
    return this.http.get<WeightProgressionRow[]>(
      `${this.baseUrl}/me/training/months/${monthId}/weight-progression`,
    );
  }

  getWeeklyPerformance(
    monthId: string,
  ): Observable<WeeklyBestPerformanceRow[]> {
    return this.http.get<WeeklyBestPerformanceRow[]>(
      `${this.baseUrl}/me/training/months/${monthId}/weekly-performance`,
    );
  }

  getProgressionSummary(
    monthId: string,
  ): Observable<MonthlyProgressionSummaryRow[]> {
    return this.http.get<MonthlyProgressionSummaryRow[]>(
      `${this.baseUrl}/me/training/months/${monthId}/progression-summary`,
    );
  }
}

/**
 * Tipagens espelhando o swagger das rotas /me/training.
 * Mantemos campos opcionais e `[key: string]: unknown` quando o backend pode
 * retornar campos extras, para nao quebrar a UI ao evoluir o contrato.
 */

/** Niveis de plano aceitos pelo POST /me/training/plan. */
export type TrainingLevel =
  | 'iniciante'
  | 'intermediario'
  | 'intermediário'
  | 'avancado'
  | 'avançado';

export interface SelectTrainingPlanRequest {
  level: TrainingLevel | string;
}

export interface SelectTrainingPlanResponse {
  selection_id: string;
  [key: string]: unknown;
}

export interface UserActivePlanResponse {
  plan_id: string;
  level: string;
  plan_name: string;
  selected_at: string;
  [key: string]: unknown;
}

export interface UserTrainingMonthItem {
  month_id: string;
  month_number: number;
  title: string;
  description?: string;
  /** Liberado pela idade da conta (regra de calendario na API). */
  active?: boolean;
  /** Quando a API envia, cruza meses por plano na home. */
  plan_id?: string;
  is_started: boolean;
  is_completed: boolean;
  started_at?: string | null;
  completed_at?: string | null;
  [key: string]: unknown;
}

export interface StartMonthProgressResponse {
  progress_id: string;
  [key: string]: unknown;
}

export interface MonthWorkoutSummary {
  workout_id: string;
  day_number: number;
  day_name: string;
  title: string;
  total_exercises: number;
  [key: string]: unknown;
}

/** Bloco `exercise` aninhado dentro de cada item do workout. */
export interface WorkoutExerciseInfo {
  id: string;
  name: string;
  equipment?: string;
  target_muscle?: string;
  instructions?: string;
  video_url?: string;
  video_embed_url?: string;
  thumbnail_url?: string;
  [key: string]: unknown;
}

/**
 * Item retornado em `GET /me/training/workouts/{id}` (o backend devolve
 * diretamente um array desses).
 */
export interface WorkoutExerciseEntry {
  workout_exercise_id: string;
  order_position?: number;
  sets: number;
  reps?: string;
  rest_time_seconds?: number;
  exercise: WorkoutExerciseInfo;
  [key: string]: unknown;
}

/**
 * Resposta do detalhe de treino. O backend hoje devolve apenas o array de
 * exercicios; mantemos campos opcionais de cabecalho (`title`, `day_number`,
 * `month_id`) para se a API enriquecer no futuro, mas a UI tambem cruza com
 * `listMonthWorkouts` para obter dia/titulo.
 */
export type WorkoutDetailResponse = WorkoutExerciseEntry[] | {
  workout_id?: string;
  day_number?: number;
  day_name?: string;
  title?: string;
  description?: string;
  month_id?: string;
  month_number?: number;
  exercises?: WorkoutExerciseEntry[];
  [key: string]: unknown;
};

export function extractWorkoutExercises(
  res: WorkoutDetailResponse | null | undefined,
): WorkoutExerciseEntry[] {
  if (!res) {
    return [];
  }
  if (Array.isArray(res)) {
    return res;
  }
  if (Array.isArray(res.exercises)) {
    return res.exercises;
  }
  return [];
}

export function extractWorkoutHeader(
  res: WorkoutDetailResponse | null | undefined,
): {
  workout_id?: string;
  day_number?: number;
  day_name?: string;
  title?: string;
  description?: string;
  month_id?: string;
} {
  if (!res || Array.isArray(res)) {
    return {};
  }
  const { workout_id, day_number, day_name, title, description, month_id } = res;
  return { workout_id, day_number, day_name, title, description, month_id };
}

export interface CompleteWorkoutRequest {
  week_number: number;
  notes?: string;
}

export interface CompleteWorkoutResponse {
  completion_id: string;
  [key: string]: unknown;
}

export interface LogExerciseSetRequest {
  workout_exercise_id: string;
  set_number: number;
  weight_used?: number;
  reps_completed?: number;
  notes?: string;
}

export interface LogExerciseSetResponse {
  set_id: string;
  [key: string]: unknown;
}

/** Corpo de `POST .../workout-completions/{id}/sets/batch`. */
export interface LogExerciseSetsBatchRequest {
  sets: LogExerciseSetRequest[];
}

/** Resposta do lote (estrutura livre conforme backend). */
export interface LogExerciseSetsBatchResponse {
  [key: string]: unknown;
}

export interface ResetMonthProgressResponse {
  reset: boolean;
  [key: string]: unknown;
}

export interface MonthStatisticsRow {
  total_workouts_completed?: number;
  total_exercises_completed?: number;
  total_sets_completed?: number;
  average_weight?: number;
  max_weight?: number;
  total_volume?: number;
  weeks_completed?: number;
  /** Percentual de conclusao do mes (0-100). */
  completion_percentage?: number;
  /** Campos legados (contratos antigos). */
  total_workouts?: number;
  completed_workouts?: number;
  total_sets?: number;
  total_volume_kg?: number;
  completion_rate?: number;
  [key: string]: unknown;
}

export interface WeightProgressionRow {
  exercise_id?: string;
  exercise_name?: string;
  equipment?: string;
  target_muscle?: string;
  week_number?: number;
  set_number?: number;
  weight_used?: number;
  reps_completed?: number;
  completed_at?: string;
  /** Legado. */
  recorded_at?: string;
  [key: string]: unknown;
}

export interface WeeklyBestPerformanceRow {
  exercise_id?: string;
  exercise_name?: string;
  equipment?: string;
  target_muscle?: string;
  week_number?: number;
  max_weight?: number;
  avg_weight?: number;
  total_sets?: number;
  avg_reps?: number;
  last_completed?: string;
  /** Legado. */
  best_weight?: number;
  best_reps?: number;
  [key: string]: unknown;
}

export interface MonthlyProgressionSummaryRow {
  exercise_name?: string;
  equipment?: string;
  target_muscle?: string;
  week1_weight?: number;
  initial_weight?: number;
  final_weight?: number;
  weight_gain?: number;
  percentage_gain?: number;
  exercise_id?: string;
  week_number?: number;
  total_sets?: number;
  total_reps?: number;
  total_volume_kg?: number;
  avg_weight?: number;
  [key: string]: unknown;
}

/** Util: trata strings de nivel ignorando acentos para comparar localmente. */
export function normalizeLevel(level: string): string {
  return level
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

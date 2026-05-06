/**
 * Alinha com `CREATE TYPE public.gender_type AS ENUM (...)` no PostgreSQL.
 */
export type GenderType =
  | 'feminino'
  | 'masculino'
  | 'outro'
  | 'prefiro_nao_dizer';

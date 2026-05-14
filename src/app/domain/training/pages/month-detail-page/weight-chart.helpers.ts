import type { WeightProgressionRow } from '../../training.models';

const SERIES_LINE_NAME = 'Carga (kg)';

export interface WeightExerciseChartBlock {
  exerciseName: string;
  /** Formato ngx-charts: uma linha por grafico. */
  results: { name: string; series: { name: string; value: number }[] }[];
}

function nextSeriesAxisLabel(
  r: WeightProgressionRow,
  usage: Map<string, number>,
): string {
  const sn =
    typeof r.set_number === 'number' && Number.isFinite(r.set_number)
      ? String(Math.trunc(r.set_number))
      : '?';
  const base = `S${sn}`;
  const next = (usage.get(base) ?? 0) + 1;
  usage.set(base, next);
  return next === 1 ? base : `${base} (${next})`;
}

export function buildWeightExerciseChartBlocks(
  rows: WeightProgressionRow[],
): WeightExerciseChartBlock[] {
  const valid = rows.filter((r) => {
    const t = r.completed_at ?? r.recorded_at;
    if (!t) {
      return false;
    }
    if (r.weight_used === null || r.weight_used === undefined) {
      return false;
    }
    return Number.isFinite(Number(r.weight_used));
  });

  const byName = new Map<string, WeightProgressionRow[]>();
  for (const r of valid) {
    const name =
      typeof r.exercise_name === 'string' && r.exercise_name.trim()
        ? r.exercise_name.trim()
        : 'Exercicio';
    const list = byName.get(name) ?? [];
    list.push(r);
    byName.set(name, list);
  }

  const out: WeightExerciseChartBlock[] = [];
  for (const [exerciseName, list] of byName) {
    list.sort(
      (a, b) =>
        new Date((a.completed_at ?? a.recorded_at)!).getTime() -
        new Date((b.completed_at ?? b.recorded_at)!).getTime(),
    );
    const usage = new Map<string, number>();
    const series = list.map((r) => ({
      name: nextSeriesAxisLabel(r, usage),
      value: Number(r.weight_used),
    }));
    out.push({
      exerciseName,
      results: [{ name: SERIES_LINE_NAME, series }],
    });
  }

  out.sort((a, b) =>
    a.exerciseName.localeCompare(b.exerciseName, 'pt-BR'),
  );
  return out;
}

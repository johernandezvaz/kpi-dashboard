export type ColorLabel = "red" | "yellow" | "green" | "neutral";

export type DbColor = "red" | "yellow" | "green";

export interface Process {
  code: string;
  label: string;
}

export interface Area {
  code: string;
  label: string;
}

export interface ScorecardCell {
  plantId: string;
  year: number;
  month: number;
  areaCode: string;
  processCode: string;
  ratio: number | null;
  totalScore: number | null;
  metricsCount: number | null;
}

export interface ProcessTotal {
  processCode: string;
  ratio: number | null;
  totalScore: number;
  metricsCount: number;
}

export interface MetricDetail {
  metricId: string;
  name: string;
  result: number;
  yellowLimit: number;
  greenLimit: number;
  responsible: string;
  higherIsBetter: boolean;
}

export const THRESHOLDS = {
  yellowMin: 0.6,
  greenMin: 0.75,
} as const;

export function getColor(ratio: number | null): ColorLabel {
  if (ratio === null) return "neutral";
  if (ratio < THRESHOLDS.yellowMin) return "red";
  if (ratio < THRESHOLDS.greenMin) return "yellow";
  return "green";
}

export function getMetricColor(metric: MetricDetail): ColorLabel {
  const { result, yellowLimit, greenLimit, higherIsBetter } = metric;
  let score: number;
  if (higherIsBetter) {
    score = result >= greenLimit ? 2 : result >= yellowLimit ? 1 : 0;
  } else {
    score = result <= greenLimit ? 2 : result <= yellowLimit ? 1 : 0;
  }
  return score === 2 ? "green" : score === 1 ? "yellow" : "red";
}

export function computeTotalRow(
  cells: ScorecardCell[],
  processes: Process[]
): ProcessTotal[] {
  return processes.map((proc) => {
    const colCells = cells.filter(
      (c) => c.processCode === proc.code && c.totalScore !== null && c.metricsCount !== null
    );

    const totalScore = colCells.reduce((sum, c) => sum + (c.totalScore ?? 0), 0);
    const metricsCount = colCells.reduce((sum, c) => sum + (c.metricsCount ?? 0), 0);

    const ratio = metricsCount > 0 ? totalScore / (2 * metricsCount) : null;

    return { processCode: proc.code, ratio, totalScore, metricsCount };
  });
}

export function computeOverallTotal(cells: ScorecardCell[]): number | null {
  const scored = cells.filter((c) => c.totalScore !== null && c.metricsCount !== null);
  const totalScore = scored.reduce((sum, c) => sum + (c.totalScore ?? 0), 0);
  const metricsCount = scored.reduce((sum, c) => sum + (c.metricsCount ?? 0), 0);
  return metricsCount > 0 ? totalScore / (2 * metricsCount) : null;
}

export interface AreaTotal {
  areaCode: string;
  ratio: number | null;
  totalScore: number;
  metricsCount: number;
}

export function computeAreaTotals(
  cells: ScorecardCell[],
  areas: Area[]
): AreaTotal[] {
  return areas.map((area) => {
    const rowCells = cells.filter(
      (c) => c.areaCode === area.code && c.totalScore !== null && c.metricsCount !== null
    );
    const totalScore = rowCells.reduce((sum, c) => sum + (c.totalScore ?? 0), 0);
    const metricsCount = rowCells.reduce((sum, c) => sum + (c.metricsCount ?? 0), 0);
    const ratio = metricsCount > 0 ? totalScore / (2 * metricsCount) : null;
    return { areaCode: area.code, ratio, totalScore, metricsCount };
  });
}

export interface DbCell {
  areaCode: string;
  processCode: string;
  metricsCount: number;
  totalScore: number;
  ratio: number;
  color: DbColor;
}

export interface DbProcessTotal {
  processCode: string;
  metricsCount: number;
  totalScore: number;
  ratio: number;
  color: DbColor;
}

export interface DbAreaTotal {
  areaCode: string;
  metricsCount: number;
  totalScore: number;
  ratio: number;
  color: DbColor;
}

export interface DbOverall {
  metricsCount: number;
  totalScore: number;
  ratio: number;
  color: DbColor;
}

export interface DbDimension {
  code: string;
  label: string;
  sortOrder: number;
}

export interface ScorecardApiPayload {
  cells: DbCell[];
  processTotals: DbProcessTotal[];
  areaTotals: DbAreaTotal[];
  overall: DbOverall | null;
  processes: DbDimension[];
  areas: DbDimension[];
}

export interface SelectorsApiPayload {
  plants: { id: string; code: string; label: string }[];
  periods: { year: number; month: number }[];
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface DbMetricRow {
  metricId: string;
  name: string;
  resultValue: number | null;
  yellowLimit: number | null;
  greenLimit: number | null;
  higherIsBetter: boolean;
  responsible: string;
  color: ColorLabel;
  extraLabel?: string;
}

export interface MetricHistoryPoint {
  label: string;
  result_value: number | null;
  yellow_limit: number | null;
  green_limit: number | null;
}

export function getDbMetricColor(row: {
  resultValue: number | null;
  yellowLimit: number | null;
  greenLimit: number | null;
  higherIsBetter: boolean;
}): ColorLabel {
  const { resultValue, yellowLimit, greenLimit, higherIsBetter } = row;
  if (resultValue === null || yellowLimit === null || greenLimit === null) return "neutral";
  return getMetricColor({
    metricId: "",
    name: "",
    result: resultValue,
    yellowLimit,
    greenLimit,
    responsible: "",
    higherIsBetter,
  });
}

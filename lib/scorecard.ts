export type ColorLabel = "red" | "yellow" | "green" | "neutral";

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

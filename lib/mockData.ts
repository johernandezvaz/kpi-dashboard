import type { ScorecardCell, Process, Area } from "./scorecard";

export interface Plant {
  id: string;
  label: string;
}

export const PLANTS: Plant[] = [{ id: "chihuahua", label: "Chihuahua" }];

export const YEARS: number[] = [2021, 2022];

export interface Month {
  value: number;
  label: string;
}

export const MONTHS: Month[] = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export const PROCESSES: Process[] = [
  { code: "P1", label: "P1" },
  { code: "P2", label: "P2" },
  { code: "C3", label: "C3" },
  { code: "C4", label: "C4" },
  { code: "S1", label: "S1" },
  { code: "S5", label: "S5" },
  { code: "S6", label: "S6" },
  { code: "S9", label: "S9" },
  { code: "S10", label: "S10" },
];

export const AREAS: Area[] = [
  { code: "Assy", label: "Assy" },
  { code: "CI", label: "CI" },
  { code: "Engineering", label: "Engineering" },
  { code: "Finances", label: "Finances" },
  { code: "HR", label: "HR" },
  { code: "HSE", label: "HSE" },
  { code: "LEAN", label: "LEAN" },
  { code: "Logistics", label: "Logistics" },
  { code: "Maintenance", label: "Maintenance" },
  { code: "Management", label: "Management" },
  { code: "Molding", label: "Molding" },
  { code: "Paint", label: "Paint" },
  { code: "QC", label: "QC" },
  { code: "Tool Room", label: "Tool Room" },
];

function cell(
  areaCode: string,
  processCode: string,
  ratio: number,
  metricsCount: number
): ScorecardCell {
  const totalScore = Math.round(ratio * 2 * metricsCount);
  return {
    plantId: "chihuahua",
    year: 2022,
    month: 5,
    areaCode,
    processCode,
    ratio,
    totalScore,
    metricsCount,
  };
}


export const MOCK_CELLS: ScorecardCell[] = [

  cell("Assy", "C4", 1.0, 3),
  cell("CI", "S10", 0.125, 8),
  cell("Engineering", "C3", 0.6, 5),
  cell("Finances", "P1", 0.5, 2),
  cell("Finances", "P2", 1.0, 1),
  cell("Finances", "C4", 0.5, 2),
  cell("Finances", "S6", 1.0, 2),
  cell("HR", "S10", 0.8333, 6),
  cell("HSE", "P2", 0.6, 5),
  cell("LEAN", "P1", 0.6667, 3),
  cell("LEAN", "C4", 0.0, 2),
  cell("Logistics", "C4", 0.7143, 7),
  cell("Logistics", "S1", 0.0, 3),
  cell("Logistics", "S10", 1.0, 2),
  cell("Maintenance", "S9", 1.0, 5),
  cell("Management", "P1", 0.8333, 6),
  cell("Molding", "C4", 1.0, 3),
  cell("Paint", "C4", 0.3, 5),
  cell("QC", "C3", 1.0, 5),
  cell("QC", "C4", 0.7143, 7),
  cell("QC", "S1", 1.0, 3),
  cell("QC", "S5", 1.0, 4),
  cell("QC", "S10", 0.0, 4),
  cell("Tool Room", "S9", 0.5, 2),
];

export function getCellsForPeriod(
  plantId: string,
  year: number,
  month: number
): ScorecardCell[] {
  return MOCK_CELLS.filter(
    (c) => c.plantId === plantId && c.year === year && c.month === month
  );
}

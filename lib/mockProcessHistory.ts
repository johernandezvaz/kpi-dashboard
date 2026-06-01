export interface ProcessHistoryRecord {
  year: number;
  month: number;
  areaCode: string;
  areaLabel: string;
  processCode: string;
  metricsCount: number;
  score: number;
}

export function getProcessHistory(_processCode: string): ProcessHistoryRecord[] {
  return [];
}

export function formatPeriod(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

"use client";

import { getColor } from "@/lib/scorecard";
import type { ScorecardCell as ScorecardCellType, ColorLabel } from "@/lib/scorecard";

interface ScorecardCellProps {
  cell: ScorecardCellType | null;
  onClick?: () => void;
}

const bgMap: Record<ColorLabel, string> = {
  red:     "bg-scorecard-red",
  yellow:  "bg-scorecard-yellow",
  green:   "bg-scorecard-green",
  neutral: "bg-scorecard-neutral",
};

const baseCellClass =
  "text-center align-middle text-[0.8rem] font-semibold whitespace-nowrap " +
  "border border-brand-navy/20 min-w-[68px] h-[38px] " +
  "transition-[filter] duration-100 hover:brightness-[0.93] " +
  "py-[0.45rem] px-[0.35rem]";

export default function ScorecardCell({ cell, onClick }: ScorecardCellProps) {
  if (!cell || cell.ratio === null) {
    return (
      <td
        className={`${baseCellClass} bg-scorecard-neutral`}
        aria-label="No data"
      />
    );
  }

  const color = getColor(cell.ratio);
  const label = `${(cell.ratio * 100).toFixed(1)}%`;

  return (
    <td
      className={`${baseCellClass} text-scorecard-cell-text ${bgMap[color]} cursor-pointer`}
      aria-label={`${cell.areaCode} ${cell.processCode}: ${label} — click to view metrics`}
      title={`Score: ${cell.totalScore} / ${2 * (cell.metricsCount ?? 0)} (${cell.metricsCount} metrics) — click to expand`}
      onClick={onClick}
    >
      {label}
    </td>
  );
}

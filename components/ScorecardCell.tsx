"use client";

import styles from "./ScorecardCell.module.css";
import { getColor } from "@/lib/scorecard";
import type { ScorecardCell as ScorecardCellType } from "@/lib/scorecard";

interface ScorecardCellProps {
  cell: ScorecardCellType | null;
}

export default function ScorecardCell({ cell }: ScorecardCellProps) {
  if (!cell || cell.ratio === null) {
    return <td className={`${styles.cell} ${styles.neutral}`} aria-label="No data" />;
  }

  const color = getColor(cell.ratio);
  const label = `${(cell.ratio * 100).toFixed(1)}%`;

  return (
    <td
      className={`${styles.cell} ${styles[color]}`}
      aria-label={`${cell.areaCode} ${cell.processCode}: ${label}`}
      title={`Score: ${cell.totalScore} / ${2 * (cell.metricsCount ?? 0)} (${cell.metricsCount} metrics)`}
    >
      {label}
    </td>
  );
}

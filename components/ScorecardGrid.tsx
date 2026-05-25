"use client";

import styles from "./ScorecardGrid.module.css";
import ScorecardCell from "./ScorecardCell";
import { computeTotalRow, getColor } from "@/lib/scorecard";
import type { ScorecardCell as ScorecardCellType, Area, Process } from "@/lib/scorecard";

interface ScorecardGridProps {
  cells: ScorecardCellType[];
  areas: Area[];
  processes: Process[];
}

export default function ScorecardGrid({ cells, areas, processes }: ScorecardGridProps) {
  // Build a lookup map: "AreaCode:ProcessCode" → ScorecardCell
  const cellMap = new Map<string, ScorecardCellType>();
  cells.forEach((c) => {
    cellMap.set(`${c.areaCode}:${c.processCode}`, c);
  });

  const totals = computeTotalRow(cells, processes);
  const totalMap = new Map(totals.map((t) => [t.processCode, t]));

  return (
    <div className={styles.wrapper}>
      <table className={styles.table} aria-label="KPI Scorecard">
        <thead>
          <tr>
            {/* Area column header */}
            <th className={`${styles.th} ${styles.areaHeader}`} scope="col">
              Area
            </th>
            {processes.map((p) => (
              <th key={p.code} className={styles.th} scope="col">
                {p.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {/* Area rows */}
          {areas.map((area) => (
            <tr key={area.code} className={styles.row}>
              <td className={styles.areaCell}>{area.label}</td>
              {processes.map((proc) => {
                const cell = cellMap.get(`${area.code}:${proc.code}`) ?? null;
                return <ScorecardCell key={proc.code} cell={cell} />;
              })}
            </tr>
          ))}

          {/* Total row — separated visually */}
          <tr className={`${styles.row} ${styles.totalRow}`}>
            <td className={`${styles.areaCell} ${styles.totalLabel}`}>Total</td>
            {processes.map((proc) => {
              const total = totalMap.get(proc.code);
              if (!total || total.metricsCount === 0) {
                return (
                  <td
                    key={proc.code}
                    className={`${styles.totalCell} ${styles.neutralTotal}`}
                  />
                );
              }
              const color = getColor(total.ratio);
              const label = total.ratio !== null
                ? `${(total.ratio * 100).toFixed(1)}%`
                : "—";
              return (
                <td
                  key={proc.code}
                  className={`${styles.totalCell} ${styles[color]}`}
                  title={`Score: ${total.totalScore} / ${2 * total.metricsCount} (${total.metricsCount} metrics)`}
                >
                  {label}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

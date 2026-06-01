"use client";

import { useRouter } from "next/navigation";
import ScorecardCell from "./ScorecardCell";
import { getColor } from "@/lib/scorecard";
import type {
  DbCell,
  DbProcessTotal,
  DbAreaTotal,
  DbDimension,
  ColorLabel,
} from "@/lib/scorecard";

interface ScorecardGridProps {
  cells: DbCell[];
  areas: DbDimension[];
  processes: DbDimension[];
  processTotals: DbProcessTotal[];
  areaTotals: DbAreaTotal[];
  overallRatio: number | null;
  overallColor: ColorLabel;
  plantId: string;
  plantLabel: string;
  year: number;
  month: number;
  monthLabel: string;
}

const totalBgMap: Record<ColorLabel, string> = {
  red: "bg-scorecard-red",
  yellow: "bg-scorecard-yellow",
  green: "bg-scorecard-green",
  neutral: "bg-scorecard-neutral",
};

const thClass =
  "bg-brand-navy text-brand-gray text-[0.7rem] font-bold uppercase tracking-[0.08em] " +
  "py-[0.6rem] px-[0.5rem] text-center border-b-2 border-b-brand-blue " +
  "border-r border-r-brand-blue/30 whitespace-nowrap";

const totalCellClass =
  "text-center align-middle text-[0.8rem] font-bold text-scorecard-cell-text " +
  "py-[0.45rem] px-[0.35rem] border border-app-border h-[38px]";

export default function ScorecardGrid({
  cells,
  areas,
  processes,
  processTotals,
  areaTotals,
  overallRatio,
  overallColor,
  plantId,
  year,
  month,
}: ScorecardGridProps) {
  const router = useRouter();

  const cellMap = new Map<string, DbCell>();
  cells.forEach((c) => {
    cellMap.set(`${c.areaCode}:${c.processCode}`, c);
  });

  const totalMap = new Map<string, DbProcessTotal>(
    processTotals.map((t) => [t.processCode, t])
  );

  const areaTotalMap = new Map<string, DbAreaTotal>(
    areaTotals.map((a) => [a.areaCode, a])
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-brand-gray bg-app-surface">
      <table className="border-collapse w-full min-w-[700px]" aria-label="KPI Scorecard">
        <thead>
          <tr>
            <th
              className={`${thClass} text-left pl-4 min-w-[120px] sticky left-0 z-10 bg-app-surface-2`}
              scope="col"
            >
              Area
            </th>
            {processes.map((p) => (
              <th key={p.code} className={thClass} scope="col" title={p.label}>
                {p.code}
              </th>
            ))}
            <th
              className={`${thClass} border-l-2 border-l-brand-blue/60`}
              scope="col"
            >
              Total
            </th>
          </tr>
        </thead>

        <tbody>
          {areas.map((area) => {
            return (
              <tr key={area.code}>
                <td
                  className={
                    `text-[0.8rem] font-semibold text-brand-navy px-4 ` +
                    `border-r-2 border-r-brand-navy/25 border-b border-b-brand-navy/25 ` +
                    `whitespace-nowrap sticky left-0 z-[1] h-[38px] align-middle bg-brand-gray`
                  }
                >
                  {area.label}
                </td>
                {processes.map((proc) => {
                  const cell = cellMap.get(`${area.code}:${proc.code}`) ?? null;
                  const legacyCell = cell
                    ? {
                      plantId,
                      year,
                      month,
                      areaCode: cell.areaCode,
                      processCode: cell.processCode,
                      ratio: cell.ratio,
                      totalScore: cell.totalScore,
                      metricsCount: cell.metricsCount,
                    }
                    : null;
                  return (
                    <ScorecardCell
                      key={proc.code}
                      cell={legacyCell}
                      onClick={
                        cell
                          ? () =>
                            router.push(
                              `/scorecard/${plantId}/${year}/${month}/${encodeURIComponent(area.code)}/${proc.code}`
                            )
                          : undefined
                      }
                    />
                  );
                })}
                {(() => {
                  const at = areaTotalMap.get(area.code);
                  if (!at || at.metricsCount === 0) {
                    return (
                      <td
                        className={`${totalCellClass} bg-scorecard-neutral border-l-2 border-l-brand-blue/40 bg-app-surface-2`}
                      />
                    );
                  }
                  const color: ColorLabel = (["red", "yellow", "green"].includes(at.color) ? at.color : getColor(at.ratio)) as ColorLabel;
                  const label = `${(at.ratio * 100).toFixed(1)}%`;
                  return (
                    <td
                      className={`${totalCellClass} ${totalBgMap[color]} border-l-2 border-l-brand-blue/40 cursor-pointer`}
                      title={`Score: ${at.totalScore} / ${2 * at.metricsCount} (${at.metricsCount} metrics) — click for detail`}
                      onClick={() =>
                        router.push(
                          `/scorecard/total/area/${encodeURIComponent(at.areaCode)}/${plantId}/${year}/${month}`
                        )
                      }
                    >
                      {label}
                    </td>
                  );
                })()}
              </tr>
            );
          })}

          <tr className="border-t-[3px] border-t-brand-navy/30">
            <td
              className={
                "text-[0.8rem] font-bold text-brand-navy uppercase tracking-[0.05em] px-4 " +
                "border-r-2 border-r-brand-navy/25 border-b border-b-brand-navy/25 " +
                "whitespace-nowrap sticky left-0 z-[1] h-[38px] align-middle bg-brand-gray"
              }
            >
              Total
            </td>
            {processes.map((proc) => {
              const total = totalMap.get(proc.code);
              if (!total || total.metricsCount === 0) {
                return (
                  <td
                    key={proc.code}
                    className={`${totalCellClass} bg-scorecard-neutral`}
                  />
                );
              }
              const color: ColorLabel = (["red", "yellow", "green"].includes(total.color) ? total.color : getColor(total.ratio)) as ColorLabel;
              const label = `${(total.ratio * 100).toFixed(1)}%`;
              return (
                <td
                  key={proc.code}
                  className={`${totalCellClass} ${totalBgMap[color]} cursor-pointer`}
                  title={`Score: ${total.totalScore} / ${2 * total.metricsCount} (${total.metricsCount} metrics) — click for detail`}
                  onClick={() =>
                    router.push(
                      `/scorecard/total/process/${proc.code}/${plantId}/${year}/${month}`
                    )
                  }
                >
                  {label}
                </td>
              );
            })}
            {(() => {
              const label = overallRatio !== null
                ? `${(overallRatio * 100).toFixed(1)}%`
                : "\u2014";
              return (
                <td
                  className={`${totalCellClass} ${totalBgMap[overallColor]} border-l-2 border-l-brand-blue/40`}
                  title={overallRatio !== null ? `Overall: ${(overallRatio * 100).toFixed(1)}%` : undefined}
                >
                  {label}
                </td>
              );
            })()}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

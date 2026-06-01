"use client";

import { useEffect, useCallback } from "react";
import { getColor } from "@/lib/scorecard";
import { getProcessHistory, formatPeriod } from "@/lib/mockProcessHistory";
import ProcessEvolutionChart from "@/components/ProcessEvolutionChart";
import type { ColorLabel } from "@/lib/scorecard";

interface ProcessHistoryModalProps {
  processCode: string;
  processLabel: string;
  plantLabel: string;
  onClose: () => void;
}

const colorBadge: Record<ColorLabel, string> = {
  green:   "bg-scorecard-green",
  yellow:  "bg-scorecard-yellow",
  red:     "bg-scorecard-red",
  neutral: "bg-scorecard-neutral",
};

const colorText: Record<ColorLabel, string> = {
  green:   "Green",
  yellow:  "Yellow",
  red:     "Red",
  neutral: "—",
};

export default function ProcessHistoryModal({
  processCode,
  processLabel,
  plantLabel,
  onClose,
}: ProcessHistoryModalProps) {
  const records = getProcessHistory(processCode);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/60 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Process history: ${processCode}`}
      onClick={onClose}
    >
      <div
        className="bg-app-surface rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-brand-navy/20 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-3 bg-brand-navy border-b-2 border-b-brand-blue shrink-0">
          <div className="flex flex-col gap-0.5">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-white/50">
              Process Trend — All Areas
            </span>
            <h2 className="text-[0.95rem] font-bold text-white tracking-[-0.01em]">
              Process {processLabel} &mdash; {plantLabel}
            </h2>
          </div>
          <button
            id="process-modal-close-btn"
            onClick={onClose}
            aria-label="Close process history modal"
            className="shrink-0 flex items-center justify-center w-7 h-7 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors duration-100"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="overflow-auto flex-1">
          {records.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-[0.85rem] text-app-muted">
              No historical data available for this process.
            </div>
          ) : (
            <table className="w-full border-collapse text-[0.8rem]" aria-label="Process history">
              <thead>
                <tr className="sticky top-0 z-10 bg-app-surface-2 border-b-2 border-b-brand-blue">
                  <th className="text-left py-[0.5rem] px-3 font-bold text-[0.7rem] uppercase tracking-[0.08em] text-app-muted whitespace-nowrap border-r border-r-brand-navy/15">
                    Period
                  </th>
                  <th className="text-left py-[0.5rem] px-3 font-bold text-[0.7rem] uppercase tracking-[0.08em] text-app-muted border-r border-r-brand-navy/15">
                    Area
                  </th>
                  <th className="text-center py-[0.5rem] px-3 font-bold text-[0.7rem] uppercase tracking-[0.08em] text-app-muted whitespace-nowrap border-r border-r-brand-navy/15">
                    Process
                  </th>
                  <th className="text-center py-[0.5rem] px-3 font-bold text-[0.7rem] uppercase tracking-[0.08em] text-app-muted whitespace-nowrap border-r border-r-brand-navy/15">
                    Score
                  </th>
                  <th className="text-center py-[0.5rem] px-3 font-bold text-[0.7rem] uppercase tracking-[0.08em] text-app-muted whitespace-nowrap border-r border-r-brand-navy/15">
                    Compliance
                  </th>
                  <th className="text-center py-[0.5rem] px-3 font-bold text-[0.7rem] uppercase tracking-[0.08em] text-app-muted whitespace-nowrap">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => {
                  const ratio = r.metricsCount > 0 ? r.score / (2 * r.metricsCount) : null;
                  const color = getColor(ratio);
                  const compliance = ratio !== null ? `${Math.round(ratio * 1000) / 10}%` : "—";
                  const rowBg = i % 2 === 1 ? "bg-app-surface-alt" : "bg-app-surface";
                  return (
                    <tr
                      key={`${r.year}-${r.month}-${r.areaCode}`}
                      className={`${rowBg} border-b border-b-brand-navy/10`}
                    >
                      <td className="py-[0.45rem] px-3 text-app-muted whitespace-nowrap border-r border-r-brand-navy/10">
                        {formatPeriod(r.year, r.month)}
                      </td>
                      <td className="py-[0.45rem] px-3 font-semibold text-brand-navy border-r border-r-brand-navy/10">
                        {r.areaLabel}
                      </td>
                      <td className="py-[0.45rem] px-3 text-center text-app-muted border-r border-r-brand-navy/10">
                        {r.processCode}
                      </td>
                      <td className="py-[0.45rem] px-3 text-center font-semibold text-app-text whitespace-nowrap border-r border-r-brand-navy/10">
                        {Math.round(r.score * 100) / 100}
                      </td>
                      <td className="py-[0.45rem] px-3 text-center font-semibold text-app-text whitespace-nowrap border-r border-r-brand-navy/10">
                        {compliance}
                      </td>
                      <td className="py-[0.45rem] px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center px-2 py-[0.15rem] rounded-full text-[0.68rem] font-bold text-scorecard-cell-text ${colorBadge[color]}`}
                        >
                          {colorText[color]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {records.length > 0 ? (
          <ProcessEvolutionChart records={records} processCode={processCode} />
        ) : null}

        <div className="px-5 py-2 border-t border-t-brand-navy/15 bg-app-surface-2 shrink-0 flex items-center justify-between gap-4">
          <span className="text-[0.72rem] text-app-muted">
            {records.length} record{records.length !== 1 ? "s" : ""}
          </span>
          <button
            id="process-modal-close-footer-btn"
            onClick={onClose}
            className="text-[0.78rem] font-semibold text-brand-blue hover:text-brand-navy transition-colors duration-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

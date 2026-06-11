"use client";

import { useState, useEffect } from "react";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface MonthSlot {
  year: number;
  month: number;
}

interface MonthCell {
  year: number;
  month: number;
  value: number | null;
  yellowLimit: number | null;
  greenLimit: number | null;
  color: string;
}

interface RangeInfo {
  yellowLimit: number | null;
  greenLimit: number | null;
  aggregatedValue: number | null;
  color: string;
}

interface RangeMetric {
  metricId: string;
  name: string;
  unit: string | null;
  higherIsBetter: boolean;
  extraLabel?: string;
  range: RangeInfo;
  months: MonthCell[];
}

interface RangeDetailPanelProps {
  apiUrl: string;
  extraColumnHeader?: string;
}

const colorBg: Record<string, string> = {
  green: "bg-scorecard-green",
  yellow: "bg-scorecard-yellow",
  red: "bg-scorecard-red",
  neutral: "bg-scorecard-neutral",
};

const thClass = "text-left py-[0.45rem] px-2 font-bold text-[0.68rem] uppercase tracking-[0.08em] text-app-muted whitespace-nowrap border-r border-r-brand-navy/15 bg-app-surface-2";
const thMonthClass = "text-center py-[0.45rem] px-1.5 font-bold text-[0.62rem] uppercase tracking-[0.06em] text-app-muted whitespace-nowrap border-l border-l-brand-navy/10 bg-app-surface-2";

export default function RangeDetailPanel({ apiUrl, extraColumnHeader }: RangeDetailPanelProps) {
  const [metrics, setMetrics] = useState<RangeMetric[] | null>(null);
  const [monthSlots, setMonthSlots] = useState<MonthSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(apiUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setMetrics(d.metrics ?? []);
        setMonthSlots(d.monthSlots ?? []);
      })
      .catch(() => setError("Could not load range detail data."))
      .finally(() => setLoading(false));
  }, [apiUrl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[0.85rem] text-app-muted gap-2">
        <span className="w-4 h-4 rounded-full border-2 border-brand-blue border-t-transparent animate-spin" />
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16 text-[0.85rem] text-scorecard-red">
        {error}
      </div>
    );
  }

  if (!metrics || metrics.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-[0.85rem] text-app-muted">
        No data available for this range.
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-[0.78rem]" aria-label="Range metric detail">
        <thead>
          <tr className="border-b-2 border-b-brand-blue">
            {extraColumnHeader && <th className={thClass}>{extraColumnHeader}</th>}
            <th className={thClass}>Metric #</th>
            <th className={`${thClass} min-w-[150px]`}>Name</th>
            <th className={`${thClass} text-center`}>Unit</th>
            <th className={`${thClass} text-center`}>↑?</th>
            <th className={`${thClass} text-center`}>Range avg</th>
            <th className="text-center py-[0.45rem] px-2 font-bold text-[0.68rem] uppercase tracking-[0.08em] text-app-muted whitespace-nowrap bg-app-surface-2">
              Status
            </th>
            {monthSlots.map((s) => (
              <th key={`${s.year}-${s.month}`} className={thMonthClass}>
                {MONTH_ABBR[s.month - 1]}{monthSlots.some(o => o.year !== s.year) ? ` '${String(s.year).slice(2)}` : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m, i) => {
            const rowBg = i % 2 === 1 ? "bg-app-surface-alt" : "bg-app-surface";
            return (
              <tr key={m.metricId} className={`${rowBg} border-b border-b-brand-navy/10`}>
                {extraColumnHeader && (
                  <td className="py-[0.4rem] px-2 text-[0.72rem] font-semibold text-brand-navy whitespace-nowrap border-r border-r-brand-navy/10">
                    {m.extraLabel ?? "—"}
                  </td>
                )}
                <td className="py-[0.4rem] px-2 font-mono text-app-muted whitespace-nowrap border-r border-r-brand-navy/10">
                  {m.metricId}
                </td>
                <td className="py-[0.4rem] px-2 text-app-text border-r border-r-brand-navy/10">
                  {m.name}
                </td>
                <td className="py-[0.4rem] px-2 text-center text-app-muted whitespace-nowrap border-r border-r-brand-navy/10">
                  {m.unit ?? "—"}
                </td>
                <td className="py-[0.4rem] px-2 text-center text-app-muted whitespace-nowrap border-r border-r-brand-navy/10">
                  {m.higherIsBetter ? "↑" : "↓"}
                </td>
                <td className="py-[0.4rem] px-2 text-center font-semibold text-app-text whitespace-nowrap border-r border-r-brand-navy/10 bg-brand-navy/5">
                  {m.range.aggregatedValue !== null
                    ? String(Math.round(m.range.aggregatedValue * 1000) / 1000)
                    : "—"}
                </td>
                <td className="py-[0.4rem] px-2 text-center border-r border-r-brand-navy/10">
                  <span
                    className={`inline-flex items-center justify-center px-2 py-[0.1rem] rounded-full text-[0.65rem] font-bold text-scorecard-cell-text ${colorBg[m.range.color] ?? "bg-scorecard-neutral"}`}
                  >
                    {m.range.color === "green" ? "✓" : m.range.color === "yellow" ? "~" : m.range.color === "red" ? "✗" : "—"}
                  </span>
                </td>
                {m.months.map((mc) => (
                  <td
                    key={`${mc.year}-${mc.month}`}
                    className={`py-[0.4rem] px-1 text-center text-[0.7rem] font-semibold whitespace-nowrap border-l border-l-brand-navy/10 text-scorecard-cell-text ${colorBg[mc.color] ?? "bg-scorecard-neutral"}`}
                    title={mc.value !== null ? `${MONTH_ABBR[mc.month - 1]} ${mc.year}: ${mc.value}` : undefined}
                  >
                    {mc.value !== null ? String(Math.round(mc.value * 100) / 100) : "—"}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-4 py-2 border-t border-t-brand-navy/15 bg-app-surface-2">
        <span className="text-[0.72rem] text-app-muted">
          {metrics.length} metric{metrics.length !== 1 ? "s" : ""} · {monthSlots.length} month{monthSlots.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import EvolutionChart from "@/components/EvolutionChart";
import MetricEvolutionChart from "@/components/MetricEvolutionChart";
import type {
  TrendPoint,
  DbMetricRow,
  MetricHistoryPoint,
  ColorLabel,
} from "@/lib/scorecard";

interface DetailChartPanelProps {
  plantCode: string;
  generalSeries: TrendPoint[];
  generalKey: string;
  pageLabel: string;
  metrics: DbMetricRow[];
  extraColumnHeader?: string;
}

const colorBadge: Record<ColorLabel, string> = {
  green: "bg-scorecard-green",
  yellow: "bg-scorecard-yellow",
  red: "bg-scorecard-red",
  neutral: "bg-scorecard-neutral",
};

const colorLabel: Record<ColorLabel, string> = {
  green: "Green",
  yellow: "Yellow",
  red: "Red",
  neutral: "—",
};

const thClass =
  "text-left py-[0.5rem] px-3 font-bold text-[0.7rem] uppercase tracking-[0.08em] text-app-muted whitespace-nowrap border-r border-r-brand-navy/15";

export default function DetailChartPanel({
  plantCode,
  generalSeries,
  generalKey,
  pageLabel,
  metrics,
  extraColumnHeader,
}: DetailChartPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [metricPoints, setMetricPoints] = useState<MetricHistoryPoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  async function handleRowClick(metricId: string, metricName: string) {
    if (selectedId === metricId) {
      setSelectedId(null);
      setSelectedName(null);
      setMetricPoints(null);
      setFetchError(false);
      return;
    }
    setSelectedId(metricId);
    setSelectedName(metricName);
    setMetricPoints(null);
    setFetchError(false);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/metric-history?plant=${encodeURIComponent(plantCode)}&metric_id=${encodeURIComponent(metricId)}`
      );
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setMetricPoints(data.points ?? []);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }

  function handleGeneralClick() {
    setSelectedId(null);
    setSelectedName(null);
    setMetricPoints(null);
    setFetchError(false);
  }

  return (
    <>
      <div className="overflow-auto">
        {metrics.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-[0.85rem] text-app-muted">
            No detail data available.
          </div>
        ) : (
          <table
            className="w-full border-collapse text-[0.8rem]"
            aria-label="Individual metrics"
          >
            <thead>
              <tr className="bg-app-surface-2 border-b-2 border-b-brand-blue">
                {extraColumnHeader && (
                  <th className={thClass}>{extraColumnHeader}</th>
                )}
                <th className={thClass}>Metric #</th>
                <th className={`${thClass} min-w-[160px]`}>Metric Name</th>
                <th className={`${thClass} text-center`}>Result</th>
                <th className={`${thClass} text-center`}>Yellow Limit</th>
                <th className={`${thClass} text-center`}>Green Limit</th>
                <th className={thClass}>Responsible</th>
                <th className="text-center py-[0.5rem] px-3 font-bold text-[0.7rem] uppercase tracking-[0.08em] text-app-muted whitespace-nowrap">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m, i) => {
                const isSelected = selectedId === m.metricId;
                const rowBg = isSelected
                  ? "bg-brand-blue/10 ring-1 ring-inset ring-brand-blue/40"
                  : i % 2 === 1
                  ? "bg-app-surface-alt"
                  : "bg-app-surface";
                return (
                  <tr
                    key={m.metricId}
                    className={`${rowBg} border-b border-b-brand-navy/10 cursor-pointer hover:bg-brand-blue/5 transition-colors duration-75`}
                    onClick={() => handleRowClick(m.metricId, m.name)}
                    title={isSelected ? "Click to return to General view" : "Click to view metric history"}
                  >
                    {extraColumnHeader && (
                      <td className="py-[0.45rem] px-3 text-[0.75rem] font-semibold text-brand-navy whitespace-nowrap border-r border-r-brand-navy/10">
                        {m.extraLabel ?? "—"}
                      </td>
                    )}
                    <td className="py-[0.45rem] px-3 font-mono text-app-muted whitespace-nowrap border-r border-r-brand-navy/10">
                      {m.metricId}
                    </td>
                    <td className="py-[0.45rem] px-3 text-app-text border-r border-r-brand-navy/10">
                      {m.name}
                    </td>
                    <td className="py-[0.45rem] px-3 text-center font-semibold text-app-text whitespace-nowrap border-r border-r-brand-navy/10">
                      {m.resultValue !== null ? String(Math.round(m.resultValue * 1000) / 1000) : "—"}
                    </td>
                    <td className="py-[0.45rem] px-3 text-center text-app-muted whitespace-nowrap border-r border-r-brand-navy/10">
                      {m.yellowLimit !== null ? String(m.yellowLimit) : "—"}
                    </td>
                    <td className="py-[0.45rem] px-3 text-center text-app-muted whitespace-nowrap border-r border-r-brand-navy/10">
                      {m.greenLimit !== null ? String(m.greenLimit) : "—"}
                    </td>
                    <td className="py-[0.45rem] px-3 text-app-muted whitespace-nowrap border-r border-r-brand-navy/10">
                      {m.responsible}
                    </td>
                    <td className="py-[0.45rem] px-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center px-2 py-[0.15rem] rounded-full text-[0.68rem] font-bold text-scorecard-cell-text ${colorBadge[m.color]}`}
                      >
                        {colorLabel[m.color]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="px-5 pt-3 pb-1 border-t border-t-brand-navy/15 flex items-center gap-2">
        <button
          onClick={handleGeneralClick}
          className={`px-3 py-1 rounded text-[0.72rem] font-semibold transition-colors duration-100 ${
            selectedId === null
              ? "bg-brand-navy text-white"
              : "bg-app-surface-2 text-app-muted hover:bg-brand-gray hover:text-brand-navy"
          }`}
        >
          General
        </button>
        {selectedId !== null && selectedName && (
          <span className="text-[0.72rem] text-brand-navy font-semibold bg-brand-blue/10 px-3 py-1 rounded truncate max-w-[280px]">
            {selectedName}
          </span>
        )}
      </div>

      {selectedId === null ? (
        generalSeries.length > 0 ? (
          <EvolutionChart series={generalSeries} cellKey={generalKey} />
        ) : (
          <div className="px-5 py-4 border-t border-t-brand-navy/15 flex items-center justify-center text-[0.8rem] text-app-muted">
            No historical data available.
          </div>
        )
      ) : loading ? (
        <div className="px-5 py-6 border-t border-t-brand-navy/15 flex items-center justify-center">
          <div className="flex items-center gap-2 text-[0.8rem] text-app-muted">
            <span className="w-4 h-4 rounded-full border-2 border-brand-blue border-t-transparent animate-spin" />
            Loading…
          </div>
        </div>
      ) : fetchError ? (
        <div className="px-5 py-4 border-t border-t-brand-navy/15 flex items-center justify-center text-[0.8rem] text-scorecard-red">
          Could not load metric history.
        </div>
      ) : metricPoints !== null && metricPoints.length > 0 ? (
        <MetricEvolutionChart metricName={selectedName ?? ""} points={metricPoints} />
      ) : (
        <div className="px-5 py-4 border-t border-t-brand-navy/15 flex items-center justify-center text-[0.8rem] text-app-muted">
          No historical data for this metric.
        </div>
      )}
    </>
  );
}

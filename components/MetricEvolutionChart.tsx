"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { MetricHistoryPoint } from "@/lib/scorecard";
import { linearRegression } from "@/lib/regression";
import Smiley from "@/components/Smiley";

interface MetricEvolutionChartProps {
  metricName: string;
  points: MetricHistoryPoint[];
  higherIsBetter: boolean;
  cumplimientoColor: "red" | "yellow" | "green" | "neutral";
}

interface TooltipPayload {
  name: string;
  value: number | null;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-brand-navy text-white text-[0.75rem] font-semibold px-3 py-2 rounded-md shadow-lg space-y-0.5">
      <p className="text-white/50 text-[0.68rem] mb-1">{label}</p>
      {payload
        .filter((p) => p.value !== null && p.name !== "trend")
        .map((p) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name === "result"
              ? "Result"
              : p.name === "greenLimit"
              ? "Green limit"
              : "Yellow limit"}
            : {Math.round((p.value ?? 0) * 100) / 100}
          </p>
        ))}
    </div>
  );
}

export function TrendArrow({ slope, higherIsBetter }: { slope: number; higherIsBetter: boolean }) {
  if (Math.abs(slope) < 0.001) {
    return (
      <span className="text-app-muted text-lg leading-none" title="Flat trend">
        →
      </span>
    );
  }

  const isImproving =
    (higherIsBetter && slope > 0) ||
    (!higherIsBetter && slope < 0);

  const arrow = slope > 0 ? "↑" : "↓";
  const colorClass = isImproving ? "text-scorecard-green" : "text-scorecard-red";
  const titleText = isImproving ? "Improving trend" : "Worsening trend";

  return (
    <span className={`${colorClass} text-lg leading-none`} title={titleText}>
      {arrow}
    </span>
  );
}

export default function MetricEvolutionChart({
  metricName,
  points,
  higherIsBetter,
  cumplimientoColor,
}: MetricEvolutionChartProps) {
  const resultVals = points.map((p) => p.result_value);
  const { slope, trendValues } = linearRegression(resultVals);

  const chartData = points.map((p, i) => ({
    label: p.label,
    result: p.result_value,
    greenLimit: p.green_limit,
    yellowLimit: p.yellow_limit,
    trend: trendValues[i],
  }));

  return (
    <div className="px-5 pb-5 pt-4 border-t border-t-brand-navy/15 shrink-0">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-app-muted truncate flex-1">
          {metricName}
        </p>
        <TrendArrow slope={slope} higherIsBetter={higherIsBetter} />
        <Smiley state={cumplimientoColor} />
      </div>

      <div style={{ height: 200 }}>
        <ResponsiveContainer key={metricName} width="100%" height={200}>
          <LineChart
            data={chartData}
            margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#0e254e"
              strokeOpacity={0.1}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#6b7280", fontWeight: 500 }}
              axisLine={{ stroke: "#0e254e", strokeOpacity: 0.15 }}
              tickLine={false}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 11, fill: "#6b7280", fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(v: number) => String(Math.round(v * 100) / 100)}
            />
            <Tooltip content={<CustomTooltip />} />

            <Line
              type="monotone"
              dataKey="greenLimit"
              name="greenLimit"
              stroke="#4caf72"
              strokeWidth={1.5}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="yellowLimit"
              name="yellowLimit"
              stroke="#f5c518"
              strokeWidth={1.5}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="trend"
              name="trend"
              stroke="#9ca3af"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              connectNulls={true}
            />
            <Line
              type="monotone"
              dataKey="result"
              name="result"
              stroke="#1d559a"
              strokeWidth={2}
              dot={{ r: 3, fill: "#1d559a", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#1d559a", strokeWidth: 0 }}
              isAnimationActive={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-4 mt-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-[0.68rem] text-app-muted">
          <span className="inline-block w-5 border-t-2 border-[#1d559a]" />
          Result
        </span>
        <span className="flex items-center gap-1.5 text-[0.68rem] text-app-muted">
          <span className="inline-block w-5 border-t-2 border-scorecard-green" />
          Green limit
        </span>
        <span className="flex items-center gap-1.5 text-[0.68rem] text-app-muted">
          <span className="inline-block w-5 border-t-2 border-scorecard-yellow" />
          Yellow limit
        </span>
        <span className="flex items-center gap-1.5 text-[0.68rem] text-app-muted">
          <span className="inline-block w-5 border-t-2 border-dashed border-app-muted opacity-70" />
          Trend
        </span>
      </div>
    </div>
  );
}

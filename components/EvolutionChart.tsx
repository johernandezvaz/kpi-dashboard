"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { TrendPoint } from "@/lib/scorecard";

interface EvolutionChartProps {
  series: TrendPoint[];
  cellKey: string;
}

interface TooltipPayload {
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const val = Math.round(payload[0].value * 10) / 10;
  return (
    <div className="bg-brand-navy text-white text-[0.75rem] font-semibold px-3 py-[0.35rem] rounded-md shadow-lg">
      <span className="text-white/60 mr-2">{label}</span>
      {val.toFixed(1)}%
    </div>
  );
}

export default function EvolutionChart({ series, cellKey }: EvolutionChartProps) {
  return (
    <div className="px-5 pb-5 pt-4 border-t border-t-brand-navy/15 shrink-0">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-app-muted mb-3">
        Evolution
      </p>

      <div style={{ height: 200 }}>
        <ResponsiveContainer key={cellKey} width="100%" height={200}>
          <LineChart
            data={series}
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
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 11, fill: "#6b7280", fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              width={42}
              ticks={[0, 25, 50, 75, 100]}
            />
            <ReferenceLine
              y={75}
              stroke="#4caf72"
              strokeDasharray="4 3"
              strokeOpacity={0.55}
              strokeWidth={1}
            />
            <ReferenceLine
              y={60}
              stroke="#f5c518"
              strokeDasharray="4 3"
              strokeOpacity={0.55}
              strokeWidth={1}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#1d559a"
              strokeWidth={2}
              dot={{ r: 3, fill: "#1d559a", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#1d559a", strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-4 mt-2">
        <span className="flex items-center gap-1.5 text-[0.68rem] text-app-muted">
          <span className="inline-block w-5 border-t-2 border-dashed border-scorecard-green opacity-70" />
          Green (≥ 75%)
        </span>
        <span className="flex items-center gap-1.5 text-[0.68rem] text-app-muted">
          <span className="inline-block w-5 border-t-2 border-dashed border-scorecard-yellow opacity-70" />
          Yellow (≥ 60%)
        </span>
      </div>
    </div>
  );
}

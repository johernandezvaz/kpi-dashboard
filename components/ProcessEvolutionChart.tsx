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
  Legend,
} from "recharts";
import type { ProcessHistoryRecord } from "@/lib/mockProcessHistory";

interface ProcessEvolutionChartProps {
  records: ProcessHistoryRecord[];
  processCode: string;
}

const AREA_COLORS = [
  "#1d559a",
  "#0ea5e9",
  "#6366f1",
  "#8b5cf6",
  "#14b8a6",
  "#f59e0b",
  "#ec4899",
  "#10b981",
];

interface TooltipEntry {
  color: string;
  name: string;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-brand-navy text-white text-[0.73rem] font-medium px-3 py-2 rounded-md shadow-lg min-w-[130px]">
      <p className="text-white/50 text-[0.68rem] font-semibold uppercase tracking-[0.06em] mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name}
          </span>
          <span className="font-bold">{(Math.round(entry.value * 10) / 10).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export default function ProcessEvolutionChart({ records, processCode }: ProcessEvolutionChartProps) {
  const sortedPeriodKeys = [
    ...new Set(
      records.map((r) => `${r.year}-${String(r.month).padStart(2, "0")}`)
    ),
  ].sort();

  const areaKeys = [...new Set(records.map((r) => r.areaCode))];

  const chartData = sortedPeriodKeys.map((pk) => {
    const [yearStr, monthStr] = pk.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const label = `${SHORT_MONTHS[month - 1]} ${String(year).slice(2)}`;

    const point: Record<string, string | number> = { label };
    areaKeys.forEach((areaCode) => {
      const rec = records.find(
        (r) => r.year === year && r.month === month && r.areaCode === areaCode
      );
      if (rec && rec.metricsCount > 0) {
        point[areaCode] = Math.round((rec.score / (2 * rec.metricsCount)) * 1000) / 10;
      }
    });
    return point;
  });

  return (
    <div className="px-5 pb-5 pt-4 border-t border-t-brand-navy/15 shrink-0">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-app-muted mb-3">
        Evolution by Area
      </p>

      <div style={{ height: 220 }}>
        <ResponsiveContainer key={processCode} width="100%" height={220}>
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
              tick={{ fontSize: 10, fill: "#6b7280", fontWeight: 500 }}
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
            <Legend
              iconType="circle"
              iconSize={7}
              wrapperStyle={{ fontSize: "0.68rem", paddingTop: "6px", color: "#6b7280" }}
            />
            {areaKeys.map((areaCode, i) => (
              <Line
                key={areaCode}
                type="monotone"
                dataKey={areaCode}
                name={areaCode}
                stroke={AREA_COLORS[i % AREA_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: AREA_COLORS[i % AREA_COLORS.length] }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
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

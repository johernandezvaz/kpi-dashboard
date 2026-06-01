"use client";

import { getColor } from "@/lib/scorecard";
import type { ColorLabel } from "@/lib/scorecard";

interface OverallBadgeProps {
  ratio: number | null;
}

const bgMap: Record<ColorLabel, string> = {
  green:   "bg-scorecard-green",
  yellow:  "bg-scorecard-yellow",
  red:     "bg-scorecard-red",
  neutral: "bg-scorecard-neutral border border-app-border",
};

const textMap: Record<ColorLabel, string> = {
  green:   "text-scorecard-cell-text",
  yellow:  "text-scorecard-cell-text",
  red:     "text-scorecard-cell-text",
  neutral: "text-app-muted",
};

export default function OverallBadge({ ratio }: OverallBadgeProps) {
  const color = getColor(ratio);
  const label = ratio !== null ? `${(ratio * 100).toFixed(1)}%` : "—";

  return (
    <div
      className={`flex flex-col items-center justify-center min-w-[110px] px-5 py-[0.55rem] rounded-lg gap-[0.1rem] ${bgMap[color]}`}
      aria-label={`Overall compliance: ${label}`}
    >
      <span className={`text-[0.65rem] font-bold uppercase tracking-[0.1em] opacity-75 ${textMap[color]}`}>
        Overall
      </span>
      <span className={`text-[1.35rem] font-bold leading-none ${textMap[color]}`}>
        {label}
      </span>
    </div>
  );
}

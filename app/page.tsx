"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import PeriodSelector from "@/components/PeriodSelector";
import type { Plant, Month } from "@/components/PeriodSelector";
import OverallBadge from "@/components/OverallBadge";
import ScorecardGrid from "@/components/ScorecardGrid";
import UserMenu from "@/components/UserMenu";
import { getColor } from "@/lib/scorecard";
import type { ScorecardApiPayload, SelectorsApiPayload, ColorLabel } from "@/lib/scorecard";

const MONTH_NAMES: Month[] = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function monthLabel(m: number): string {
  return MONTH_NAMES.find((x) => x.value === m)?.label ?? String(m);
}



function ScorecardPageContent() {
  const searchParams = useSearchParams();

  const [plants, setPlants] = useState<Plant[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [months, setMonths] = useState<Month[]>([]);

  const [plantId, setPlantId] = useState<string>("");
  const [year, setYear] = useState<number>(0);
  const [month, setMonth] = useState<number>(0);

  const [data, setData] = useState<ScorecardApiPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/scorecard/selectors")
      .then((r) => r.json() as Promise<SelectorsApiPayload>)
      .then(({ plants: dbPlants, periods }) => {
        setPlants(dbPlants);

        const uniqueYears = [...new Set(periods.map((p) => p.year))].sort((a, b) => a - b);
        const uniqueMonths = [...new Set(periods.map((p) => p.month))].sort((a, b) => a - b);
        setYears(uniqueYears);
        setMonths(uniqueMonths.map((m) => ({ value: m, label: monthLabel(m) })));


        const rawPlant = searchParams.get("plant");
        const rawYear = searchParams.get("year");
        const rawMonth = searchParams.get("month");

        const initPlant = dbPlants.find((p) => p.id === rawPlant)?.id ?? dbPlants[0]?.id ?? "";
        const parsedYear = rawYear ? parseInt(rawYear, 10) : NaN;
        const parsedMonth = rawMonth ? parseInt(rawMonth, 10) : NaN;
        const initYear = uniqueYears.includes(parsedYear) ? parsedYear : uniqueYears[0] ?? 0;
        const initMonth = uniqueMonths.includes(parsedMonth) ? parsedMonth : uniqueMonths[0] ?? 0;

        setPlantId(initPlant);
        setYear(initYear);
        setMonth(initMonth);
      })
      .catch((err) => {
        console.error("Failed to load selectors:", err);
        setError("Could not load plant/period list from the database.");
      });
  }, []);

  const fetchScorecard = useCallback((plant: string, y: number, m: number) => {
    if (!plant || !y || !m) return;
    setLoading(true);
    setError(null);
    fetch(`/api/scorecard?plant=${encodeURIComponent(plant)}&year=${y}&month=${m}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ScorecardApiPayload>;
      })
      .then((payload) => {
        setData(payload);
      })
      .catch((err) => {
        console.error("Failed to load scorecard:", err);
        setError("No data found for this plant and period.");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (plantId && year && month) {
      fetchScorecard(plantId, year, month);
    }
  }, [plantId, year, month, fetchScorecard]);

  const selectedMonthLabel = months.find((m) => m.value === month)?.label ?? "";
  const selectedPlantLabel = plants.find((p) => p.id === plantId)?.label ?? plantId;

  const overallRatio: number | null = data?.overall?.ratio ?? null;
  const overallColor: ColorLabel =
    data?.overall?.color && ["red", "yellow", "green"].includes(data.overall.color)
      ? (data.overall.color as ColorLabel)
      : getColor(overallRatio);

  const cellCount = data?.cells.length ?? 0;

  return (
    <div className="flex flex-col min-h-screen pb-8">
      <header className="flex items-center justify-between gap-6 flex-wrap px-6 py-[0.875rem] bg-brand-navy border-b-2 border-b-brand-blue sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Image
            src="/safe-demo_logo-blc-Photoroom.png"
            alt="Safe Demo"
            width={140}
            height={40}
            className="h-10 w-auto object-contain"
            priority
          />
          <h1 className="text-xl font-bold text-white tracking-[-0.01em]">CDI DTC</h1>
        </div>

        <div className="flex-1 flex justify-center">
          <PeriodSelector
            plants={plants}
            years={years}
            months={months}
            selectedPlant={plantId}
            selectedYear={year}
            selectedMonth={month}
            onPlantChange={setPlantId}
            onYearChange={setYear}
            onMonthChange={setMonth}
          />
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <OverallBadge ratio={overallRatio} />
          <UserMenu />
        </div>
      </header>

      <div className="flex items-center justify-between px-6 py-2 text-[0.8rem] font-semibold text-brand-navy bg-brand-gray border-b border-b-brand-navy/20 tracking-[0.02em]">
        <span>
          {selectedPlantLabel} &mdash; {selectedMonthLabel} {year}
        </span>
        <span className="text-[0.75rem] font-medium">
          {loading
            ? "Loading…"
            : error
              ? "⚠ " + error
              : `${cellCount} active metric group${cellCount !== 1 ? "s" : ""}`}
        </span>
      </div>

      <main className="p-6 flex-1">
        {data && !loading ? (
          <ScorecardGrid
            cells={data.cells}
            areas={data.areas}
            processes={data.processes}
            processTotals={data.processTotals}
            areaTotals={data.areaTotals}
            overallRatio={overallRatio}
            overallColor={overallColor}
            plantId={plantId}
            plantLabel={selectedPlantLabel}
            year={year}
            month={month}
            monthLabel={selectedMonthLabel}
          />
        ) : loading ? (
          <div className="flex items-center justify-center h-40 text-brand-navy/50 text-sm">
            Loading scorecard data…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-40 text-red-600 text-sm">
            {error}
          </div>
        ) : null}
      </main>

      <footer className="px-6 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-[0.625rem] flex-wrap">
          <span className="text-[0.72rem] font-semibold text-brand-navy uppercase tracking-[0.06em]">
            Thresholds:
          </span>
          <span className="inline-flex items-center px-[0.65rem] py-[0.2rem] rounded-full text-[0.72rem] font-semibold text-scorecard-cell-text bg-scorecard-green">
            ≥ 75% — Compliant
          </span>
          <span className="inline-flex items-center px-[0.65rem] py-[0.2rem] rounded-full text-[0.72rem] font-semibold text-scorecard-cell-text bg-scorecard-yellow">
            60–74.9% — At Risk
          </span>
          <span className="inline-flex items-center px-[0.65rem] py-[0.2rem] rounded-full text-[0.72rem] font-semibold text-scorecard-cell-text bg-scorecard-red">
            &lt; 60% — Non-compliant
          </span>
        </div>
      </footer>
    </div>
  );
}

export default function ScorecardPage() {
  return (
    <Suspense>
      <ScorecardPageContent />
    </Suspense>
  );
}

"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import PeriodSelector from "@/components/PeriodSelector";
import type { Plant, Month } from "@/components/PeriodSelector";
import OverallBadge from "@/components/OverallBadge";
import ScorecardGrid from "@/components/ScorecardGrid";
import AppHeader from "@/components/AppHeader";
import { getColor } from "@/lib/scorecard";
import type { ScorecardApiPayload, SelectorsApiPayload, ColorLabel } from "@/lib/scorecard";

const MONTH_NAMES: Month[] = [
  { value: 1,  label: "January" },
  { value: 2,  label: "February" },
  { value: 3,  label: "March" },
  { value: 4,  label: "April" },
  { value: 5,  label: "May" },
  { value: 6,  label: "June" },
  { value: 7,  label: "July" },
  { value: 8,  label: "August" },
  { value: 9,  label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function ml(m: number): string {
  return MONTH_NAMES.find((x) => x.value === m)?.label ?? String(m);
}

type ViewMode = "month" | "year" | "range";

function ModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const options: { value: ViewMode; label: string }[] = [
    { value: "month", label: "Month" },
    { value: "year",  label: "Year"  },
    { value: "range", label: "Range" },
  ];
  return (
    <div className="flex items-center rounded-md border border-brand-navy/20 overflow-hidden bg-white" role="group" aria-label="View mode">
      {options.map((opt) => (
        <button
          key={opt.value}
          id={`mode-toggle-${opt.value}`}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-[0.3rem] text-xs font-semibold transition-colors duration-100 whitespace-nowrap ${
            mode === opt.value
              ? "bg-brand-navy text-white"
              : "text-brand-navy hover:bg-brand-gray"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const selClass =
  "rounded border border-brand-navy/20 bg-white text-brand-navy text-xs font-semibold py-[0.28rem] px-2 " +
  "focus:outline-none focus:ring-2 focus:ring-brand-blue/50 cursor-pointer";

interface RangeSelectorProps {
  years: number[];
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  rangeError: string | null;
  onStartYearChange: (v: number) => void;
  onStartMonthChange: (v: number) => void;
  onEndYearChange: (v: number) => void;
  onEndMonthChange: (v: number) => void;
}

function RangeSelector({
  years,
  startYear,
  startMonth,
  endYear,
  endMonth,
  rangeError,
  onStartYearChange,
  onStartMonthChange,
  onEndYearChange,
  onEndMonthChange,
}: RangeSelectorProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-xs font-semibold uppercase tracking-[0.06em] text-brand-navy/60 whitespace-nowrap">Start</span>
      <select id="range-start-year" className={selClass} value={startYear} onChange={(e) => onStartYearChange(Number(e.target.value))}>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <select id="range-start-month" className={selClass} value={startMonth} onChange={(e) => onStartMonthChange(Number(e.target.value))}>
        {MONTH_NAMES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
      <span className="text-xs font-semibold uppercase tracking-[0.06em] text-brand-navy/60 whitespace-nowrap">→ End</span>
      <select id="range-end-year" className={selClass} value={endYear} onChange={(e) => onEndYearChange(Number(e.target.value))}>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <select id="range-end-month" className={selClass} value={endMonth} onChange={(e) => onEndMonthChange(Number(e.target.value))}>
        {MONTH_NAMES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
      {rangeError && (
        <span className="text-[0.72rem] font-semibold text-scorecard-red whitespace-nowrap">⚠ {rangeError}</span>
      )}
    </div>
  );
}

function ScorecardPageContent() {
  const searchParams = useSearchParams();

  const [plants, setPlants] = useState<Plant[]>([]);
  const [years, setYears]   = useState<number[]>([]);
  const [months, setMonths] = useState<Month[]>([]);

  const [plantId, setPlantId] = useState<string>("");
  const [year,    setYear]    = useState<number>(0);
  const [month,   setMonth]   = useState<number>(0);
  const [mode,    setMode]    = useState<ViewMode>("month");

  const now = new Date();
  const [startYear,  setStartYear]  = useState<number>(now.getFullYear());
  const [startMonth, setStartMonth] = useState<number>(1);
  const [endYear,    setEndYear]    = useState<number>(now.getFullYear());
  const [endMonth,   setEndMonth]   = useState<number>(now.getMonth() + 1);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const [data,    setData]    = useState<ScorecardApiPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error,   setError]   = useState<string | null>(null);

  const [thresholds, setThresholds] = useState<{ yellowMin: number; greenMin: number }>({ yellowMin: 0.6, greenMin: 0.75 });

  useEffect(() => {
    fetch("/api/thresholds")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => {
        if (typeof d.yellow_min === "number" && typeof d.green_min === "number") {
          setThresholds({ yellowMin: d.yellow_min, greenMin: d.green_min });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/scorecard/selectors")
      .then((r) => r.json() as Promise<SelectorsApiPayload>)
      .then(({ plants: dbPlants, periods }) => {
        setPlants(dbPlants);

        const uniqueYears  = [...new Set(periods.map((p) => p.year))].sort((a, b) => a - b);
        const uniqueMonths = [...new Set(periods.map((p) => p.month))].sort((a, b) => a - b);
        setYears(uniqueYears);
        setMonths(uniqueMonths.map((m) => ({ value: m, label: ml(m) })));

        const rawPlant = searchParams.get("plant");
        const rawYear  = searchParams.get("year");
        const rawMonth = searchParams.get("month");
        const rawMode  = searchParams.get("mode") as ViewMode | null;

        const initPlant  = dbPlants.find((p) => p.id === rawPlant)?.id ?? dbPlants[0]?.id ?? "";
        const parsedYear  = rawYear  ? parseInt(rawYear, 10)  : NaN;
        const parsedMonth = rawMonth ? parseInt(rawMonth, 10) : NaN;
        const initYear   = uniqueYears.includes(parsedYear)   ? parsedYear  : uniqueYears[0]  ?? 0;
        const initMonth  = uniqueMonths.includes(parsedMonth) ? parsedMonth : uniqueMonths[0] ?? 0;

        setPlantId(initPlant);
        setYear(initYear);
        setMonth(initMonth);

        if (rawMode === "year" || rawMode === "range") setMode(rawMode);

        if (rawMode === "range") {
          const rawSY = searchParams.get("startYear");
          const rawSM = searchParams.get("startMonth");
          const rawEY = searchParams.get("endYear");
          const rawEM = searchParams.get("endMonth");
          if (rawSY) setStartYear(parseInt(rawSY, 10));
          if (rawSM) setStartMonth(parseInt(rawSM, 10));
          if (rawEY) setEndYear(parseInt(rawEY, 10));
          if (rawEM) setEndMonth(parseInt(rawEM, 10));
        } else {
          const lastYear = uniqueYears[uniqueYears.length - 1] ?? now.getFullYear();
          const lastMonth = Math.max(...uniqueMonths);
          setStartYear(lastYear);
          setStartMonth(1);
          setEndYear(lastYear);
          setEndMonth(lastMonth || now.getMonth() + 1);
        }
      })
      .catch(() => setError("Could not load plant/period list from the database."));
  }, []);

  useEffect(() => {
    if (mode === "range") {
      const invalid = endYear < startYear || (endYear === startYear && endMonth < startMonth);
      setRangeError(invalid ? "End period must be on or after Start period." : null);
    }
  }, [startYear, startMonth, endYear, endMonth, mode]);

  function handleModeChange(next: ViewMode) {
    setMode(next);
    if (next === "range") {
      const lastYear = years[years.length - 1] ?? now.getFullYear();
      const lastMonth = months.length > 0 ? Math.max(...months.map((m) => m.value)) : now.getMonth() + 1;
      setStartYear(lastYear);
      setStartMonth(1);
      setEndYear(lastYear);
      setEndMonth(lastMonth);
      setRangeError(null);
    }
  }

  const fetchScorecard = useCallback((
    plant: string,
    y: number,
    m: number,
    currentMode: ViewMode,
    sy: number,
    sm_: number,
    ey: number,
    em: number,
  ) => {
    if (!plant) return;
    setLoading(true);
    setError(null);

    let url: string;
    if (currentMode === "year") {
      url = `/api/scorecard?plant=${encodeURIComponent(plant)}&year=${y}&mode=year`;
    } else if (currentMode === "range") {
      url = `/api/scorecard?plant=${encodeURIComponent(plant)}&mode=range&startYear=${sy}&startMonth=${sm_}&endYear=${ey}&endMonth=${em}`;
    } else {
      url = `/api/scorecard?plant=${encodeURIComponent(plant)}&year=${y}&month=${m}`;
    }

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ScorecardApiPayload>;
      })
      .then((payload) => setData(payload))
      .catch(() => {
        setError("No data found for this plant and period.");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!plantId) return;
    if (mode === "month" && (!year || !month)) return;
    if (mode === "year"  && !year) return;
    if (mode === "range") {
      const invalid = endYear < startYear || (endYear === startYear && endMonth < startMonth);
      if (invalid) { setData(null); return; }
    }
    fetchScorecard(plantId, year, month, mode, startYear, startMonth, endYear, endMonth);
  }, [plantId, year, month, mode, startYear, startMonth, endYear, endMonth, fetchScorecard]);

  const selectedMonthLabel  = months.find((m) => m.value === month)?.label ?? "";
  const selectedPlantLabel  = plants.find((p) => p.id === plantId)?.label ?? plantId;

  const overallRatio: number | null = data?.overall?.ratio ?? null;
  const overallColor: ColorLabel =
    data?.overall?.color && ["red", "yellow", "green"].includes(data.overall.color)
      ? (data.overall.color as ColorLabel)
      : getColor(overallRatio);

  const cellCount = data?.cells.length ?? 0;

  const subtextPeriod =
    mode === "year"
      ? `${selectedPlantLabel} — Year ${year}`
      : mode === "range"
        ? `${selectedPlantLabel} — Range: ${MONTH_ABBR[startMonth - 1]} ${startYear} → ${MONTH_ABBR[endMonth - 1]} ${endYear}`
        : `${selectedPlantLabel} — ${selectedMonthLabel} ${year}`;

  const rangeInvalid = mode === "range" && !!rangeError;

  return (
    <div className="flex flex-col min-h-screen pb-8">
      <AppHeader />

      <div className="flex items-center justify-between gap-4 flex-wrap px-6 py-3 bg-brand-gray border-b border-b-brand-navy/20">
        <div className="flex items-center gap-4 flex-wrap">
          <ModeToggle mode={mode} onChange={handleModeChange} />

          {mode === "range" ? (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-px h-4 bg-brand-navy/20" aria-hidden="true" />
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
                hideMonth
                hideYear
              />
              <RangeSelector
                years={years}
                startYear={startYear}
                startMonth={startMonth}
                endYear={endYear}
                endMonth={endMonth}
                rangeError={rangeError}
                onStartYearChange={setStartYear}
                onStartMonthChange={setStartMonth}
                onEndYearChange={setEndYear}
                onEndMonthChange={setEndMonth}
              />
            </div>
          ) : (
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
              hideMonth={mode !== "month"}
            />
          )}
        </div>
        <div className="shrink-0">
          <OverallBadge ratio={overallRatio} />
        </div>
      </div>

      <div className="flex items-center justify-between px-6 py-2 text-[0.8rem] font-semibold text-brand-navy bg-brand-gray border-b border-b-brand-navy/20 tracking-[0.02em]">
        <span>{subtextPeriod}</span>
        <span className="text-[0.75rem] font-medium">
          {loading
            ? "Loading…"
            : error
              ? "⚠ " + error
              : rangeInvalid
                ? ""
                : `${cellCount} active metric group${cellCount !== 1 ? "s" : ""}`}
        </span>
      </div>

      <main className="p-6 flex-1">
        {rangeInvalid ? (
          <div className="flex items-center justify-center h-40">
            <div className="bg-app-surface border border-app-border rounded-xl px-8 py-6 text-center shadow-sm max-w-sm">
              <span className="text-2xl">📅</span>
              <p className="mt-3 text-brand-navy font-semibold text-[0.9rem]">{rangeError}</p>
              <p className="text-app-muted text-[0.8rem] mt-1">Adjust the start and end periods above.</p>
            </div>
          </div>
        ) : data && !loading ? (
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
            mode={mode}
            startYear={startYear}
            startMonth={startMonth}
            endYear={endYear}
            endMonth={endMonth}
          />
        ) : loading ? (
          <div className="flex items-center justify-center h-40 gap-2 text-brand-navy/50 text-sm">
            <span className="w-4 h-4 rounded-full border-2 border-brand-blue border-t-transparent animate-spin" />
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
            ≥ {Math.round(thresholds.greenMin * 1000) / 10}% — Compliant
          </span>
          <span className="inline-flex items-center px-[0.65rem] py-[0.2rem] rounded-full text-[0.72rem] font-semibold text-scorecard-cell-text bg-scorecard-yellow">
            {Math.round(thresholds.yellowMin * 1000) / 10}–{Math.round((thresholds.greenMin - 0.001) * 1000) / 10}% — At Risk
          </span>
          <span className="inline-flex items-center px-[0.65rem] py-[0.2rem] rounded-full text-[0.72rem] font-semibold text-scorecard-cell-text bg-scorecard-red">
            &lt; {Math.round(thresholds.yellowMin * 1000) / 10}% — Non-compliant
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

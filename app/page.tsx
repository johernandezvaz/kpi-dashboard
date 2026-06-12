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

  const [infoOpen, setInfoOpen] = useState(false);

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
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            id="scorecard-info-btn"
            title="How are these numbers calculated?"
            onClick={() => setInfoOpen(true)}
            className="flex items-center justify-center w-7 h-7 rounded-full border border-brand-navy/25 text-brand-navy/60 hover:text-brand-blue hover:border-brand-blue/50 hover:bg-brand-blue/8 transition-colors"
            aria-label="How are these numbers calculated?"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7.25 7.25h.75v4.25h.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="8" cy="4.75" r="0.875" fill="currentColor" />
            </svg>
          </button>
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

      {infoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setInfoOpen(false)} />
          <div className="relative bg-app-surface border border-app-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-7 flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-base font-bold text-brand-navy leading-snug">How the scorecard is calculated</h2>
              <button
                type="button"
                onClick={() => setInfoOpen(false)}
                className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full border border-brand-navy/20 text-brand-navy/50 hover:text-brand-navy hover:border-brand-navy/40 transition-colors"
                aria-label="Close"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <section className="flex flex-col gap-2">
              <h3 className="text-[0.8rem] font-bold uppercase tracking-[0.07em] text-brand-navy/70">Score per metric</h3>
              <p className="text-[0.85rem] text-app-text leading-relaxed">
                Each individual metric produces a score of <strong>0</strong>, <strong>1</strong>, or <strong>2</strong>:
              </p>
              <ul className="text-[0.85rem] text-app-text leading-relaxed list-disc pl-5 flex flex-col gap-1">
                <li><strong>2 (green)</strong> — the metric hit its green target.</li>
                <li><strong>1 (yellow)</strong> — missed green but hit yellow.</li>
                <li><strong>0 (red)</strong> — missed both targets.</li>
              </ul>
              <p className="text-[0.85rem] text-app-text leading-relaxed mt-1">
                The direction depends on the metric&apos;s <em>higher&nbsp;is&nbsp;better</em> flag:
              </p>
              <ul className="text-[0.85rem] text-app-text leading-relaxed list-disc pl-5 flex flex-col gap-1">
                <li><strong>Higher is better:</strong> green if value ≥ green limit, yellow if value ≥ yellow limit, red otherwise.</li>
                <li><strong>Lower is better:</strong> green if value ≤ green limit, yellow if value ≤ yellow limit, red otherwise.</li>
              </ul>
            </section>

            <div className="h-px bg-brand-navy/10" />

            <section className="flex flex-col gap-2">
              <h3 className="text-[0.8rem] font-bold uppercase tracking-[0.07em] text-brand-navy/70">Compliance (%)</h3>
              <p className="text-[0.85rem] text-app-text leading-relaxed">
                The formula is the same at every level (cell, process, area, overall) and in every mode (month, year, range):
              </p>
              <div className="bg-brand-gray rounded-lg px-4 py-3 text-[0.85rem] font-mono text-brand-navy">
                compliance = SUM(scores) ÷ (2 × total_metrics)
              </div>
              <p className="text-[0.85rem] text-app-text leading-relaxed">
                <strong>Example:</strong> 10 metrics in a cell. 5 green (10 pts), 3 yellow (3 pts), 2 red (0 pts).
                Total score = 13. Maximum possible = 20. Compliance = <strong>65%</strong>.
              </p>
            </section>

            <div className="h-px bg-brand-navy/10" />

            <section className="flex flex-col gap-2">
              <h3 className="text-[0.8rem] font-bold uppercase tracking-[0.07em] text-brand-navy/70">How the calculation changes per mode</h3>
              <ul className="text-[0.85rem] text-app-text leading-relaxed list-disc pl-5 flex flex-col gap-1">
                <li><strong>Month</strong> — includes only metrics captured in the selected month.</li>
                <li><strong>Year</strong> — aggregates all 12 months of the selected year. Each monthly capture counts as one contribution to the sum.</li>
                <li><strong>Range</strong> — same as year, but between two arbitrary dates (which can span multiple years).</li>
              </ul>
              <p className="text-[0.85rem] text-app-text leading-relaxed">
                The formula does not change — only which periods are included in the sum.
              </p>
            </section>

            <div className="h-px bg-brand-navy/10" />

            <section className="flex flex-col gap-2">
              <h3 className="text-[0.8rem] font-bold uppercase tracking-[0.07em] text-brand-navy/70">Color thresholds for aggregated compliance</h3>
              <p className="text-[0.85rem] text-app-text leading-relaxed">
                These thresholds apply at the cell, process, area, and overall level:
              </p>
              <div className="bg-brand-gray rounded-lg px-4 py-3 flex flex-col gap-1.5 text-[0.85rem] font-semibold">
                <div>
                  <span className="inline-block w-20 text-scorecard-green">Green:</span>
                  <span className="text-app-text">≥ {Math.round(thresholds.greenMin * 1000) / 10}%</span>
                </div>
                <div>
                  <span className="inline-block w-20 text-scorecard-yellow">Yellow:</span>
                  <span className="text-app-text">{Math.round(thresholds.yellowMin * 1000) / 10}% – {Math.round((thresholds.greenMin - 0.001) * 1000) / 10}%</span>
                </div>
                <div>
                  <span className="inline-block w-20 text-scorecard-red">Red:</span>
                  <span className="text-app-text">&lt; {Math.round(thresholds.yellowMin * 1000) / 10}%</span>
                </div>
              </div>
              <p className="text-[0.82rem] text-app-muted">
                Threshold values are not hard-coded — administrators can adjust them at <em>/admin/thresholds</em>.
              </p>
            </section>

            <div className="h-px bg-brand-navy/10" />

            <section className="flex flex-col gap-2">
              <h3 className="text-[0.8rem] font-bold uppercase tracking-[0.07em] text-brand-navy/70">Metrics without data</h3>
              <p className="text-[0.85rem] text-app-text leading-relaxed">
                Months without captured data do not contribute to aggregated compliance. They do not count as red or as green — they simply do not enter the calculation.
              </p>
            </section>

            <div className="h-px bg-brand-navy/10" />

            <div className="flex items-center justify-between gap-4">
              <p className="text-[0.78rem] text-app-muted italic">
                This formula applies identically to month, year, and range views.
              </p>
              <button
                type="button"
                onClick={() => setInfoOpen(false)}
                className="px-4 py-1.5 rounded text-xs font-semibold border border-brand-navy/20 text-brand-navy hover:bg-brand-gray transition-colors whitespace-nowrap"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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

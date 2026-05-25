/**
 * app/page.tsx
 * ============
 * CDI DTC KPI Scorecard — main page.
 *
 * Responsibilities:
 *   - Holds selection state (plant, year, month) in local useState.
 *   - Fetches (currently: filters) the cell data for the selected period.
 *   - Computes the overall total for the badge.
 *   - Passes data down to presentational components.
 *
 * When replacing mock data with a real API:
 *   1. Replace `getCellsForPeriod(...)` with a fetch/SWR/React-Query call.
 *   2. Keep the same component tree — only this file changes.
 */
"use client";

import { useState } from "react";
import styles from "./page.module.css";
import PeriodSelector from "@/components/PeriodSelector";
import OverallBadge from "@/components/OverallBadge";
import ScorecardGrid from "@/components/ScorecardGrid";
import { computeOverallTotal } from "@/lib/scorecard";
import { PLANTS, YEARS, MONTHS, PROCESSES, AREAS, getCellsForPeriod } from "@/lib/mockData";

export default function ScorecardPage() {
  // -------------------------------------------------------------------
  // Selection state
  // -------------------------------------------------------------------
  const [plantId, setPlantId] = useState<string>(PLANTS[0].id);
  const [year, setYear] = useState<number>(2022);
  const [month, setMonth] = useState<number>(5); // May

  // -------------------------------------------------------------------
  // Data for the selected period
  // Swap this line for: const cells = await fetchCells(plantId, year, month)
  // -------------------------------------------------------------------
  const cells = getCellsForPeriod(plantId, year, month);

  // -------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------
  const overallRatio = computeOverallTotal(cells);

  const selectedMonthLabel =
    MONTHS.find((m) => m.value === month)?.label ?? "";
  const selectedPlantLabel =
    PLANTS.find((p) => p.id === plantId)?.label ?? plantId;

  return (
    <div className={styles.page}>
      {/* ----------------------------------------------------------------
          Header bar
      ---------------------------------------------------------------- */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.appTitle}>CDI DTC</h1>
          <span className={styles.appSubtitle}>KPI Scorecard</span>
        </div>

        <div className={styles.headerCenter}>
          <PeriodSelector
            plants={PLANTS}
            years={YEARS}
            months={MONTHS}
            selectedPlant={plantId}
            selectedYear={year}
            selectedMonth={month}
            onPlantChange={setPlantId}
            onYearChange={setYear}
            onMonthChange={setMonth}
          />
        </div>

        <div className={styles.headerRight}>
          <OverallBadge ratio={overallRatio} />
        </div>
      </header>

      {/* ----------------------------------------------------------------
          Period label
      ---------------------------------------------------------------- */}
      <div className={styles.periodLabel}>
        <span>
          {selectedPlantLabel} &mdash; {selectedMonthLabel} {year}
        </span>
        <span className={styles.cellCount}>
          {cells.length} active metric group{cells.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ----------------------------------------------------------------
          Grid
      ---------------------------------------------------------------- */}
      <main className={styles.main}>
        <ScorecardGrid cells={cells} areas={AREAS} processes={PROCESSES} />
      </main>

      {/* ----------------------------------------------------------------
          Legend
      ---------------------------------------------------------------- */}
      <footer className={styles.footer}>
        <div className={styles.legend}>
          <span className={styles.legendTitle}>Thresholds:</span>
          <span className={`${styles.chip} ${styles.chipGreen}`}>≥ 75% — Compliant</span>
          <span className={`${styles.chip} ${styles.chipYellow}`}>60–74.9% — At Risk</span>
          <span className={`${styles.chip} ${styles.chipRed}`}>&lt; 60% — Non-compliant</span>
        </div>
        <p className={styles.footerNote}>Read-only view · Phase 1 · Mock data</p>
      </footer>
    </div>
  );
}

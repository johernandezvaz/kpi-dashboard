"use client";

import styles from "./PeriodSelector.module.css";
import type { Plant, Month } from "@/lib/mockData";

interface PeriodSelectorProps {
  plants: Plant[];
  years: number[];
  months: Month[];
  selectedPlant: string;
  selectedYear: number;
  selectedMonth: number;
  onPlantChange: (plantId: string) => void;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
}

export default function PeriodSelector({
  plants,
  years,
  months,
  selectedPlant,
  selectedYear,
  selectedMonth,
  onPlantChange,
  onYearChange,
  onMonthChange,
}: PeriodSelectorProps) {
  return (
    <div className={styles.wrapper} role="group" aria-label="Period selector">
      <label className={styles.field}>
        <span className={styles.label}>Plant</span>
        <select
          id="select-plant"
          className={styles.select}
          value={selectedPlant}
          onChange={(e) => onPlantChange(e.target.value)}
        >
          {plants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Year</span>
        <select
          id="select-year"
          className={styles.select}
          value={selectedYear}
          onChange={(e) => onYearChange(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Month</span>
        <select
          id="select-month"
          className={styles.select}
          value={selectedMonth}
          onChange={(e) => onMonthChange(Number(e.target.value))}
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

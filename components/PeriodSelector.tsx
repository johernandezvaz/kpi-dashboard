"use client";

export interface Plant {
  id:    string;
  label: string;
}

export interface Month {
  value: number;
  label: string;
}

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
  hideMonth?: boolean;
  hideYear?: boolean;
}

const selectClass =
  "appearance-none bg-white border border-brand-navy/20 rounded-md " +
  "text-brand-navy text-sm font-medium py-[0.35rem] pl-[0.65rem] pr-8 cursor-pointer " +
  "bg-[var(--select-chevron-navy)] bg-no-repeat [background-position:right_0.55rem_center] " +
  "hover:border-brand-navy/40 " +
  "focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30 " +
  "transition-[border-color,box-shadow] duration-150";

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
  hideMonth = false,
  hideYear = false,
}: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-5 flex-wrap" role="group" aria-label="Period selector">
      <label className="flex items-center gap-2 cursor-pointer">
        <span className="text-xs font-semibold uppercase tracking-[0.06em] text-brand-navy/60 whitespace-nowrap">
          Plant
        </span>
        <select
          id="select-plant"
          className={selectClass}
          value={selectedPlant}
          onChange={(e) => onPlantChange(e.target.value)}
        >
          {plants.map((p) => (
            <option key={p.id} value={p.id} className="text-brand-navy bg-white">{p.label}</option>
          ))}
        </select>
      </label>

      {!hideYear && (
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs font-semibold uppercase tracking-[0.06em] text-brand-navy/60 whitespace-nowrap">
            Year
          </span>
          <select
            id="select-year"
            className={selectClass}
            value={selectedYear}
            onChange={(e) => onYearChange(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y} className="text-brand-navy bg-white">{y}</option>
            ))}
          </select>
        </label>
      )}

      {!hideMonth && (
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs font-semibold uppercase tracking-[0.06em] text-brand-navy/60 whitespace-nowrap">
            Month
          </span>
          <select
            id="select-month"
            className={selectClass}
            value={selectedMonth}
            onChange={(e) => onMonthChange(Number(e.target.value))}
          >
            {months.map((m) => (
              <option key={m.value} value={m.value} className="text-brand-navy bg-white">{m.label}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

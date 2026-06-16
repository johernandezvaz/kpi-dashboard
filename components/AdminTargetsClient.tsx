"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import AppHeader from "@/components/AppHeader";

interface Metric {
  metric_id: number;
  name: string;
  unit: string | null;
  higher_is_better: boolean;
  process_code: string;
  area_code: string;
}

interface TargetRow extends Metric {
  yellow_limit: string | null;
  green_limit: string | null;
  period_id: number | null;
  _yellowDraft: string;
  _greenDraft: string;
  _dirty: boolean;
  _saving: boolean;
  _error: string | null;
}

interface Plant {
  plant_id: number;
  code: string;
  name: string;
}

interface Props {
  plant: Plant | null;
  initialMetrics: Metric[];
  defaultYear: number;
  defaultMonth: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

function buildRows(metrics: Metric[], apiTargets: Record<number, { yellow_limit: string | null; green_limit: string | null; period_id: number | null }>): TargetRow[] {
  return metrics.map((m) => {
    const t = apiTargets[m.metric_id] ?? { yellow_limit: null, green_limit: null, period_id: null };
    return {
      ...m,
      yellow_limit: t.yellow_limit,
      green_limit: t.green_limit,
      period_id: t.period_id,
      _yellowDraft: t.yellow_limit ?? "",
      _greenDraft: t.green_limit ?? "",
      _dirty: false,
      _saving: false,
      _error: null,
    };
  });
}

export default function AdminTargetsClient({ plant, initialMetrics, defaultYear, defaultMonth }: Props) {
  const [year, setYear] = useState<number>(defaultYear);
  const [month, setMonth] = useState<number>(defaultMonth);
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [filter, setFilter] = useState("");
  const [filterProcess, setFilterProcess] = useState("all");
  const [filterArea, setFilterArea] = useState("all");
  const [savingAll, setSavingAll] = useState(false);
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const loadTargets = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setPageError(null);
    setCopyStatus(null);
    try {
      const res = await fetch(`/api/admin/targets?year=${y}&month=${m}`);
      const data = await res.json();
      if (!res.ok) {
        setPageError(data.error ?? "Failed to load targets");
        setRows([]);
        return;
      }

      const lookup: Record<number, { yellow_limit: string | null; green_limit: string | null; period_id: number | null }> = {};
      for (const t of data.targets ?? []) {
        lookup[t.metric_id] = {
          yellow_limit: t.yellow_limit,
          green_limit: t.green_limit,
          period_id: t.period_id,
        };
      }
      setRows(buildRows(initialMetrics, lookup));
    } catch {
      setPageError("Network error. Please try again.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [initialMetrics]);

  useEffect(() => {
    loadTargets(year, month);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveRow = useCallback(async (metricId: number, yellowDraft: string, greenDraft: string) => {
    const yellow = parseFloat(yellowDraft);
    const green = parseFloat(greenDraft);
    if (isNaN(yellow) || isNaN(green)) return;

    setRows((prev) =>
      prev.map((r) =>
        r.metric_id === metricId ? { ...r, _saving: true, _error: null } : r
      )
    );

    try {
      const res = await fetch("/api/admin/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, metricId, yellowLimit: yellow, greenLimit: green }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRows((prev) =>
          prev.map((r) =>
            r.metric_id === metricId
              ? { ...r, _saving: false, _dirty: true, _error: data.error ?? "Save failed" }
              : r
          )
        );
      } else {
        setRows((prev) =>
          prev.map((r) =>
            r.metric_id === metricId
              ? {
                ...r,
                _saving: false,
                _dirty: false,
                _error: null,
                yellow_limit: String(yellow),
                green_limit: String(green),
              }
              : r
          )
        );
      }
    } catch {
      setRows((prev) =>
        prev.map((r) =>
          r.metric_id === metricId
            ? { ...r, _saving: false, _dirty: true, _error: "Network error" }
            : r
        )
      );
    }
  }, [year, month]);

  const scheduleSave = useCallback((metricId: number, yellowDraft: string, greenDraft: string) => {
    if (saveTimers.current[metricId]) {
      clearTimeout(saveTimers.current[metricId]);
    }
    saveTimers.current[metricId] = setTimeout(() => {
      saveRow(metricId, yellowDraft, greenDraft);
    }, 700);
  }, [saveRow]);

  const handleFieldChange = (metricId: number, field: "_yellowDraft" | "_greenDraft", value: string) => {
    let updatedRow: TargetRow | undefined;
    setRows((prev) => {
      const next = prev.map((r) => {
        if (r.metric_id !== metricId) return r;
        const updated = { ...r, [field]: value, _dirty: true, _error: null };
        updatedRow = updated;
        return updated;
      });
      return next;
    });

    setTimeout(() => {
      if (updatedRow) {
        scheduleSave(metricId, updatedRow._yellowDraft, updatedRow._greenDraft);
      }
    }, 0);
  };

  const handleSaveAll = async () => {
    const dirty = rows.filter((r) => r._dirty && !r._saving);
    if (dirty.length === 0) return;
    setSavingAll(true);
    await Promise.all(dirty.map((r) => saveRow(r.metric_id, r._yellowDraft, r._greenDraft)));
    setSavingAll(false);
  };

  const handlePeriodChange = (newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
    loadTargets(newYear, newMonth);
  };

  const goToPrevMonth = () => {
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    handlePeriodChange(prevYear, prevMonth);
  };

  const goToNextMonth = () => {
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    handlePeriodChange(nextYear, nextMonth);
  };

  const handleCopyFromPrevious = async () => {
    setIsCopying(true);
    setCopyStatus(null);
    try {
      const res = await fetch("/api/admin/targets/copy-from-previous", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCopyStatus({ type: "error", msg: data.error ?? "Copy failed" });
      } else {
        setCopyStatus({
          type: data.copied === 0 ? "info" : "success",
          msg: data.message,
        });

        loadTargets(year, month);
      }
    } catch {
      setCopyStatus({ type: "error", msg: "Network error. Copy failed." });
    } finally {
      setIsCopying(false);
    }
  };

  const processes = Array.from(new Set(rows.map((r) => r.process_code))).sort();
  const areas = Array.from(new Set(rows.map((r) => r.area_code))).sort();

  const filteredRows = rows.filter((r) => {
    const search = filter.toLowerCase();
    const matchText = !search || r.name.toLowerCase().includes(search) || r.area_code.toLowerCase().includes(search);
    const matchProcess = filterProcess === "all" || r.process_code === filterProcess;
    const matchArea = filterArea === "all" || r.area_code === filterArea;
    return matchText && matchProcess && matchArea;
  });

  const dirtyCount = rows.filter((r) => r._dirty).length;

  const definedCount = rows.filter((r) => r.yellow_limit !== null && r.green_limit !== null).length;
  const totalCount = rows.length;

  if (!plant) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-app-bg">
        <p className="text-app-muted">Plant not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg text-app-text">
      <AppHeader />

      <div className="bg-app-surface border-b border-app-border px-6 py-4">
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-brand-navy tracking-tight">
              Target Definition
            </h1>
            <p className="text-xs text-app-muted mt-0.5">
              Plant <span className="font-semibold text-app-text">{plant.code} — {plant.name}</span>
            </p>
          </div>


          <div className="flex items-center gap-2">
            <button
              id="targets-prev-month"
              onClick={goToPrevMonth}
              disabled={loading}
              className="w-8 h-8 flex items-center justify-center rounded border border-app-border bg-app-bg hover:bg-app-hover text-app-muted hover:text-app-text transition-colors text-sm disabled:opacity-40"
              aria-label="Previous month"
            >
              ‹
            </button>
            <div className="flex items-center gap-1">
              <select
                id="targets-month-select"
                value={month}
                onChange={(e) => handlePeriodChange(year, parseInt(e.target.value, 10))}
                disabled={loading}
                className="border border-app-border rounded px-2 py-1 text-sm bg-app-bg text-app-text focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-60"
              >
                {MONTH_NAMES.map((n, i) => (
                  <option key={i + 1} value={i + 1}>{n}</option>
                ))}
              </select>
              <input
                id="targets-year-input"
                type="number"
                min={2020}
                max={2099}
                value={year}
                onChange={(e) => {
                  const y = parseInt(e.target.value, 10);
                  if (!isNaN(y) && y >= 2020 && y <= 2099) handlePeriodChange(y, month);
                }}
                disabled={loading}
                className="w-20 border border-app-border rounded px-2 py-1 text-sm bg-app-bg text-app-text focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-60"
              />
            </div>
            <button
              id="targets-next-month"
              onClick={goToNextMonth}
              disabled={loading}
              className="w-8 h-8 flex items-center justify-center rounded border border-app-border bg-app-bg hover:bg-app-hover text-app-muted hover:text-app-text transition-colors text-sm disabled:opacity-40"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="targets-copy-previous"
              onClick={handleCopyFromPrevious}
              disabled={isCopying || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-app-border bg-app-bg hover:bg-app-hover text-sm text-app-text transition-colors disabled:opacity-50"
            >
              {isCopying ? (
                <span className="w-3.5 h-3.5 border-2 border-brand-navy border-t-transparent rounded-full animate-spin inline-block" />
              ) : (
                <span>⎘</span>
              )}
              Copy from previous
            </button>

            {dirtyCount > 0 && (
              <button
                id="targets-save-all"
                onClick={handleSaveAll}
                disabled={savingAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-brand-navy hover:bg-brand-blue text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {savingAll ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                ) : null}
                Save {dirtyCount} change{dirtyCount !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-app-surface border-b border-app-border px-6 py-2">
        <div className="max-w-screen-xl mx-auto flex items-center gap-3">
          <div className="flex-1 h-2 bg-app-bg rounded-full overflow-hidden">
            <div
              className="h-2 rounded-full bg-scorecard-green transition-all duration-500"
              style={{ width: totalCount > 0 ? `${(definedCount / totalCount) * 100}%` : "0%" }}
            />
          </div>
          <span className="text-xs text-app-muted whitespace-nowrap">
            {definedCount}/{totalCount} targets defined
          </span>
        </div>
      </div>

      {copyStatus && (
        <div className={`mx-6 mt-4 px-4 py-3 rounded-lg border text-sm max-w-screen-xl mx-auto ${copyStatus.type === "success"
          ? "bg-scorecard-green/10 border-scorecard-green text-scorecard-green"
          : copyStatus.type === "error"
            ? "bg-scorecard-red/10 border-scorecard-red text-scorecard-red"
            : "bg-scorecard-yellow/10 border-scorecard-yellow text-scorecard-yellow"
          }`}>
          {copyStatus.msg}
          <button
            onClick={() => setCopyStatus(null)}
            className="ml-3 opacity-60 hover:opacity-100 transition-opacity font-bold"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {pageError && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-lg border bg-scorecard-red/10 border-scorecard-red text-scorecard-red text-sm max-w-screen-xl mx-auto">
          {pageError}
        </div>
      )}


      <div className="px-6 py-3 max-w-screen-xl mx-auto flex flex-wrap items-center gap-3">
        <input
          id="targets-search"
          type="text"
          placeholder="Search metrics…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-app-border rounded px-3 py-1.5 text-sm bg-app-bg text-app-text placeholder-app-muted focus:outline-none focus:ring-1 focus:ring-brand-blue w-56"
        />
        <select
          id="targets-filter-process"
          value={filterProcess}
          onChange={(e) => setFilterProcess(e.target.value)}
          className="border border-app-border rounded px-2 py-1.5 text-sm bg-app-bg text-app-text focus:outline-none focus:ring-1 focus:ring-brand-blue"
        >
          <option value="all">All processes</option>
          {processes.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          id="targets-filter-area"
          value={filterArea}
          onChange={(e) => setFilterArea(e.target.value)}
          className="border border-app-border rounded px-2 py-1.5 text-sm bg-app-bg text-app-text focus:outline-none focus:ring-1 focus:ring-brand-blue"
        >
          <option value="all">All areas</option>
          {areas.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <span className="text-xs text-app-muted ml-auto">
          {filteredRows.length} metric{filteredRows.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="px-6 pb-12 max-w-screen-xl mx-auto">
        <div className="overflow-x-auto rounded-xl border border-app-border shadow-sm bg-app-surface">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-app-muted text-sm gap-2">
              <span className="w-5 h-5 border-2 border-brand-navy border-t-transparent rounded-full animate-spin" />
              Loading targets…
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-app-muted text-sm gap-1">
              <span className="text-3xl">📋</span>
              <p>No active metrics found for this plant.</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-app-bg border-b border-app-border text-xs text-app-muted uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left font-semibold w-16">ID</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Metric</th>
                  <th className="px-4 py-2.5 text-left font-semibold w-24">Process</th>
                  <th className="px-4 py-2.5 text-left font-semibold w-24">Area</th>
                  <th className="px-4 py-2.5 text-center font-semibold w-20">Unit</th>
                  <th className="px-4 py-2.5 text-center font-semibold w-20">Direction</th>
                  <th className="px-4 py-2.5 text-center font-semibold w-36">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-scorecard-yellow inline-block" />
                      Yellow limit
                    </span>
                  </th>
                  <th className="px-4 py-2.5 text-center font-semibold w-36">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-scorecard-green inline-block" />
                      Green limit
                    </span>
                  </th>
                  <th className="px-4 py-2.5 text-center font-semibold w-20">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => {
                  const hasTarget = row.yellow_limit !== null && row.green_limit !== null;
                  const yellowParsed = parseFloat(row._yellowDraft);
                  const greenParsed = parseFloat(row._greenDraft);
                  const bothFilled = !isNaN(yellowParsed) && !isNaN(greenParsed);

                  return (
                    <tr
                      key={row.metric_id}
                      className={`border-b border-app-border last:border-0 transition-colors ${idx % 2 === 0 ? "bg-app-surface" : "bg-app-bg"
                        } hover:bg-app-hover`}
                    >

                      <td className="px-4 py-2 text-app-muted font-mono text-xs">{row.metric_id}</td>

                      <td className="px-4 py-2">
                        <span className="font-medium text-app-text">{row.name}</span>
                      </td>

                      <td className="px-4 py-2">
                        <span className="px-1.5 py-0.5 bg-brand-navy/10 text-brand-navy rounded text-xs font-mono">
                          {row.process_code}
                        </span>
                      </td>

                      <td className="px-4 py-2">
                        <span className="px-1.5 py-0.5 bg-brand-blue/10 text-brand-blue rounded text-xs font-mono">
                          {row.area_code}
                        </span>
                      </td>

                      <td className="px-4 py-2 text-center text-app-muted text-xs">
                        {row.unit ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span
                          title={row.higher_is_better ? "Higher is better" : "Lower is better"}
                          className={`text-base ${row.higher_is_better ? "text-scorecard-green" : "text-scorecard-red"}`}
                        >
                          {row.higher_is_better ? "↑" : "↓"}
                        </span>
                      </td>

                      <td className="px-3 py-1.5 text-center">
                        <input
                          id={`yellow-${row.metric_id}`}
                          type="number"
                          step="any"
                          value={row._yellowDraft}
                          onChange={(e) => handleFieldChange(row.metric_id, "_yellowDraft", e.target.value)}
                          placeholder="—"
                          className={`w-28 text-center border rounded px-2 py-1 text-sm bg-app-bg focus:outline-none focus:ring-1 focus:ring-brand-blue transition-colors ${row._error
                            ? "border-scorecard-red text-scorecard-red"
                            : row._dirty
                              ? "border-scorecard-yellow"
                              : "border-app-border text-app-text"
                            }`}
                        />
                      </td>

                      <td className="px-3 py-1.5 text-center">
                        <input
                          id={`green-${row.metric_id}`}
                          type="number"
                          step="any"
                          value={row._greenDraft}
                          onChange={(e) => handleFieldChange(row.metric_id, "_greenDraft", e.target.value)}
                          placeholder="—"
                          className={`w-28 text-center border rounded px-2 py-1 text-sm bg-app-bg focus:outline-none focus:ring-1 focus:ring-brand-blue transition-colors ${row._error
                            ? "border-scorecard-red text-scorecard-red"
                            : row._dirty
                              ? "border-scorecard-yellow"
                              : "border-app-border text-app-text"
                            }`}
                        />

                        {row._error && (
                          <div className="text-scorecard-red text-xs mt-0.5 text-left">{row._error}</div>
                        )}
                      </td>

                      <td className="px-4 py-2 text-center">
                        {row._saving ? (
                          <span className="w-4 h-4 border-2 border-brand-navy border-t-transparent rounded-full animate-spin inline-block" />
                        ) : row._error ? (
                          <span className="text-scorecard-red text-xs font-semibold">Error</span>
                        ) : row._dirty ? (
                          <span className="text-scorecard-yellow text-xs font-semibold">Unsaved</span>
                        ) : hasTarget ? (
                          <span className="inline-flex items-center gap-1 text-scorecard-green text-xs font-semibold">
                            <span>✓</span> Set
                          </span>
                        ) : (
                          <span className="text-app-muted text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-app-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-scorecard-green inline-block" />
            Target fully defined
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border-2 border-scorecard-yellow inline-block" />
            Unsaved changes (auto-saves after typing stops)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-scorecard-green">↑</span>
            Higher is better (green ≥ yellow)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-scorecard-red">↓</span>
            Lower is better (green ≤ yellow)
          </span>
        </div>
      </div>
    </div>
  );
}

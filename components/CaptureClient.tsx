"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import AppHeader from "@/components/AppHeader";

interface AccessRow {
  plant_id: number;
  plant_code: string;
  plant_name: string;
  area_id: number;
  area_code: string;
  area_name: string;
}

interface ApiMetric {
  metric_id: number;
  name: string;
  unit: string | null;
  higher_is_better: boolean;
  yellow_limit: string;
  green_limit: string;
  result_value: string | null;
  comment: string | null;
  corrective_action: string | null;
  target_date: string | null;
  owner_user_id: number | null;
  owner_text: string | null;
  owner_full_name: string | null;
}

interface EligibleUser {
  user_id: number;
  full_name: string;
}

type ColorLabel = "green" | "yellow" | "red" | null;
type OwnerMode = "user" | "text";

interface CaptureRow {
  metric_id: number;
  name: string;
  unit: string | null;
  higher_is_better: boolean;
  yellow_limit: number;
  green_limit: number;
  resultDraft: string;
  commentDraft: string;
  correctiveActionDraft: string;
  targetDateDraft: string;
  ownerMode: OwnerMode;
  ownerUserIdDraft: string;
  ownerTextDraft: string;
  liveColor: ColorLabel;
  savedColor: ColorLabel;
  _dirty: boolean;
  _saving: boolean;
  _error: string | null;
  _rowErrors: string[];
}

interface Props {
  accessRows: AccessRow[];
  userId: number;
  defaultYear: number;
  defaultMonth: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

function computeColor(
  result: number,
  yellow: number,
  green: number,
  higherIsBetter: boolean
): ColorLabel {
  if (higherIsBetter) {
    if (result >= green) return "green";
    if (result >= yellow) return "yellow";
    return "red";
  } else {
    if (result <= green) return "green";
    if (result <= yellow) return "yellow";
    return "red";
  }
}

function buildRow(m: ApiMetric, eligibleUsers: EligibleUser[]): CaptureRow {
  const yellow = parseFloat(m.yellow_limit);
  const green = parseFloat(m.green_limit);
  const resultNum = m.result_value !== null ? parseFloat(m.result_value) : null;
  const savedColor: ColorLabel = (resultNum !== null && !isNaN(resultNum))
    ? computeColor(resultNum, yellow, green, m.higher_is_better)
    : null;
  const liveColor = savedColor;

  const ownerMode: OwnerMode = (m.owner_user_id !== null || eligibleUsers.length > 0) ? "user" : "text";

  return {
    metric_id: m.metric_id,
    name: m.name,
    unit: m.unit,
    higher_is_better: m.higher_is_better,
    yellow_limit: yellow,
    green_limit: green,
    resultDraft: m.result_value ?? "",
    commentDraft: m.comment ?? "",
    correctiveActionDraft: m.corrective_action ?? "",
    targetDateDraft: m.target_date ?? "",
    ownerMode,
    ownerUserIdDraft: m.owner_user_id !== null ? String(m.owner_user_id) : "",
    ownerTextDraft: m.owner_text ?? "",
    liveColor,
    savedColor,
    _dirty: false,
    _saving: false,
    _error: null,
    _rowErrors: [],
  };
}

export default function CaptureClient({ accessRows, userId, defaultYear, defaultMonth }: Props) {
  const uniquePlants = Array.from(
    new Map(accessRows.map((r) => [r.plant_id, { plant_id: r.plant_id, plant_code: r.plant_code, plant_name: r.plant_name }])).values()
  );

  const [selectedPlantId, setSelectedPlantId] = useState<number>(
    uniquePlants.length > 0 ? uniquePlants[0].plant_id : 0
  );

  const areasForPlant = accessRows
    .filter((r) => r.plant_id === selectedPlantId)
    .map((r) => ({ area_id: r.area_id, area_code: r.area_code, area_name: r.area_name }));

  const [selectedAreaId, setSelectedAreaId] = useState<number>(
    areasForPlant.length > 0 ? areasForPlant[0].area_id : 0
  );

  const [year, setYear] = useState<number>(defaultYear);
  const [month, setMonth] = useState<number>(defaultMonth);
  const [rows, setRows] = useState<CaptureRow[]>([]);
  const [eligibleUsers, setEligibleUsers] = useState<EligibleUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [periodMissing, setPeriodMissing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [validationBanner, setValidationBanner] = useState<string | null>(null);
  const firstRedRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    const areas = accessRows
      .filter((r) => r.plant_id === selectedPlantId)
      .map((r) => ({ area_id: r.area_id, area_code: r.area_code, area_name: r.area_name }));
    if (areas.length > 0) {
      setSelectedAreaId(areas[0].area_id);
    }
  }, [selectedPlantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMetrics = useCallback(async (pId: number, aId: number, y: number, m: number) => {
    if (!pId || !aId) return;
    setLoading(true);
    setPageError(null);
    setPeriodMissing(false);
    setValidationBanner(null);
    try {
      const res = await fetch(`/api/capture?plantId=${pId}&areaId=${aId}&year=${y}&month=${m}`);
      const data = await res.json();
      if (!res.ok) {
        setPageError(data.error ?? "Failed to load metrics");
        setRows([]);
        return;
      }
      const eu: EligibleUser[] = data.eligibleUsers ?? [];
      setEligibleUsers(eu);
      setPeriodMissing(data.periodMissing ?? false);
      setRows((data.metrics ?? []).map((m: ApiMetric) => buildRow(m, eu)));
    } catch {
      setPageError("Network error. Please try again.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPlantId && selectedAreaId) {
      loadMetrics(selectedPlantId, selectedAreaId, year, month);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePeriodChange = (newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
    loadMetrics(selectedPlantId, selectedAreaId, newYear, newMonth);
  };

  const goToPrevMonth = () => {
    const py = month === 1 ? year - 1 : year;
    const pm = month === 1 ? 12 : month - 1;
    handlePeriodChange(py, pm);
  };

  const goToNextMonth = () => {
    const ny = month === 12 ? year + 1 : year;
    const nm = month === 12 ? 1 : month + 1;
    handlePeriodChange(ny, nm);
  };

  const handlePlantChange = (newPlantId: number) => {
    setSelectedPlantId(newPlantId);
    const areas = accessRows.filter((r) => r.plant_id === newPlantId);
    const newAreaId = areas.length > 0 ? areas[0].area_id : 0;
    setSelectedAreaId(newAreaId);
    loadMetrics(newPlantId, newAreaId, year, month);
  };

  const handleAreaChange = (newAreaId: number) => {
    setSelectedAreaId(newAreaId);
    loadMetrics(selectedPlantId, newAreaId, year, month);
  };

  const updateRow = (metricId: number, patch: Partial<CaptureRow>) => {
    setRows((prev) => prev.map((r) => {
      if (r.metric_id !== metricId) return r;
      const updated = { ...r, ...patch, _dirty: true, _error: null, _rowErrors: [] };

      if ("resultDraft" in patch) {
        const v = parseFloat(patch.resultDraft as string);
        updated.liveColor = (!isNaN(v) && patch.resultDraft !== "")
          ? computeColor(v, r.yellow_limit, r.green_limit, r.higher_is_better)
          : null;
      }
      return updated;
    }));
  };

  const dirtyRows = rows.filter((r) => r._dirty);

  const validateClientSide = (): boolean => {
    let missingCount = 0;
    let firstIdx = -1;
    const updatedRows = rows.map((r, idx) => {
      const errors: string[] = [];
      if (r.liveColor === "red" && r.resultDraft !== "") {
        if (!r.commentDraft.trim()) errors.push("Comment required");
        if (!r.correctiveActionDraft.trim()) errors.push("Corrective action required");
        if (!r.targetDateDraft.trim()) errors.push("Target date required");
        const hasUser = r.ownerMode === "user" && r.ownerUserIdDraft !== "";
        const hasText = r.ownerMode === "text" && r.ownerTextDraft.trim() !== "";
        if (!hasUser && !hasText) errors.push("Owner required");
        if (errors.length > 0) {
          missingCount++;
          if (firstIdx === -1) firstIdx = idx;
        }
      }
      return { ...r, _rowErrors: errors };
    });
    setRows(updatedRows);

    if (missingCount > 0) {
      setValidationBanner(
        `${missingCount} metric${missingCount > 1 ? "s" : ""} in red require${missingCount === 1 ? "s" : ""} corrective action details. Fields are highlighted below.`
      );
      setTimeout(() => {
        firstRedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      return false;
    }
    setValidationBanner(null);
    return true;
  };

  const handleSave = async () => {
    if (!validateClientSide()) return;

    const payload = dirtyRows.map((r) => ({
      metricId: r.metric_id,
      resultValue: r.resultDraft !== "" ? r.resultDraft : null,
      comment: r.commentDraft || null,
      correctiveAction: r.correctiveActionDraft || null,
      targetDate: r.targetDateDraft || null,
      ownerUserId: r.ownerMode === "user" && r.ownerUserIdDraft ? Number(r.ownerUserIdDraft) : null,
      ownerText: r.ownerMode === "text" && r.ownerTextDraft.trim() ? r.ownerTextDraft.trim() : null,
    }));

    setSaving(true);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId: selectedPlantId, areaId: selectedAreaId, year, month, rows: payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.rowErrors && Array.isArray(data.rowErrors)) {
          const errMap = new Map<number, string[]>();
          for (const e of data.rowErrors) {
            const prev = errMap.get(e.metricId) ?? [];
            errMap.set(e.metricId, [...prev, e.error]);
          }
          setRows((prev) => prev.map((r) => ({
            ...r,
            _rowErrors: errMap.get(r.metric_id) ?? r._rowErrors,
            _error: errMap.has(r.metric_id) ? (errMap.get(r.metric_id) ?? []).join("; ") : r._error,
          })));
          setValidationBanner(`Save failed: server rejected ${data.rowErrors.length} row(s). See highlighted fields.`);
        } else {
          setToast({ type: "error", msg: data.error ?? "Save failed" });
        }
        return;
      }
      setToast({ type: "success", msg: `Saved ${payload.length} metric${payload.length !== 1 ? "s" : ""}` });
      await loadMetrics(selectedPlantId, selectedAreaId, year, month);
    } catch {
      setToast({ type: "error", msg: "Network error. Save failed." });
    } finally {
      setSaving(false);
    }
  };

  const currentPlant = uniquePlants.find((p) => p.plant_id === selectedPlantId);
  const currentArea = areasForPlant.find((a) => a.area_id === selectedAreaId);
  const currentAreasForPlant = accessRows
    .filter((r) => r.plant_id === selectedPlantId)
    .map((r) => ({ area_id: r.area_id, area_code: r.area_code, area_name: r.area_name }));

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  if (accessRows.length === 0) {
    return (
      <div className="min-h-screen bg-app-bg text-app-text">
        <AppHeader />
        <div className="flex flex-col items-center justify-center py-32 px-6">
          <div className="bg-app-surface p-8 rounded-xl border border-app-border max-w-md text-center shadow-sm">
            <div className="text-4xl mb-4">📋</div>
            <h1 className="text-xl font-bold text-app-text mb-2">No Areas Assigned</h1>
            <p className="text-sm text-app-muted">
              You have no areas assigned. Contact your plant administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg text-app-text">
      <AppHeader />

      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-sm font-semibold text-white animate-scale-up ${toast.type === "success" ? "bg-scorecard-green" : "bg-scorecard-red"
          }`}>
          {toast.type === "success" ? "✓" : "⚠"} {toast.msg}
        </div>
      )}

      <div className="bg-app-surface border-b border-app-border px-6 py-4">
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-brand-navy tracking-tight">Value Capture</h1>
            <p className="text-xs text-app-muted mt-0.5">Enter monthly metric results for your area</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {uniquePlants.length === 1 ? (
              <span className="px-2 py-1 bg-brand-navy/10 text-brand-navy rounded text-xs font-semibold">
                {currentPlant?.plant_code} — {currentPlant?.plant_name}
              </span>
            ) : (
              <select
                id="capture-plant-select"
                value={selectedPlantId}
                onChange={(e) => handlePlantChange(Number(e.target.value))}
                disabled={loading || saving}
                className="border border-app-border rounded px-2 py-1 text-sm bg-app-bg text-app-text focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-60"
              >
                {uniquePlants.map((p) => (
                  <option key={p.plant_id} value={p.plant_id}>{p.plant_code} — {p.plant_name}</option>
                ))}
              </select>
            )}

            {currentAreasForPlant.length === 1 ? (
              <span className="px-2 py-1 bg-brand-blue/10 text-brand-blue rounded text-xs font-semibold">
                {currentArea?.area_code}
              </span>
            ) : (
              <select
                id="capture-area-select"
                value={selectedAreaId}
                onChange={(e) => handleAreaChange(Number(e.target.value))}
                disabled={loading || saving}
                className="border border-app-border rounded px-2 py-1 text-sm bg-app-bg text-app-text focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-60"
              >
                {currentAreasForPlant.map((a) => (
                  <option key={a.area_id} value={a.area_id}>{a.area_code} — {a.area_name}</option>
                ))}
              </select>
            )}

            <button
              id="capture-prev-month"
              onClick={goToPrevMonth}
              disabled={loading || saving}
              className="w-8 h-8 flex items-center justify-center rounded border border-app-border bg-app-bg hover:bg-app-hover text-app-muted text-sm transition-colors disabled:opacity-40"
              aria-label="Previous month"
            >‹</button>

            <select
              id="capture-month-select"
              value={month}
              onChange={(e) => handlePeriodChange(year, parseInt(e.target.value, 10))}
              disabled={loading || saving}
              className="border border-app-border rounded px-2 py-1 text-sm bg-app-bg text-app-text focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-60"
            >
              {MONTH_NAMES.map((n, i) => (
                <option key={i + 1} value={i + 1}>{n}</option>
              ))}
            </select>

            <input
              id="capture-year-input"
              type="number"
              min={2020}
              max={2099}
              value={year}
              onChange={(e) => {
                const y = parseInt(e.target.value, 10);
                if (!isNaN(y) && y >= 2020 && y <= 2099) handlePeriodChange(y, month);
              }}
              disabled={loading || saving}
              className="w-20 border border-app-border rounded px-2 py-1 text-sm bg-app-bg text-app-text focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-60"
            />

            <button
              id="capture-next-month"
              onClick={goToNextMonth}
              disabled={loading || saving}
              className="w-8 h-8 flex items-center justify-center rounded border border-app-border bg-app-bg hover:bg-app-hover text-app-muted text-sm transition-colors disabled:opacity-40"
              aria-label="Next month"
            >›</button>
          </div>

          <div className="flex items-center gap-2">
            {dirtyRows.length > 0 && (
              <button
                id="capture-save"
                onClick={handleSave}
                disabled={saving || loading}
                className="flex items-center gap-2 px-4 py-1.5 rounded bg-brand-navy hover:bg-brand-blue text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {saving && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                )}
                Save {dirtyRows.length} change{dirtyRows.length !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 pb-12 max-w-screen-xl mx-auto">
        {validationBanner && (
          <div className="mt-4 px-4 py-3 rounded-lg border bg-scorecard-red/10 border-scorecard-red text-scorecard-red text-sm flex items-start gap-2">
            <span className="font-bold mt-0.5">⚠</span>
            <span>{validationBanner}</span>
            <button onClick={() => setValidationBanner(null)} className="ml-auto font-bold opacity-60 hover:opacity-100">×</button>
          </div>
        )}

        {pageError && (
          <div className="mt-4 px-4 py-3 rounded-lg border bg-scorecard-red/10 border-scorecard-red text-scorecard-red text-sm">
            {pageError}
          </div>
        )}

        <div className="mt-4 overflow-x-auto rounded-xl border border-app-border shadow-sm bg-app-surface">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-app-muted text-sm gap-2">
              <span className="w-5 h-5 border-2 border-brand-navy border-t-transparent rounded-full animate-spin" />
              Loading metrics…
            </div>
          ) : periodMissing || rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-app-muted text-sm gap-1">
              <span className="text-3xl">📋</span>
              <p className="font-semibold text-app-text">No metrics available to capture for this period.</p>
              <p className="text-xs max-w-sm text-center">
                Make sure your plant administrator has defined targets for this month
                ({MONTH_NAMES[month - 1]} {year}).
              </p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-app-bg border-b border-app-border text-xs text-app-muted uppercase tracking-wide">
                  <th className="px-3 py-2.5 text-left font-semibold w-14">ID</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Metric</th>
                  <th className="px-3 py-2.5 text-center font-semibold w-14">Unit</th>
                  <th className="px-3 py-2.5 text-center font-semibold w-12">Dir</th>
                  <th className="px-3 py-2.5 text-center font-semibold w-24">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-scorecard-yellow inline-block" />
                      Yellow
                    </span>
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold w-24">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-scorecard-green inline-block" />
                      Green
                    </span>
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold w-28">Result</th>
                  <th className="px-3 py-2.5 text-center font-semibold w-14">Color</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Comment</th>
                  <th className="px-3 py-2.5 text-center font-semibold w-20">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const isRed = row.liveColor === "red" && row.resultDraft !== "";
                  const hasErrors = row._rowErrors.length > 0;
                  const isFirstRed = isRed && hasErrors && idx === rows.findIndex(
                    (r) => r.liveColor === "red" && r._rowErrors.length > 0 && r.resultDraft !== ""
                  );

                  return (
                    <CaptureRowComponent
                      key={row.metric_id}
                      row={row}
                      eligibleUsers={eligibleUsers}
                      saving={saving}
                      isFirstRed={isFirstRed}
                      firstRedRef={firstRedRef}
                      onUpdate={(patch) => updateRow(row.metric_id, patch)}
                    />
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

interface RowProps {
  row: CaptureRow;
  eligibleUsers: EligibleUser[];
  saving: boolean;
  isFirstRed: boolean;
  firstRedRef: React.MutableRefObject<HTMLTableRowElement | null>;
  onUpdate: (patch: Partial<CaptureRow>) => void;
}

function CaptureRowComponent({ row, eligibleUsers, saving, isFirstRed, firstRedRef, onUpdate }: RowProps) {
  const isRed = row.liveColor === "red" && row.resultDraft !== "";
  const hasErrors = row._rowErrors.length > 0;

  const colorDot: Record<string, string> = {
    green: "bg-scorecard-green",
    yellow: "bg-scorecard-yellow",
    red: "bg-scorecard-red",
  };

  return (
    <>
      <tr
        ref={isFirstRed ? firstRedRef : undefined}
        className={`border-b border-app-border transition-colors hover:bg-app-hover ${isRed && hasErrors ? "bg-scorecard-red/5" : ""
          }`}
      >
        <td className="px-3 py-2 text-app-muted font-mono text-xs">{row.metric_id}</td>

        <td className="px-3 py-2 max-w-[200px]">
          <span className="font-medium text-app-text truncate block" title={row.name}>{row.name}</span>
        </td>

        <td className="px-3 py-2 text-center text-app-muted text-xs">{row.unit ?? "—"}</td>

        <td className="px-3 py-2 text-center">
          <span
            title={row.higher_is_better ? "Higher is better" : "Lower is better"}
            className={`text-base font-bold ${row.higher_is_better ? "text-scorecard-green" : "text-scorecard-red"}`}
          >
            {row.higher_is_better ? "↑" : "↓"}
          </span>
        </td>

        <td className="px-3 py-2 text-center text-xs text-app-muted font-mono">{row.yellow_limit}</td>
        <td className="px-3 py-2 text-center text-xs text-app-muted font-mono">{row.green_limit}</td>

        <td className="px-2 py-1.5 text-center">
          <input
            id={`result-${row.metric_id}`}
            type="number"
            step="any"
            value={row.resultDraft}
            disabled={saving}
            onChange={(e) => onUpdate({ resultDraft: e.target.value })}
            placeholder="—"
            className={`w-24 text-center border rounded px-2 py-1 text-sm bg-app-bg focus:outline-none focus:ring-1 focus:ring-brand-blue transition-colors disabled:opacity-60 ${row._dirty ? "border-scorecard-yellow" : "border-app-border text-app-text"
              } ${hasErrors ? "border-scorecard-red" : ""}`}
          />
        </td>

        <td className="px-3 py-2 text-center">
          {row.liveColor && row.resultDraft !== "" ? (
            <span className={`w-5 h-5 rounded-full inline-block ${colorDot[row.liveColor]}`} title={row.liveColor} />
          ) : (
            <span className="w-5 h-5 rounded-full inline-block bg-app-border" title="No value" />
          )}
        </td>

        <td className="px-2 py-1.5">
          <input
            id={`comment-${row.metric_id}`}
            type="text"
            value={row.commentDraft}
            disabled={saving}
            onChange={(e) => onUpdate({ commentDraft: e.target.value })}
            placeholder={isRed ? "Required ⚠" : "Optional"}
            className={`w-full border rounded px-2 py-1 text-sm bg-app-bg text-app-text focus:outline-none focus:ring-1 focus:ring-brand-blue transition-colors disabled:opacity-60 ${isRed && !row.commentDraft.trim() && hasErrors
              ? "border-scorecard-red placeholder-scorecard-red/60"
              : "border-app-border"
              }`}
          />
        </td>

        <td className="px-3 py-2 text-center">
          {row._saving ? (
            <span className="w-4 h-4 border-2 border-brand-navy border-t-transparent rounded-full animate-spin inline-block" />
          ) : hasErrors ? (
            <span className="text-scorecard-red text-xs font-semibold">⚠</span>
          ) : row._dirty ? (
            <span className="text-scorecard-yellow text-xs font-semibold">Unsaved</span>
          ) : row.savedColor ? (
            <span className={`text-xs font-semibold ${row.savedColor === "green" ? "text-scorecard-green" :
              row.savedColor === "yellow" ? "text-scorecard-yellow" : "text-scorecard-red"
              }`}>✓ Saved</span>
          ) : (
            <span className="text-app-muted text-xs">—</span>
          )}
        </td>
      </tr>

      {isRed && (
        <tr className="border-b border-app-border bg-scorecard-red/5">
          <td colSpan={10} className="px-6 py-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-scorecard-red uppercase tracking-wide">
                  Corrective Action <span className="text-scorecard-red">*</span>
                </label>
                <textarea
                  id={`corrective-${row.metric_id}`}
                  value={row.correctiveActionDraft}
                  disabled={saving}
                  onChange={(e) => onUpdate({ correctiveActionDraft: e.target.value })}
                  rows={2}
                  placeholder="Describe corrective action…"
                  className={`w-full border rounded px-2 py-1.5 text-sm bg-white text-app-text focus:outline-none focus:ring-1 focus:ring-brand-blue resize-none disabled:opacity-60 ${!row.correctiveActionDraft.trim() && hasErrors ? "border-scorecard-red" : "border-app-border"
                    }`}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-scorecard-red uppercase tracking-wide">
                  Target Date <span className="text-scorecard-red">*</span>
                </label>
                <input
                  id={`target-date-${row.metric_id}`}
                  type="date"
                  value={row.targetDateDraft}
                  disabled={saving}
                  onChange={(e) => onUpdate({ targetDateDraft: e.target.value })}
                  className={`border rounded px-2 py-1.5 text-sm bg-white text-app-text focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-60 ${!row.targetDateDraft && hasErrors ? "border-scorecard-red" : "border-app-border"
                    }`}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-scorecard-red uppercase tracking-wide">
                  Owner <span className="text-scorecard-red">*</span>
                </label>
                <div className="flex gap-1 mb-1">
                  <button
                    type="button"
                    onClick={() => onUpdate({ ownerMode: "user", ownerTextDraft: row.ownerTextDraft })}
                    className={`px-2 py-0.5 rounded text-xs font-semibold border transition-colors ${row.ownerMode === "user"
                      ? "bg-brand-navy text-white border-brand-navy"
                      : "bg-app-bg text-app-muted border-app-border hover:bg-app-hover"
                      }`}
                  >
                    Registered user
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdate({ ownerMode: "text", ownerUserIdDraft: row.ownerUserIdDraft })}
                    className={`px-2 py-0.5 rounded text-xs font-semibold border transition-colors ${row.ownerMode === "text"
                      ? "bg-brand-navy text-white border-brand-navy"
                      : "bg-app-bg text-app-muted border-app-border hover:bg-app-hover"
                      }`}
                  >
                    Free text
                  </button>
                </div>

                {row.ownerMode === "user" ? (
                  <select
                    id={`owner-user-${row.metric_id}`}
                    value={row.ownerUserIdDraft}
                    disabled={saving}
                    onChange={(e) => onUpdate({ ownerUserIdDraft: e.target.value })}
                    className={`border rounded px-2 py-1.5 text-sm bg-white text-app-text focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-60 ${!row.ownerUserIdDraft && hasErrors ? "border-scorecard-red" : "border-app-border"
                      }`}
                  >
                    <option value="">Select user…</option>
                    {eligibleUsers.map((u) => (
                      <option key={u.user_id} value={u.user_id}>{u.full_name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`owner-text-${row.metric_id}`}
                    type="text"
                    value={row.ownerTextDraft}
                    disabled={saving}
                    onChange={(e) => onUpdate({ ownerTextDraft: e.target.value })}
                    placeholder="Responsible person name…"
                    className={`border rounded px-2 py-1.5 text-sm bg-white text-app-text focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-60 ${!row.ownerTextDraft.trim() && hasErrors ? "border-scorecard-red" : "border-app-border"
                      }`}
                  />
                )}
              </div>
            </div>

            {row._rowErrors.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {row._rowErrors.map((e, i) => (
                  <span key={i} className="text-xs text-scorecard-red bg-scorecard-red/10 px-2 py-0.5 rounded">
                    {e}
                  </span>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

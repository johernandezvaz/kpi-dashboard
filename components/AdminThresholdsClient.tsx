"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";

interface ThresholdRow {
  threshold_id: number;
  yellow_min: number;
  green_min: number;
  effective_from: string;
  notes: string | null;
  created_by: number | null;
  created_at: string;
}

interface AdminThresholdsClientProps {
  initialThreshold: ThresholdRow;
}

export default function AdminThresholdsClient({ initialThreshold }: AdminThresholdsClientProps) {
  const [current, setCurrent] = useState<ThresholdRow>(initialThreshold);

  const [yellowPct, setYellowPct] = useState<string>(String(Math.round(initialThreshold.yellow_min * 1000) / 10));
  const [greenPct, setGreenPct] = useState<string>(String(Math.round(initialThreshold.green_min * 1000) / 10));
  const [notes, setNotes] = useState<string>("");
  const [editing, setEditing] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const yellowNum = parseFloat(yellowPct);
  const greenNum = parseFloat(greenPct);

  const yellowValid = isFinite(yellowNum) && yellowNum >= 0 && yellowNum <= 100;
  const greenValid = isFinite(greenNum) && greenNum >= 0 && greenNum <= 100;
  const orderValid = yellowValid && greenValid && yellowNum < greenNum;
  const canSave = yellowValid && greenValid && orderValid && !submitting;

  function getInlineError(): string | null {
    if (yellowPct !== "" && !yellowValid) return "Yellow minimum must be between 0 and 100.";
    if (greenPct !== "" && !greenValid) return "Green minimum must be between 0 and 100.";
    if (yellowValid && greenValid && !orderValid) return "Yellow minimum must be strictly less than green minimum.";
    if (notes.length > 500) return "Notes must be at most 500 characters.";
    return null;
  }

  function handleEdit() {
    setYellowPct(String(Math.round(current.yellow_min * 1000) / 10));
    setGreenPct(String(Math.round(current.green_min * 1000) / 10));
    setNotes("");
    setError(null);
    setEditing(true);
  }

  function handleCancel() {
    setEditing(false);
    setError(null);
  }

  async function handleSave() {
    if (!canSave || submitting) return;
    const inlineErr = getInlineError();
    if (inlineErr) {
      setError(inlineErr);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/thresholds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yellowMin: yellowNum / 100,
          greenMin: greenNum / 100,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save thresholds.");
      }

      setCurrent(data);
      setEditing(false);
      setToast("Thresholds updated.");
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save thresholds.");
    } finally {
      setSubmitting(false);
    }
  }

  const inlineError = editing ? getInlineError() : null;

  const effectiveDate = new Date(current.effective_from + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col min-h-screen bg-app-bg">
      <AppHeader />

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-scorecard-green text-white text-sm font-semibold px-4 py-3 rounded-lg shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-brand-navy mb-1">Compliance Thresholds</h2>
          <p className="text-sm text-app-muted">
            Set the cutoffs used to color overall, area, and process compliance percentages across the scorecard.
            Changes apply immediately to all periods, historical and current.
          </p>
        </div>

        <div className="bg-app-surface border border-app-border rounded-xl p-5 mb-6 shadow-sm">
          <p className="text-xs font-semibold text-app-muted uppercase tracking-wider mb-3">
            Current thresholds (effective since {effectiveDate})
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-scorecard-cell-text bg-scorecard-green min-w-[7rem] justify-center">
                ≥ {Math.round(current.green_min * 1000) / 10}%
              </span>
              <span className="text-sm text-app-text font-semibold">Compliant</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-scorecard-cell-text bg-scorecard-yellow min-w-[7rem] justify-center">
                {Math.round(current.yellow_min * 1000) / 10}–{Math.round((current.green_min - 0.001) * 1000) / 10}%
              </span>
              <span className="text-sm text-app-text font-semibold">At Risk</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-scorecard-cell-text bg-scorecard-red min-w-[7rem] justify-center">
                &lt; {Math.round(current.yellow_min * 1000) / 10}%
              </span>
              <span className="text-sm text-app-text font-semibold">Non-compliant</span>
            </div>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={handleEdit}
              className="mt-4 px-4 py-2 bg-brand-navy hover:bg-brand-blue text-white text-sm font-semibold rounded-lg transition-colors duration-100"
            >
              Edit thresholds
            </button>
          )}
        </div>

        {editing && (
          <div className="bg-app-surface border border-app-border rounded-xl p-5 shadow-sm">
            <h3 className="text-base font-bold text-brand-navy mb-4">Edit thresholds</h3>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-app-muted uppercase tracking-wider mb-1.5">
                  Yellow minimum (%)
                </label>
                <input
                  id="threshold-yellow"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={yellowPct}
                  onChange={(e) => setYellowPct(e.target.value)}
                  className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-brand-navy bg-white focus:outline-none focus:border-brand-blue"
                  placeholder="e.g. 60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-app-muted uppercase tracking-wider mb-1.5">
                  Green minimum (%)
                </label>
                <input
                  id="threshold-green"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={greenPct}
                  onChange={(e) => setGreenPct(e.target.value)}
                  className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-brand-navy bg-white focus:outline-none focus:border-brand-blue"
                  placeholder="e.g. 75"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-app-muted uppercase tracking-wider mb-1.5">
                  Notes (optional)
                </label>
                <textarea
                  id="threshold-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-brand-navy bg-white focus:outline-none focus:border-brand-blue resize-none"
                  placeholder="Reason for this change…"
                />
                <p className="text-xs text-app-muted text-right mt-0.5">{notes.length}/500</p>
              </div>

              {(inlineError || error) && (
                <p className="text-sm text-scorecard-red font-semibold">
                  {inlineError || error}
                </p>
              )}

              <div className="flex items-center gap-3">
                <button
                  id="threshold-save"
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave || !!inlineError}
                  className="px-4 py-2 bg-brand-navy hover:bg-brand-blue disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors duration-100"
                >
                  {submitting ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 border border-app-border rounded-lg text-sm text-app-text font-semibold hover:bg-app-surface-2 transition-colors duration-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

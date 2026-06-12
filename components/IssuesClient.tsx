"use client";

import { useState, useEffect, useCallback } from "react";
import AppHeader from "@/components/AppHeader";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function periodLabel(year: number, month: number): string {
  return `${MONTH_NAMES[(month ?? 1) - 1] ?? "?"} ${year}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return String(Math.round(v * 1000) / 1000);
}

interface Issue {
  resultId: number;
  metricId: number;
  metricName: string;
  unit: string | null;
  plantId: number;
  plantCode: string;
  areaId: number;
  areaCode: string;
  processId: number;
  processCode: string;
  periodId: number;
  year: number;
  month: number;
  resultValue: number | null;
  yellowLimit: number | null;
  greenLimit: number | null;
  higherIsBetter: boolean;
  color: string;
  comment: string | null;
  correctiveAction: string | null;
  targetDate: string | null;
  ownerUserId: number | null;
  ownerName: string | null;
  ownerText: string | null;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string | null;
  updatedBy: number | null;
  updatedByName: string | null;
  updatedAt: string | null;
  isResolved: boolean;
  resolutionNote: string | null;
  resolvedAt: string | null;
  resolvedBy: number | null;
  resolvedByName: string | null;
  canMarkResolved: boolean;
}

interface PlantOption { id: number; code: string; name: string }
interface AreaOption { id: number; code: string; name: string }

interface IssuesClientProps {
  isAdmin: boolean;
  isSuperadmin: boolean;
  isOperational: boolean;
  plants: PlantOption[];
  areas: AreaOption[];
  adminPlantId: number | null;
}

const selClass =
  "rounded border border-brand-navy/20 bg-white text-brand-navy text-xs font-semibold py-[0.28rem] px-2 " +
  "focus:outline-none focus:ring-2 focus:ring-brand-blue/50 cursor-pointer";

const thClass = "text-left py-[0.45rem] px-3 font-bold text-[0.68rem] uppercase tracking-[0.08em] text-app-muted whitespace-nowrap border-r border-r-brand-navy/10 bg-app-surface-2";

function Truncated({ text, maxLen = 60 }: { text: string | null; maxLen?: number }) {
  if (!text) return <span className="text-app-muted">—</span>;
  if (text.length <= maxLen) return <span>{text}</span>;
  return (
    <span title={text} className="cursor-help underline decoration-dotted">
      {text.slice(0, maxLen)}…
    </span>
  );
}

interface ResolveModalProps {
  issue: Issue;
  onClose: () => void;
  onResolved: (resultId: number, note: string) => void;
}

function ResolveModal({ issue, onClose, onResolved }: ResolveModalProps) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!note.trim()) { setError("Resolution note is required."); return; }
    if (note.trim().length > 1000) { setError("Note exceeds 1000 characters."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/issues/${issue.resultId}/resolve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionNote: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Unknown error"); setLoading(false); return; }
      onResolved(issue.resultId, note.trim());
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-app-surface border border-app-border rounded-xl shadow-2xl w-full max-w-lg p-6 flex flex-col gap-4">
        <h2 className="text-base font-bold text-brand-navy">Mark Issue as Resolved</h2>

        <div className="bg-brand-gray/50 rounded-lg px-4 py-3 flex flex-col gap-1.5 text-[0.82rem]">
          <div><span className="font-semibold text-app-muted">Metric:</span> <span className="text-app-text">{issue.metricName}</span></div>
          <div><span className="font-semibold text-app-muted">Period:</span> <span className="text-app-text">{periodLabel(issue.year, issue.month)}</span></div>
          <div><span className="font-semibold text-app-muted">Target date:</span> <span className="text-app-text">{fmtDate(issue.targetDate)}</span></div>
          <div>
            <span className="font-semibold text-app-muted">Owner:</span>{" "}
            <span className="text-app-text">
              {issue.ownerName ?? (issue.ownerText ? <em>{issue.ownerText}</em> : "—")}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[0.82rem] font-semibold text-brand-navy" htmlFor="resolution-note">
            How was this resolved? <span className="text-scorecard-red">*</span>
          </label>
          <textarea
            id="resolution-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={4}
            className="w-full rounded border border-brand-navy/20 bg-white text-brand-navy text-[0.85rem] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 resize-none"
            placeholder="Describe the corrective action taken…"
          />
          <div className="text-[0.7rem] text-app-muted text-right">{note.length}/1000</div>
        </div>

        {error && (
          <div className="bg-scorecard-red/10 border border-scorecard-red/30 rounded px-3 py-2 text-[0.82rem] text-scorecard-red font-semibold">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-1.5 rounded text-xs font-semibold border border-brand-navy/20 text-brand-navy hover:bg-brand-gray transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-1.5 rounded text-xs font-semibold bg-brand-navy hover:bg-brand-blue text-white transition-colors disabled:opacity-60"
          >
            {loading ? "Saving…" : "Confirm Resolution"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-scorecard-green text-scorecard-cell-text px-5 py-3 rounded-lg shadow-xl text-[0.85rem] font-semibold animate-fade-in">
      {message}
    </div>
  );
}

export default function IssuesClient({
  isAdmin,
  isSuperadmin,
  isOperational,
  plants,
  areas,
  adminPlantId,
}: IssuesClientProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<"open" | "resolved" | "all">("open");
  const [plantId, setPlantId] = useState<string>("");
  const [areaId, setAreaId] = useState<string>("");

  const [resolveTarget, setResolveTarget] = useState<Issue | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchIssues = useCallback(
    async (p: number, s: string, pid: string, aid: string) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ status: s, page: String(p), pageSize: "50" });
      if (pid) params.set("plantId", pid);
      if (aid) params.set("areaId", aid);
      try {
        const res = await fetch(`/api/issues?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setIssues(data.issues ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      } catch {
        setError("Could not load issues.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchIssues(1, status, plantId, areaId);
    setPage(1);
  }, [status, plantId, areaId, fetchIssues]);

  useEffect(() => {
    fetchIssues(page, status, plantId, areaId);
  }, [page]);

  function handleResolved(resultId: number, note: string) {
    setIssues((prev) =>
      prev.map((iss) =>
        iss.resultId === resultId
          ? { ...iss, isResolved: true, resolutionNote: note, canMarkResolved: false }
          : iss
      )
    );
    setResolveTarget(null);
    setToast("Issue marked as resolved ✓");
  }

  const showPlantFilter = isSuperadmin;
  const showCapturedBy = isAdmin || isSuperadmin;

  return (
    <div className="flex flex-col min-h-screen bg-app-bg">
      <AppHeader />

      <div className="flex items-center justify-between gap-4 flex-wrap px-6 py-3 bg-brand-gray border-b border-b-brand-navy/20">
        <h1 className="text-base font-bold text-brand-navy tracking-[-0.01em]">Corrective Actions</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.06em] text-brand-navy/60">Status</span>
            <select id="issues-status" className={selClass} value={status} onChange={(e) => setStatus(e.target.value as "open" | "resolved" | "all")}>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="all">All</option>
            </select>
          </div>

          {showPlantFilter && plants.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.06em] text-brand-navy/60">Plant</span>
              <select id="issues-plant" className={selClass} value={plantId} onChange={(e) => { setPlantId(e.target.value); setAreaId(""); }}>
                <option value="">All</option>
                {plants.map((pl) => <option key={pl.id} value={pl.id}>{pl.code} — {pl.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.06em] text-brand-navy/60">Area</span>
            <select id="issues-area" className={selClass} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">All</option>
              {areas.map((ar) => <option key={ar.id} value={ar.id}>{ar.code} — {ar.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="px-6 py-2 border-b border-b-brand-navy/15 bg-brand-gray text-[0.78rem] text-brand-navy/60 font-medium">
        {loading ? "Loading…" : error ? `⚠ ${error}` : `${total} issue${total !== 1 ? "s" : ""}`}
      </div>

      <main className="flex-1 px-6 py-4 overflow-auto">
        {!loading && !error && issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <span className="text-3xl">📋</span>
            {isOperational ? (
              <p className="text-[0.88rem] text-app-muted max-w-sm">
                You have no open corrective actions. Issues you capture from red metrics will appear here for follow-up.
              </p>
            ) : (
              <p className="text-[0.88rem] text-app-muted max-w-sm">
                No open issues match your filters. Try adjusting the status filter.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-brand-navy/15 bg-app-surface shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[0.78rem]" aria-label="Corrective actions">
                <thead>
                  <tr className="border-b-2 border-b-brand-blue">
                    {showCapturedBy && <th className={thClass}>Plant</th>}
                    <th className={thClass}>Period</th>
                    <th className={thClass}>Metric</th>
                    <th className={thClass}>Process / Area</th>
                    <th className={`${thClass} text-center`}>Result</th>
                    <th className={`${thClass} text-center`}>Yellow / Green</th>
                    <th className={thClass}>Comment</th>
                    <th className={thClass}>Corrective Action</th>
                    <th className={thClass}>Target Date</th>
                    <th className={thClass}>Owner</th>
                    {showCapturedBy && <th className={thClass}>Captured By</th>}
                    <th className={`${thClass} text-center`}>Status</th>
                    {showCapturedBy && <th className={thClass}>Resolved By</th>}
                    {showCapturedBy && <th className={thClass}>Resolved At</th>}
                    {showCapturedBy && <th className={thClass}>Resolution Note</th>}
                    {!isSuperadmin && <th className={`${thClass} text-center border-r-0`}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {issues.map((iss, i) => {
                    const rowBg = i % 2 === 1 ? "bg-app-surface-alt" : "bg-app-surface";
                    const tdBase = `py-[0.4rem] px-3 align-top border-r border-r-brand-navy/10 border-b border-b-brand-navy/10`;
                    return (
                      <tr key={iss.resultId} className={`${rowBg} hover:bg-brand-blue/5 transition-colors`}>
                        {showCapturedBy && (
                          <td className={tdBase}>
                            <span className="font-semibold text-brand-navy">{iss.plantCode}</span>
                          </td>
                        )}
                        <td className={`${tdBase} whitespace-nowrap`}>
                          {periodLabel(iss.year, iss.month)}
                        </td>
                        <td className={tdBase}>
                          <div className="font-semibold text-brand-navy text-[0.72rem]">#{iss.metricId}</div>
                          <div className="text-app-text">{iss.metricName}</div>
                          {iss.unit && <div className="text-app-muted text-[0.7rem]">{iss.unit}</div>}
                        </td>
                        <td className={tdBase}>
                          <div>{iss.processCode}</div>
                          <div className="text-app-muted text-[0.7rem]">{iss.areaCode}</div>
                        </td>
                        <td className={`${tdBase} text-center`}>
                          <span className="inline-flex items-center justify-center px-2 py-[0.1rem] rounded-full text-[0.65rem] font-bold bg-scorecard-red text-scorecard-cell-text">
                            {fmtNum(iss.resultValue)}
                          </span>
                        </td>
                        <td className={`${tdBase} text-center whitespace-nowrap`}>
                          <span className="text-scorecard-yellow font-semibold">{fmtNum(iss.yellowLimit)}</span>
                          <span className="text-app-muted mx-1">/</span>
                          <span className="text-scorecard-green font-semibold">{fmtNum(iss.greenLimit)}</span>
                        </td>
                        <td className={`${tdBase} max-w-[160px]`}>
                          <Truncated text={iss.comment} />
                        </td>
                        <td className={`${tdBase} max-w-[160px]`}>
                          <Truncated text={iss.correctiveAction} />
                        </td>
                        <td className={`${tdBase} whitespace-nowrap`}>
                          {fmtDate(iss.targetDate)}
                        </td>
                        <td className={tdBase}>
                          {iss.ownerName
                            ? <span>{iss.ownerName}</span>
                            : iss.ownerText
                              ? <em className="text-app-muted">{iss.ownerText}</em>
                              : <span className="text-app-muted">—</span>
                          }
                        </td>
                        {showCapturedBy && (
                          <td className={tdBase}>
                            {iss.createdByName ?? iss.updatedByName ?? "—"}
                          </td>
                        )}
                        <td className={`${tdBase} text-center`}>
                          <span className={`inline-flex items-center justify-center px-2 py-[0.1rem] rounded-full text-[0.65rem] font-bold whitespace-nowrap ${iss.isResolved ? "bg-scorecard-green text-scorecard-cell-text" : "bg-brand-navy/10 text-brand-navy"}`}>
                            {iss.isResolved ? "Resolved" : "Open"}
                          </span>
                        </td>
                        {showCapturedBy && (
                          <td className={tdBase}>{iss.resolvedByName ?? "—"}</td>
                        )}
                        {showCapturedBy && (
                          <td className={`${tdBase} whitespace-nowrap`}>{fmtDate(iss.resolvedAt)}</td>
                        )}
                        {showCapturedBy && (
                          <td className={`${tdBase} max-w-[180px]`}>
                            <Truncated text={iss.resolutionNote} />
                          </td>
                        )}
                        {!isSuperadmin && (
                          <td className={`${tdBase} text-center border-r-0`}>
                            {iss.canMarkResolved ? (
                              <button
                                type="button"
                                id={`resolve-btn-${iss.resultId}`}
                                onClick={() => setResolveTarget(iss)}
                                className="px-2 py-[0.2rem] rounded text-[0.68rem] font-semibold bg-brand-navy hover:bg-brand-blue text-white transition-colors whitespace-nowrap"
                              >
                                Mark Resolved
                              </button>
                            ) : null}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-t-brand-navy/15 bg-app-surface-2">
                <span className="text-[0.75rem] text-app-muted">
                  Page {page} of {totalPages} · {total} total issue{total !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="issues-prev-page"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 text-xs font-semibold rounded border border-brand-navy/20 text-brand-navy disabled:opacity-40 hover:bg-brand-gray transition-colors"
                  >
                    ← Previous
                  </button>
                  <button
                    type="button"
                    id="issues-next-page"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 text-xs font-semibold rounded border border-brand-navy/20 text-brand-navy disabled:opacity-40 hover:bg-brand-gray transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {resolveTarget && (
        <ResolveModal
          issue={resolveTarget}
          onClose={() => setResolveTarget(null)}
          onResolved={handleResolved}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

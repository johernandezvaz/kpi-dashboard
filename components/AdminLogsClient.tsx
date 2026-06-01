"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";


interface AuditRow {
  audit_id: number;
  table_name: string;
  record_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by: number | null;
  changed_at: string;
  user_email: string | null;
  user_name: string | null;
}

interface LoginRow {
  event_id: number;
  user_id: number | null;
  email: string;
  success: boolean;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user_name: string | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

interface Stats {
  auditEventsToday: number;
  loginsToday: number;
  failedLoginsToday: number;
  activeUsers: number;
}

interface UserOption {
  user_id: number;
  email: string;
  full_name: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatRelative(iso: string) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

const ACTION_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  INSERT: { bg: "bg-emerald-500/15", text: "text-emerald-700", label: "INSERT" },
  UPDATE: { bg: "bg-amber-500/15", text: "text-amber-700", label: "UPDATE" },
  DELETE: { bg: "bg-red-500/15", text: "text-red-700", label: "DELETE" },
  LOGIN_OK: { bg: "bg-blue-500/15", text: "text-blue-700", label: "LOGIN ✓" },
  LOGIN_FAIL: { bg: "bg-red-500/15", text: "text-red-700", label: "LOGIN ✗" },
};

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_STYLES[action] ?? { bg: "bg-gray-200", text: "text-gray-600", label: action };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

function JsonDiff({ oldData, newData }: { oldData: Record<string, unknown> | null; newData: Record<string, unknown> | null }) {
  if (!oldData && !newData) return <span className="text-app-muted text-xs italic">No data</span>;


  if (!oldData && newData) {
    return (
      <div className="text-xs font-mono space-y-0.5">
        {Object.entries(newData).map(([key, val]) => (
          <div key={key} className="flex gap-2">
            <span className="text-emerald-600 font-semibold shrink-0">+ {key}:</span>
            <span className="text-app-text break-all">{JSON.stringify(val)}</span>
          </div>
        ))}
      </div>
    );
  }


  if (oldData && !newData) {
    return (
      <div className="text-xs font-mono space-y-0.5">
        {Object.entries(oldData).map(([key, val]) => (
          <div key={key} className="flex gap-2">
            <span className="text-red-600 font-semibold shrink-0">- {key}:</span>
            <span className="text-app-muted break-all line-through">{JSON.stringify(val)}</span>
          </div>
        ))}
      </div>
    );
  }


  if (oldData && newData) {
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    return (
      <div className="text-xs font-mono space-y-0.5">
        {[...allKeys].map((key) => {
          const oldVal = oldData[key];
          const newVal = newData[key];
          const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
          if (!changed) {
            return (
              <div key={key} className="flex gap-2 opacity-50">
                <span className="text-app-muted shrink-0">&nbsp; {key}:</span>
                <span className="text-app-muted break-all">{JSON.stringify(oldVal)}</span>
              </div>
            );
          }
          return (
            <div key={key}>
              <div className="flex gap-2 bg-red-50 rounded px-1">
                <span className="text-red-600 font-semibold shrink-0">- {key}:</span>
                <span className="text-red-700 break-all">{JSON.stringify(oldVal)}</span>
              </div>
              <div className="flex gap-2 bg-emerald-50 rounded px-1">
                <span className="text-emerald-600 font-semibold shrink-0">+ {key}:</span>
                <span className="text-emerald-700 break-all">{JSON.stringify(newVal)}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="bg-app-surface rounded-xl border border-app-border p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div>
        <div className="text-2xl font-bold text-app-text">{value.toLocaleString()}</div>
        <div className="text-xs text-app-muted font-medium">{label}</div>
      </div>
    </div>
  );
}

export default function AdminLogsClient() {
  const [logType, setLogType] = useState<"audit" | "login">("audit");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [auditData, setAuditData] = useState<AuditRow[]>([]);
  const [loginData, setLoginData] = useState<LoginRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const [filterUserId, setFilterUserId] = useState<string>("");
  const [filterTable, setFilterTable] = useState<string>("");
  const [filterAction, setFilterAction] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [filterSuccess, setFilterSuccess] = useState<string>("");

  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [tables, setTables] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/admin/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stats" }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.stats) setStats(data.stats);
        if (data.users) setUsers(data.users);
        if (data.tables) setTables(data.tables);
      })
      .catch(console.error);
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setExpandedRows(new Set());
    const params = new URLSearchParams();
    params.set("logType", logType);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (filterUserId) params.set("userId", filterUserId);
    if (logType === "audit") {
      if (filterTable) params.set("tableName", filterTable);
      if (filterAction) params.set("action", filterAction);
    }
    if (logType === "login" && filterSuccess) {
      params.set("success", filterSuccess);
    }
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);

    try {
      const res = await fetch(`/api/admin/logs?${params.toString()}`);
      const json = await res.json();
      if (json.logType === "login") {
        setLoginData(json.data);
        setAuditData([]);
      } else {
        setAuditData(json.data);
        setLoginData([]);
      }
      setPagination(json.pagination);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  }, [logType, page, pageSize, filterUserId, filterTable, filterAction, filterFrom, filterTo, filterSuccess]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [logType, filterUserId, filterTable, filterAction, filterFrom, filterTo, filterSuccess]);

  function toggleExpand(id: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleClearFilters() {
    setFilterUserId("");
    setFilterTable("");
    setFilterAction("");
    setFilterFrom("");
    setFilterTo("");
    setFilterSuccess("");
  }

  const hasActiveFilters = filterUserId || filterTable || filterAction || filterFrom || filterTo || filterSuccess;

  return (
    <div className="min-h-screen bg-app-bg">

      <header className="bg-brand-navy text-white shadow-lg">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="shrink-0">
              <Image
                src="/safe-demo_logo-blc-Photoroom.png"
                alt="Safe Demo"
                width={120}
                height={36}
                className="h-8 w-auto object-contain"
                priority
              />
            </Link>
            <div className="h-6 w-px bg-white/20" />
            <div>
              <h1 className="text-base font-bold tracking-tight flex items-center gap-2">
                <span className="text-lg"></span> Activity Logs
              </h1>
              <p className="text-[11px] text-white/50 font-medium">Security Operations Center</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/users"
              className="px-3 py-1.5 rounded text-xs font-semibold text-white border border-white/20 hover:bg-white/10 transition-colors"
            >
              ← Users
            </Link>
            <Link
              href="/"
              className="px-3 py-1.5 rounded text-xs font-semibold text-white border border-white/20 hover:bg-white/10 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Audit Events Today" value={stats.auditEventsToday} accent="bg-blue-500/10" />
            <StatCard label="Logins Today" value={stats.loginsToday} accent="bg-emerald-500/10" />
            <StatCard label="Failed Logins Today" value={stats.failedLoginsToday} accent="bg-red-500/10" />
            <StatCard label="Active Users" value={stats.activeUsers} accent="bg-purple-500/10" />
          </div>
        )}

        <div className="bg-app-surface rounded-xl border border-app-border p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">Log Type</label>
              <div className="inline-flex rounded-lg border border-app-border overflow-hidden">
                <button
                  onClick={() => setLogType("audit")}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${logType === "audit"
                    ? "bg-brand-navy text-white"
                    : "bg-app-surface-2 text-app-muted hover:bg-app-bg"
                    }`}
                >
                  Audit Trail
                </button>
                <button
                  onClick={() => setLogType("login")}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${logType === "login"
                    ? "bg-brand-navy text-white"
                    : "bg-app-surface-2 text-app-muted hover:bg-app-bg"
                    }`}
                >
                  Login Events
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">User</label>
              <select
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value)}
                className="px-2 py-1.5 text-xs border border-app-border rounded-lg bg-white text-app-text min-w-[160px]"
              >
                <option value="">All Users</option>
                {users.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.full_name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            {logType === "audit" && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">Table</label>
                <select
                  value={filterTable}
                  onChange={(e) => setFilterTable(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-app-border rounded-lg bg-white text-app-text min-w-[140px]"
                >
                  <option value="">All Tables</option>
                  {tables.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {logType === "audit" && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">Action</label>
                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-app-border rounded-lg bg-white text-app-text min-w-[110px]"
                >
                  <option value="">All Actions</option>
                  <option value="INSERT">INSERT</option>
                  <option value="UPDATE">UPDATE</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
            )}

            {logType === "login" && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">Status</label>
                <select
                  value={filterSuccess}
                  onChange={(e) => setFilterSuccess(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-app-border rounded-lg bg-white text-app-text min-w-[110px]"
                >
                  <option value="">All</option>
                  <option value="true">Successful</option>
                  <option value="false">Failed</option>
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">From</label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="px-2 py-1.5 text-xs border border-app-border rounded-lg bg-white text-app-text"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">To</label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="px-2 py-1.5 text-xs border border-app-border rounded-lg bg-white text-app-text"
              />
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-1.5 text-xs font-semibold text-scorecard-red border border-scorecard-red/30 rounded-lg hover:bg-red-50 transition-colors"
              >
                ✕ Clear
              </button>
            )}

            <div className="flex flex-col gap-1 ml-auto">
              <label className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">Per Page</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                className="px-2 py-1.5 text-xs border border-app-border rounded-lg bg-white text-app-text"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl border border-app-border shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-brand-blue border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-app-muted">Loading logs…</span>
              </div>
            </div>
          ) : logType === "audit" ? (

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-app-surface-2 border-b border-app-border">
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-app-muted uppercase tracking-wider w-8"></th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-app-muted uppercase tracking-wider">Timestamp</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-app-muted uppercase tracking-wider">User</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-app-muted uppercase tracking-wider">Action</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-app-muted uppercase tracking-wider">Table</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-app-muted uppercase tracking-wider">Record ID</th>
                  </tr>
                </thead>
                <tbody>
                  {auditData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-16 text-app-muted">
                        <div className="text-3xl mb-2">📭</div>
                        <div className="text-sm font-medium">No audit events found</div>
                        <div className="text-xs mt-1">Try adjusting your filters</div>
                      </td>
                    </tr>
                  ) : (
                    auditData.map((row) => {
                      const isExpanded = expandedRows.has(row.audit_id);
                      return (
                        <tr key={row.audit_id} className="group">
                          <td colSpan={6} className="p-0">
                            <div
                              className={`grid grid-cols-[32px_1fr_1fr_auto_auto_1fr] items-center border-b border-app-border cursor-pointer transition-colors duration-100 ${isExpanded ? "bg-blue-50/50" : "hover:bg-app-surface-2"
                                }`}
                              onClick={() => toggleExpand(row.audit_id)}
                            >
                              <div className="px-2 py-3 text-center">
                                <span
                                  className={`inline-block text-app-muted text-[10px] transition-transform duration-200 ${isExpanded ? "rotate-90" : ""
                                    }`}
                                >
                                  ▶
                                </span>
                              </div>
                              <div className="px-4 py-3">
                                <div className="text-xs font-medium text-app-text">{formatDate(row.changed_at)}</div>
                                <div className="text-[10px] text-app-muted">{formatRelative(row.changed_at)}</div>
                              </div>
                              <div className="px-4 py-3">
                                <div className="text-xs font-medium text-app-text">{row.user_name ?? "System"}</div>
                                <div className="text-[10px] text-app-muted">{row.user_email ?? "—"}</div>
                              </div>
                              <div className="px-4 py-3">
                                <ActionBadge action={row.action} />
                              </div>
                              <div className="px-4 py-3">
                                <span className="text-xs font-mono bg-app-surface-2 px-2 py-0.5 rounded border border-app-border text-app-text">
                                  {row.table_name}
                                </span>
                              </div>
                              <div className="px-4 py-3">
                                <span className="text-xs font-mono text-app-muted">{row.record_id}</span>
                              </div>
                            </div>

                            <div
                              className={`overflow-hidden transition-all duration-200 ease-in-out ${isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                                }`}
                            >
                              <div className="px-6 py-4 bg-app-surface-2 border-b border-app-border">
                                <div className="flex gap-8">
                                  {row.old_data && (
                                    <div className="flex-1">
                                      <div className="text-[10px] font-bold text-app-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Previous Data
                                      </div>
                                    </div>
                                  )}
                                  {row.new_data && !row.old_data && (
                                    <div className="flex-1">
                                      <div className="text-[10px] font-bold text-app-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> New Data
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <JsonDiff oldData={row.old_data} newData={row.new_data} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-app-surface-2 border-b border-app-border">
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-app-muted uppercase tracking-wider">Timestamp</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-app-muted uppercase tracking-wider">Email</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-app-muted uppercase tracking-wider">User</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-app-muted uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-app-muted uppercase tracking-wider">IP Address</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-app-muted uppercase tracking-wider">User Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {loginData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-16 text-app-muted">
                        <div className="text-3xl mb-2">🔑</div>
                        <div className="text-sm font-medium">No login events found</div>
                        <div className="text-xs mt-1">Login events will appear once users sign in</div>
                      </td>
                    </tr>
                  ) : (
                    loginData.map((row) => (
                      <tr
                        key={row.event_id}
                        className={`border-b border-app-border transition-colors duration-100 ${row.success ? "hover:bg-app-surface-2" : "bg-red-50/40 hover:bg-red-50/70"
                          }`}
                      >
                        <td className="px-4 py-3">
                          <div className="text-xs font-medium text-app-text">{formatDate(row.created_at)}</div>
                          <div className="text-[10px] text-app-muted">{formatRelative(row.created_at)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-app-text">{row.email}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-app-text">{row.user_name ?? "Unknown"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <ActionBadge action={row.success ? "LOGIN_OK" : "LOGIN_FAIL"} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-app-muted">{row.ip_address ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3 max-w-[300px]">
                          <span className="text-[10px] text-app-muted truncate block" title={row.user_agent ?? ""}>
                            {row.user_agent ? (row.user_agent.length > 80 ? row.user_agent.slice(0, 80) + "…" : row.user_agent) : "—"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {pagination && pagination.totalPages > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-app-border bg-app-surface-2">
              <div className="text-xs text-app-muted">
                Showing{" "}
                <span className="font-semibold text-app-text">
                  {((page - 1) * pageSize + 1).toLocaleString()}–
                  {Math.min(page * pageSize, pagination.totalCount).toLocaleString()}
                </span>{" "}
                of <span className="font-semibold text-app-text">{pagination.totalCount.toLocaleString()}</span> events
              </div>
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                  className="px-2 py-1 text-xs font-medium rounded border border-app-border bg-white text-app-text disabled:opacity-40 disabled:cursor-not-allowed hover:bg-app-surface-2 transition-colors"
                >
                  ⟪
                </button>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-2 py-1 text-xs font-medium rounded border border-app-border bg-white text-app-text disabled:opacity-40 disabled:cursor-not-allowed hover:bg-app-surface-2 transition-colors"
                >
                  ‹ Prev
                </button>
                <span className="px-3 py-1 text-xs font-semibold text-app-text">
                  {page} / {pagination.totalPages}
                </span>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-2 py-1 text-xs font-medium rounded border border-app-border bg-white text-app-text disabled:opacity-40 disabled:cursor-not-allowed hover:bg-app-surface-2 transition-colors"
                >
                  Next ›
                </button>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(pagination.totalPages)}
                  className="px-2 py-1 text-xs font-medium rounded border border-app-border bg-white text-app-text disabled:opacity-40 disabled:cursor-not-allowed hover:bg-app-surface-2 transition-colors"
                >
                  ⟫
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

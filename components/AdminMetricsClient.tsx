"use client";

import { useState, useRef } from "react";
import AppHeader from "@/components/AppHeader";
import { useRouter } from "next/navigation";

interface DbMetric {
  metric_id: number;
  plant_id: number;
  process_id: number;
  area_id: number;
  name: string;
  unit: string | null;
  higher_is_better: boolean;
  active: boolean;
  owner_user_id: number | null;
  pnl_item: string | null;
  plant_code: string;
  process_code: string;
  area_code: string;
  owner_name: string | null;
}

interface PlantItem {
  plant_id: number;
  code: string;
  name: string;
}

interface ProcessItem {
  process_id: number;
  code: string;
  name: string;
}

interface AreaItem {
  area_id: number;
  code: string;
  name: string;
}

interface UserItem {
  user_id: number;
  full_name: string;
  email: string;
  is_admin: boolean;
  admin_plant_id: number | null;
  plant_ids: number[] | null;
}

interface CurrentUser {
  isAdmin: boolean;
  adminPlantId: number | null;
}

interface AdminMetricsClientProps {
  initialMetrics: DbMetric[];
  plants: PlantItem[];
  processes: ProcessItem[];
  areas: AreaItem[];
  users: UserItem[];
  currentUser: CurrentUser;
}

interface MetricRowData {
  metric_id: string;
  plant_id: number;
  process_id: number;
  area_id: number;
  name: string;
  unit: string;
  higher_is_better: boolean;
  active: boolean;
  owner_user_id: number | null;
  pnl_item: string;
}

export default function AdminMetricsClient({
  initialMetrics,
  plants,
  processes,
  areas,
  users,
  currentUser,
}: AdminMetricsClientProps) {
  const router = useRouter();
  const isSuperadmin = currentUser.adminPlantId === null;
  const plantAdminPlant = plants.find((p) => p.plant_id === currentUser.adminPlantId);

  const [metrics, setMetrics] = useState<DbMetric[]>(initialMetrics);

  const [plantFilter, setPlantFilter] = useState<string>("all");
  const [processFilter, setProcessFilter] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [showAddRow, setShowAddRow] = useState(false);
  const [newRow, setNewRow] = useState<MetricRowData>({
    metric_id: "",
    plant_id: isSuperadmin ? (plants[0]?.plant_id ?? 0) : (currentUser.adminPlantId ?? 0),
    process_id: processes[0]?.process_id ?? 0,
    area_id: areas[0]?.area_id ?? 0,
    name: "",
    unit: "",
    higher_is_better: false,
    active: true,
    owner_user_id: null,
    pnl_item: "",
  });

  const isNewRowMetricIdValid = (() => {
    const raw = newRow.metric_id.trim();
    if (!raw) return false;
    const num = parseInt(raw, 10);
    return !isNaN(num) && Number.isInteger(num) && num >= 1000 && num <= 99999;
  })();

  const [editingMetricId, setEditingMetricId] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<MetricRowData>({
    metric_id: "",
    plant_id: 0,
    process_id: 0,
    area_id: 0,
    name: "",
    unit: "",
    higher_is_better: false,
    active: true,
    owner_user_id: null,
    pnl_item: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const rowRef = useRef<HTMLTableRowElement>(null);

  const getEligibleOwners = (plantId: number) => {
    return users.filter((u) => {
      if (u.is_admin && u.admin_plant_id === null) return true;
      if (u.is_admin && u.admin_plant_id === plantId) return true;
      if (u.plant_ids && u.plant_ids.includes(plantId)) return true;
      return false;
    });
  };

  const handleRowDoubleClick = (metric: DbMetric) => {
    if (editingMetricId === metric.metric_id) return;

    if (!isSuperadmin && metric.plant_id !== currentUser.adminPlantId) {
      return;
    }

    setEditingMetricId(metric.metric_id);
    setEditingRow({
      metric_id: String(metric.metric_id),
      plant_id: metric.plant_id,
      process_id: metric.process_id,
      area_id: metric.area_id,
      name: metric.name,
      unit: metric.unit ?? "",
      higher_is_better: metric.higher_is_better,
      active: metric.active,
      owner_user_id: metric.owner_user_id,
      pnl_item: metric.pnl_item ?? "",
    });
    setError(null);
  };

  const showSuccessNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const saveEditingMetric = async () => {
    if (editingMetricId === null || submitting) return;

    const nameVal = editingRow.name.trim();
    if (!nameVal) {
      setError("Metric name is required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/metrics/${editingMetricId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plantId: editingRow.plant_id,
          processId: editingRow.process_id,
          areaId: editingRow.area_id,
          name: nameVal,
          unit: editingRow.unit.trim() || null,
          higherIsBetter: editingRow.higher_is_better,
          active: editingRow.active,
          ownerUserId: editingRow.owner_user_id,
          pnlItem: editingRow.pnl_item.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update metric.");
      }

      const assignedPlant = plants.find((p) => p.plant_id === editingRow.plant_id);
      const assignedProcess = processes.find((pr) => pr.process_id === editingRow.process_id);
      const assignedArea = areas.find((a) => a.area_id === editingRow.area_id);
      const assignedOwner = users.find((u) => u.user_id === editingRow.owner_user_id);

      setMetrics(
        metrics.map((m) => {
          if (m.metric_id === editingMetricId) {
            return {
              ...m,
              plant_id: editingRow.plant_id,
              process_id: editingRow.process_id,
              area_id: editingRow.area_id,
              name: nameVal,
              unit: editingRow.unit.trim() || null,
              higher_is_better: editingRow.higher_is_better,
              active: editingRow.active,
              owner_user_id: editingRow.owner_user_id,
              pnl_item: editingRow.pnl_item.trim() || null,
              plant_code: assignedPlant ? assignedPlant.code : "",
              process_code: assignedProcess ? assignedProcess.code : "",
              area_code: assignedArea ? assignedArea.code : "",
              owner_name: assignedOwner ? assignedOwner.full_name : null,
            };
          }
          return m;
        })
      );

      setEditingMetricId(null);
      showSuccessNotification("Metric updated successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to update metric.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditingKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveEditingMetric();
    } else if (e.key === "Escape") {
      setEditingMetricId(null);
    }
  };

  const toggleMetricActive = async (metric: DbMetric) => {
    if (submitting) return;

    if (!isSuperadmin && metric.plant_id !== currentUser.adminPlantId) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const newActiveState = !metric.active;

    try {
      const res = await fetch(`/api/admin/metrics/${metric.metric_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newActiveState }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to toggle status.");
      }

      setMetrics(
        metrics.map((m) => (m.metric_id === metric.metric_id ? { ...m, active: newActiveState } : m))
      );
      showSuccessNotification(`Metric status set to ${newActiveState ? "Active" : "Inactive"}`);
    } catch (err: any) {
      setError(err.message || "Failed to toggle status.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddRowClick = () => {
    setShowAddRow(true);
    setNewRow({
      metric_id: "",
      plant_id: isSuperadmin ? (plants[0]?.plant_id ?? 0) : (currentUser.adminPlantId ?? 0),
      process_id: processes[0]?.process_id ?? 0,
      area_id: areas[0]?.area_id ?? 0,
      name: "",
      unit: "",
      higher_is_better: false,
      active: true,
      owner_user_id: null,
      pnl_item: "",
    });
    setError(null);
  };

  const handleCancelAdd = () => {
    setShowAddRow(false);
    setError(null);
  };

  const saveNewMetric = async () => {
    if (submitting) return;

    const nameVal = newRow.name.trim();
    if (!nameVal) {
      setShowAddRow(false);
      return;
    }

    const rawId = newRow.metric_id.trim();
    if (!rawId) {
      setError("Metric ID is required (1000-99999)");
      return;
    }
    const metricIdNum = parseInt(rawId, 10);
    if (isNaN(metricIdNum) || !Number.isInteger(metricIdNum) || metricIdNum < 1000 || metricIdNum > 99999) {
      setError("Metric ID is required (1000-99999)");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metricId: metricIdNum,
          plantId: newRow.plant_id,
          processId: newRow.process_id,
          areaId: newRow.area_id,
          name: nameVal,
          unit: newRow.unit.trim() || null,
          higherIsBetter: newRow.higher_is_better,
          active: newRow.active,
          ownerUserId: newRow.owner_user_id,
          pnlItem: newRow.pnl_item.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create metric.");
      }

      const assignedPlant = plants.find((p) => p.plant_id === newRow.plant_id);
      const assignedProcess = processes.find((pr) => pr.process_id === newRow.process_id);
      const assignedArea = areas.find((a) => a.area_id === newRow.area_id);
      const assignedOwner = users.find((u) => u.user_id === newRow.owner_user_id);

      const createdMetric: DbMetric = {
        metric_id: data.metricId,
        plant_id: newRow.plant_id,
        process_id: newRow.process_id,
        area_id: newRow.area_id,
        name: nameVal,
        unit: newRow.unit.trim() || null,
        higher_is_better: newRow.higher_is_better,
        active: newRow.active,
        owner_user_id: newRow.owner_user_id,
        pnl_item: newRow.pnl_item.trim() || null,
        plant_code: assignedPlant ? assignedPlant.code : "",
        process_code: assignedProcess ? assignedProcess.code : "",
        area_code: assignedArea ? assignedArea.code : "",
        owner_name: assignedOwner ? assignedOwner.full_name : null,
      };

      setMetrics([...metrics, createdMetric]);
      setShowAddRow(false);
      showSuccessNotification("Metric cataloged successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to create metric.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (isNewRowMetricIdValid) {
        saveNewMetric();
      } else {
        setError("Metric ID is required (1000-99999)");
      }
    } else if (e.key === "Escape") {
      handleCancelAdd();
    }
  };

  const filteredMetrics = metrics.filter((m) => {
    if (isSuperadmin && plantFilter !== "all" && String(m.plant_id) !== plantFilter) return false;
    if (processFilter !== "all" && String(m.process_id) !== processFilter) return false;
    if (areaFilter !== "all" && String(m.area_id) !== areaFilter) return false;

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const idMatch = String(m.metric_id).includes(q);
      const nameMatch = m.name.toLowerCase().includes(q);
      const unitMatch = m.unit?.toLowerCase().includes(q) ?? false;
      const pnlMatch = m.pnl_item?.toLowerCase().includes(q) ?? false;
      const ownerMatch = m.owner_name?.toLowerCase().includes(q) ?? false;

      if (!idMatch && !nameMatch && !unitMatch && !pnlMatch && !ownerMatch) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="flex flex-col min-h-screen pb-8 bg-app-bg text-brand-navy">
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 p-4 bg-scorecard-green text-white text-sm font-semibold rounded-lg shadow-xl animate-scale-up">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{notification}</span>
        </div>
      )}

      <AppHeader />

      <main className="p-6 max-w-7xl w-full mx-auto flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-brand-navy">Metric Catalog Cataloging</h2>
            <p className="text-sm text-app-muted">
              {isSuperadmin
                ? "Superadmin console: configure core metrics, units, and plant/process assignments across the network."
                : `Plant admin console: manage metrics catalog for the plant "${plantAdminPlant?.name || ""}"`}
            </p>
          </div>
          {!showAddRow && (
            <button
              onClick={handleAddRowClick}
              className="inline-flex items-center justify-center px-4 py-2 bg-brand-blue hover:bg-brand-navy text-white text-sm font-semibold rounded-lg shadow-sm transition-colors duration-100 self-start sm:self-auto"
            >
              + Add row
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-scorecard-red/10 border border-scorecard-red/20 text-scorecard-cell-text rounded-lg text-sm flex gap-2">
            <span className="font-bold text-scorecard-red">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <div className="bg-app-surface border border-app-border rounded-xl p-4 mb-6 shadow-sm flex flex-wrap gap-4 items-end">
          {isSuperadmin && (
            <div className="flex flex-col gap-1.5 min-w-[140px]">
              <label className="text-xs font-bold text-brand-navy uppercase tracking-wider">Plant</label>
              <select
                value={plantFilter}
                onChange={(e) => setPlantFilter(e.target.value)}
                className="px-3 py-2 border border-app-border rounded-lg text-sm bg-white font-semibold text-brand-navy focus:outline-none focus:border-brand-blue"
              >
                <option value="all">All Plants</option>
                {plants.map((p) => (
                  <option key={p.plant_id} value={String(p.plant_id)}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5 min-w-[140px] max-w-[280px] flex-1 sm:flex-initial">
            <label className="text-xs font-bold text-brand-navy uppercase tracking-wider">Process</label>
            <select
              value={processFilter}
              onChange={(e) => setProcessFilter(e.target.value)}
              className="px-3 py-2 border border-app-border rounded-lg text-sm bg-white font-semibold text-brand-navy focus:outline-none focus:border-brand-blue truncate"
            >
              <option value="all">All Processes</option>
              {processes.map((pr) => (
                <option key={pr.process_id} value={String(pr.process_id)}>
                  {pr.code} - {pr.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <label className="text-xs font-bold text-brand-navy uppercase tracking-wider">Area</label>
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="px-3 py-2 border border-app-border rounded-lg text-sm bg-white font-semibold text-brand-navy focus:outline-none focus:border-brand-blue"
            >
              <option value="all">All Areas</option>
              {areas.map((a) => (
                <option key={a.area_id} value={String(a.area_id)}>
                  {a.code}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-brand-navy uppercase tracking-wider">Search</label>
            <input
              type="text"
              placeholder="Search by name, ID, unit, owner or P&L..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-2 border border-app-border rounded-lg text-sm text-brand-navy focus:outline-none focus:border-brand-blue bg-white"
            />
          </div>
        </div>

        <div className="bg-app-surface border border-app-border rounded-xl shadow-sm overflow-visible">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="min-w-full divide-y divide-app-border table-fixed">
              <thead className="bg-app-surface-2">
                <tr>
                  <th className="w-1/12 px-4 py-3.5 text-left text-xs font-semibold text-brand-navy uppercase tracking-wider">
                    ID
                  </th>
                  <th className="w-1/4 px-4 py-3.5 text-left text-xs font-semibold text-brand-navy uppercase tracking-wider">
                    Metric Name
                  </th>
                  <th className="w-1/12 px-4 py-3.5 text-left text-xs font-semibold text-brand-navy uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="w-1/12 px-4 py-3.5 text-left text-xs font-semibold text-brand-navy uppercase tracking-wider">
                    Plant
                  </th>
                  <th className="w-[12%] px-4 py-3.5 text-left text-xs font-semibold text-brand-navy uppercase tracking-wider">
                    Process
                  </th>
                  <th className="w-[10%] px-4 py-3.5 text-left text-xs font-semibold text-brand-navy uppercase tracking-wider">
                    Area
                  </th>
                  <th className="w-[15%] px-4 py-3.5 text-left text-xs font-semibold text-brand-navy uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="w-[10%] px-4 py-3.5 text-left text-xs font-semibold text-brand-navy uppercase tracking-wider">
                    P&L Item
                  </th>
                  <th className="w-1/12 px-4 py-3.5 text-left text-xs font-semibold text-brand-navy uppercase tracking-wider">
                    Direction
                  </th>
                  <th className="w-[8%] px-4 py-3.5 text-left text-xs font-semibold text-brand-navy uppercase tracking-wider">
                    Status
                  </th>
                  <th className="w-1/12 px-4 py-3.5 text-center text-xs font-semibold text-brand-navy uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-app-border overflow-y-visible">
                {filteredMetrics.map((metric) => {
                  const isEditing = editingMetricId === metric.metric_id;
                  const eligibleOwners = getEligibleOwners(isEditing ? editingRow.plant_id : metric.plant_id);

                  if (isEditing) {
                    return (
                      <tr
                        key={metric.metric_id}
                        className="bg-brand-blue/5 border-2 border-brand-blue animate-fade-in overflow-y-visible"
                      >
                        <td className="px-3 py-3 text-sm font-bold text-app-muted">
                          {metric.metric_id}
                        </td>
                        <td className="px-2 py-3">
                          <input
                            type="text"
                            required
                            value={editingRow.name}
                            onChange={(e) => setEditingRow({ ...editingRow, name: e.target.value })}
                            onKeyDown={handleEditingKeyDown}
                            className="w-full px-2 py-1.5 border border-app-border rounded-lg text-sm text-brand-navy bg-white focus:outline-none focus:border-brand-blue font-semibold"
                            autoFocus
                          />
                        </td>
                        <td className="px-2 py-3">
                          <input
                            type="text"
                            placeholder="Unit"
                            value={editingRow.unit}
                            onChange={(e) => setEditingRow({ ...editingRow, unit: e.target.value })}
                            onKeyDown={handleEditingKeyDown}
                            className="w-full px-2 py-1.5 border border-app-border rounded-lg text-sm text-brand-navy bg-white focus:outline-none focus:border-brand-blue"
                          />
                        </td>

                        <td className="px-2 py-3">
                          <span className="text-sm font-bold text-brand-navy">
                            {metric.plant_code}
                          </span>
                        </td>

                        <td className="px-2 py-3">
                          <select
                            value={editingRow.process_id}
                            onChange={(e) => setEditingRow({ ...editingRow, process_id: parseInt(e.target.value, 10) })}
                            className="w-full px-2 py-1.5 border border-app-border rounded-lg text-sm bg-white text-brand-navy focus:outline-none focus:border-brand-blue truncate font-semibold"
                          >
                            {processes.map((pr) => (
                              <option key={pr.process_id} value={pr.process_id}>
                                {pr.code} - {pr.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-2 py-3">
                          <select
                            value={editingRow.area_id}
                            onChange={(e) => setEditingRow({ ...editingRow, area_id: parseInt(e.target.value, 10) })}
                            className="w-full px-2 py-1.5 border border-app-border rounded-lg text-sm bg-white text-brand-navy focus:outline-none focus:border-brand-blue font-semibold"
                          >
                            {areas.map((a) => (
                              <option key={a.area_id} value={a.area_id}>
                                {a.code}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-2 py-3">
                          <select
                            value={editingRow.owner_user_id ?? ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditingRow({ ...editingRow, owner_user_id: val ? parseInt(val, 10) : null });
                            }}
                            className="w-full px-2 py-1.5 border border-app-border rounded-lg text-sm bg-white text-brand-navy focus:outline-none focus:border-brand-blue truncate font-semibold"
                          >
                            <option value="">Unassigned</option>
                            {eligibleOwners.map((u) => (
                              <option key={u.user_id} value={u.user_id}>
                                {u.full_name}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-2 py-3">
                          <input
                            type="text"
                            placeholder="P&L"
                            value={editingRow.pnl_item}
                            onChange={(e) => setEditingRow({ ...editingRow, pnl_item: e.target.value })}
                            onKeyDown={handleEditingKeyDown}
                            className="w-full px-2 py-1.5 border border-app-border rounded-lg text-sm text-brand-navy bg-white focus:outline-none focus:border-brand-blue"
                          />
                        </td>

                        <td className="px-2 py-3">
                          <select
                            value={editingRow.higher_is_better ? "true" : "false"}
                            onChange={(e) => setEditingRow({ ...editingRow, higher_is_better: e.target.value === "true" })}
                            className="w-full px-2 py-1.5 border border-app-border rounded-lg text-sm bg-white text-brand-navy focus:outline-none focus:border-brand-blue font-semibold"
                          >
                            <option value="false">Lower is Better (▼)</option>
                            <option value="true">Higher is Better (▲)</option>
                          </select>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setEditingRow({ ...editingRow, active: !editingRow.active })}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold select-none cursor-pointer ${editingRow.active
                              ? "bg-scorecard-green/10 text-scorecard-green hover:bg-scorecard-green/20"
                              : "bg-scorecard-red/10 text-scorecard-red hover:bg-scorecard-red/20"
                              }`}
                          >
                            {editingRow.active ? "Active" : "Inactive"}
                          </button>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={saveEditingMetric}
                              disabled={submitting}
                              title="Save changes"
                              className="p-1 text-scorecard-green hover:bg-scorecard-green/10 rounded-full transition-colors"
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingMetricId(null)}
                              title="Cancel"
                              className="p-1 text-scorecard-red hover:bg-scorecard-red/10 rounded-full transition-colors"
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  const isAuthorizedToEdit = isSuperadmin || (metric.plant_id === currentUser.adminPlantId);

                  return (
                    <tr
                      key={metric.metric_id}
                      onDoubleClick={() => {
                        if (isAuthorizedToEdit) {
                          handleRowDoubleClick(metric);
                        }
                      }}
                      className={`hover:bg-app-surface-alt transition-colors duration-75 ${isAuthorizedToEdit ? "cursor-pointer" : ""
                        }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-brand-navy truncate">
                        {metric.metric_id}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-brand-navy truncate max-w-[200px]" title={metric.name}>
                        {metric.name}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-app-text truncate">
                        {metric.unit || "—"}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-brand-navy">
                        {metric.plant_code}
                      </td>
                      <td className="px-4 py-4 text-sm text-app-text truncate max-w-[120px]" title={metric.process_code}>
                        {metric.process_code}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-app-text">
                        {metric.area_code}
                      </td>
                      <td className="px-4 py-4 text-sm text-app-text truncate max-w-[120px]" title={metric.owner_name || ""}>
                        {metric.owner_name || "—"}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-app-text truncate">
                        {metric.pnl_item || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-brand-navy">
                        {metric.higher_is_better ? (
                          <span className="text-scorecard-green flex items-center gap-1">
                            ▲ Higher is Better
                          </span>
                        ) : (
                          <span className="text-scorecard-red flex items-center gap-1">
                            ▼ Lower is Better
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleMetricActive(metric)}
                          title="Click to toggle status"
                          disabled={submitting}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold transition-colors cursor-pointer select-none ${metric.active
                            ? "bg-scorecard-green/10 text-scorecard-green hover:bg-scorecard-green/20"
                            : "bg-scorecard-red/10 text-scorecard-red hover:bg-scorecard-red/20"
                            }`}
                        >
                          {metric.active ? "Active" : "Inactive"}
                        </button>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                        {isAuthorizedToEdit && (
                          <button
                            type="button"
                            onClick={() => handleRowDoubleClick(metric)}
                            title="Edit metric"
                            className="p-1 text-brand-blue hover:bg-brand-blue/10 rounded-full transition-colors"
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {showAddRow && (
                  <tr
                    ref={rowRef}
                    className="bg-brand-blue/5 border-2 border-brand-blue animate-fade-in overflow-y-visible"
                  >
                    <td className="px-2 py-3">
                      <input
                        type="text"
                        required
                        placeholder="e.g. 1031"
                        value={newRow.metric_id}
                        onChange={(e) => setNewRow({ ...newRow, metric_id: e.target.value })}
                        onKeyDown={handleKeyDown}
                        className="w-full px-2.5 py-1.5 border border-app-border rounded-lg text-sm text-brand-navy bg-white focus:outline-none focus:border-brand-blue font-mono font-bold"
                      />
                    </td>

                    <td className="px-2 py-3">
                      <input
                        type="text"
                        required
                        placeholder="Metric Name"
                        value={newRow.name}
                        onChange={(e) => setNewRow({ ...newRow, name: e.target.value })}
                        onKeyDown={handleKeyDown}
                        className="w-full px-2 py-1.5 border border-app-border rounded-lg text-sm text-brand-navy bg-white focus:outline-none focus:border-brand-blue font-semibold"
                        autoFocus
                      />
                    </td>

                    <td className="px-2 py-3">
                      <input
                        type="text"
                        placeholder="Unit"
                        value={newRow.unit}
                        onChange={(e) => setNewRow({ ...newRow, unit: e.target.value })}
                        onKeyDown={handleKeyDown}
                        className="w-full px-2 py-1.5 border border-app-border rounded-lg text-sm text-brand-navy bg-white focus:outline-none focus:border-brand-blue"
                      />
                    </td>

                    <td className="px-2 py-3">
                      {isSuperadmin ? (
                        <select
                          value={newRow.plant_id}
                          onChange={(e) => {
                            const newPlantId = parseInt(e.target.value, 10);
                            const eligibleForNew = getEligibleOwners(newPlantId);
                            const isCurrentOwnerEligible = eligibleForNew.some((u) => u.user_id === newRow.owner_user_id);
                            setNewRow({
                              ...newRow,
                              plant_id: newPlantId,
                              owner_user_id: isCurrentOwnerEligible ? newRow.owner_user_id : null,
                            });
                          }}
                          className="w-full px-2 py-1.5 border border-app-border rounded-lg text-sm bg-white text-brand-navy font-bold focus:outline-none focus:border-brand-blue"
                        >
                          {plants.map((p) => (
                            <option key={p.plant_id} value={p.plant_id}>
                              {p.code}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm font-bold text-brand-navy">
                          {plantAdminPlant?.code}
                        </span>
                      )}
                    </td>

                    <td className="px-2 py-3">
                      <select
                        value={newRow.process_id}
                        onChange={(e) => setNewRow({ ...newRow, process_id: parseInt(e.target.value, 10) })}
                        className="w-full px-2 py-1.5 border border-app-border rounded-lg text-sm bg-white text-brand-navy focus:outline-none focus:border-brand-blue truncate font-semibold"
                      >
                        {processes.map((pr) => (
                          <option key={pr.process_id} value={pr.process_id}>
                            {pr.code} - {pr.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-2 py-3">
                      <select
                        value={newRow.area_id}
                        onChange={(e) => setNewRow({ ...newRow, area_id: parseInt(e.target.value, 10) })}
                        className="w-full px-2 py-1.5 border border-app-border rounded-lg text-sm bg-white text-brand-navy focus:outline-none focus:border-brand-blue font-semibold"
                      >
                        {areas.map((a) => (
                          <option key={a.area_id} value={a.area_id}>
                            {a.code}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-2 py-3">
                      <select
                        value={newRow.owner_user_id ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewRow({ ...newRow, owner_user_id: val ? parseInt(val, 10) : null });
                        }}
                        className="w-full px-2 py-1.5 border border-app-border rounded-lg text-sm bg-white text-brand-navy focus:outline-none focus:border-brand-blue truncate font-semibold"
                      >
                        <option value="">Unassigned</option>
                        {getEligibleOwners(newRow.plant_id).map((u) => (
                          <option key={u.user_id} value={u.user_id}>
                            {u.full_name}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-2 py-3">
                      <input
                        type="text"
                        placeholder="P&L"
                        value={newRow.pnl_item}
                        onChange={(e) => setNewRow({ ...newRow, pnl_item: e.target.value })}
                        onKeyDown={handleKeyDown}
                        className="w-full px-2 py-1.5 border border-app-border rounded-lg text-sm text-brand-navy bg-white focus:outline-none focus:border-brand-blue"
                      />
                    </td>

                    <td className="px-2 py-3">
                      <select
                        value={newRow.higher_is_better ? "true" : "false"}
                        onChange={(e) => setNewRow({ ...newRow, higher_is_better: e.target.value === "true" })}
                        className="w-full px-2 py-1.5 border border-app-border rounded-lg text-sm bg-white text-brand-navy focus:outline-none focus:border-brand-blue font-semibold"
                      >
                        <option value="false">Lower is Better (▼)</option>
                        <option value="true">Higher is Better (▲)</option>
                      </select>
                    </td>

                    <td className="px-4 py-3 text-sm text-scorecard-green font-semibold">
                      Active
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={saveNewMetric}
                          disabled={submitting || !isNewRowMetricIdValid}
                          title="Save row"
                          className={`p-1 rounded-full transition-colors ${
                            !isNewRowMetricIdValid
                              ? "text-app-muted cursor-not-allowed opacity-50"
                              : "text-scorecard-green hover:bg-scorecard-green/10"
                          }`}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelAdd}
                          title="Cancel"
                          className="p-1 text-scorecard-red hover:bg-scorecard-red/10 rounded-full transition-colors"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

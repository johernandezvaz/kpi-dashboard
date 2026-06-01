"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";

interface UserListItem {
  user_id: number;
  email: string;
  full_name: string;
  is_admin: boolean;
  admin_plant_id: number | null;
  active: boolean;
  must_change_password: boolean;
  area_codes: string[] | null;
  admin_plant_code: string | null;
  plant_id: number | null;
  area_ids: number[] | null;
}

interface PlantItem {
  id: number;
  code: string;
  name: string;
}

interface AreaItem {
  id: number;
  code: string;
  name: string;
}

interface CurrentUser {
  isAdmin: boolean;
  adminPlantId: number | null;
}

interface AdminUsersClientProps {
  initialUsers: UserListItem[];
  plants: PlantItem[];
  areas: AreaItem[];
  currentUser: CurrentUser;
}

interface NewUserRow {
  email: string;
  full_name: string;
  is_admin: boolean;
  admin_plant_id: number;
  area_ids: number[];
}

interface SuccessData {
  email: string;
  fullName: string;
  temporaryPassword: string;
}

export default function AdminUsersClient({ initialUsers, plants, areas, currentUser }: AdminUsersClientProps) {
  const router = useRouter();
  const isSuperadmin = currentUser.adminPlantId === null || currentUser.adminPlantId === undefined;
  const plantAdminPlant = plants.find((p) => Number(p.id) === Number(currentUser.adminPlantId));

  const [users, setUsers] = useState<UserListItem[]>(initialUsers);
  const [showAddRow, setShowAddRow] = useState(false);
  const [newRow, setNewRow] = useState<NewUserRow>({
    email: "",
    full_name: "",
    is_admin: false,
    admin_plant_id: isSuperadmin ? (plants[0]?.id ?? 0) : Number(currentUser.adminPlantId ?? 0),
    area_ids: [],
  });

  const [areasOpen, setAreasOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [successType, setSuccessType] = useState<"created" | "reset">("created");
  const [copied, setCopied] = useState(false);

  // Selector modals state
  const [plantsOpen, setPlantsOpen] = useState(false);

  // Editing state
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<NewUserRow>({
    email: "",
    full_name: "",
    is_admin: false,
    admin_plant_id: 0,
    area_ids: [],
  });
  const [editingAreasOpen, setEditingAreasOpen] = useState(false);
  const [editingPlantsOpen, setEditingPlantsOpen] = useState(false);

  const rowRef = useRef<HTMLTableRowElement>(null);

  const handleRowDoubleClick = (user: UserListItem) => {
    if (editingUserId === user.user_id) return;

    if (!isSuperadmin) {
      if (user.is_admin && user.admin_plant_id === null) return;
      if (user.plant_id !== null && Number(user.plant_id) !== Number(currentUser.adminPlantId)) return;
    }

    setEditingUserId(user.user_id);
    setEditingRow({
      email: user.email,
      full_name: user.full_name,
      is_admin: user.is_admin,
      admin_plant_id: user.plant_id ?? (plants[0]?.id ?? 0),
      area_ids: user.area_ids ?? [],
    });
    setError(null);
    setEditingAreasOpen(false);
    setEditingPlantsOpen(false);
  };

  const saveEditingUser = async () => {
    if (editingUserId === null || submitting) return;

    const emailVal = editingRow.email.trim().toLowerCase();
    const nameVal = editingRow.full_name.trim();

    if (!nameVal) {
      setError("Full name is required.");
      return;
    }

    if (!emailVal || !emailVal.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (editingRow.area_ids.length === 0) {
      setError("At least one area must be assigned.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: editingUserId,
          email: emailVal,
          fullName: nameVal,
          plantId: editingRow.admin_plant_id,
          isPlantAdmin: isSuperadmin ? editingRow.is_admin : false,
          areaIds: editingRow.area_ids,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update user.");
      }

      const assignedPlant = plants.find((p) => p.id === editingRow.admin_plant_id);
      const assignedAreaCodes = areas.filter((a) => editingRow.area_ids.includes(a.id)).map((a) => a.code);

      setUsers(
        users.map((u) => {
          if (u.user_id === editingUserId) {
            return {
              ...u,
              email: emailVal,
              full_name: nameVal,
              is_admin: isSuperadmin ? editingRow.is_admin : false,
              admin_plant_id: editingRow.is_admin ? editingRow.admin_plant_id : null,
              area_codes: assignedAreaCodes,
              area_ids: editingRow.area_ids,
              plant_id: editingRow.admin_plant_id,
              admin_plant_code: assignedPlant ? assignedPlant.code : null,
            };
          }
          return u;
        })
      );

      setEditingUserId(null);
    } catch (err: any) {
      setError(err.message || "Failed to update user.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditingKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveEditingUser();
    } else if (e.key === "Escape") {
      setEditingUserId(null);
    }
  };

  const toggleUserActive = async (user: UserListItem) => {
    if (submitting) return;

    if (!isSuperadmin) {
      if (user.is_admin) return;
      if (user.plant_id !== null && Number(user.plant_id) !== Number(currentUser.adminPlantId)) return;
    }

    setSubmitting(true);
    setError(null);

    const newActiveState = !user.active;

    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.user_id,
          active: newActiveState,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to toggle status.");
      }

      setUsers(
        users.map((u) => (u.user_id === user.user_id ? { ...u, active: newActiveState } : u))
      );
    } catch (err: any) {
      setError(err.message || "Failed to toggle status.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetUserPassword = async (user: UserListItem) => {
    if (submitting) return;

    if (!isSuperadmin) {
      if (user.is_admin) return;
      if (user.plant_id !== null && Number(user.plant_id) !== Number(currentUser.adminPlantId)) return;
    }

    if (!confirm(`Are you sure you want to reset the password for ${user.full_name}?`)) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.user_id,
          resetPassword: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password.");
      }

      setUsers(
        users.map((u) => (u.user_id === user.user_id ? { ...u, must_change_password: true } : u))
      );

      setSuccessType("reset");
      setSuccessData({
        email: user.email,
        fullName: user.full_name,
        temporaryPassword: data.temporaryPassword,
      });
    } catch (err: any) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddRowClick = () => {
    setShowAddRow(true);
    setNewRow({
      email: "",
      full_name: "",

      is_admin: false,
      admin_plant_id: isSuperadmin ? (plants[0]?.id ?? 0) : (currentUser.adminPlantId ?? 0),
      area_ids: [],
    });
    setError(null);
    setAreasOpen(false);
    setPlantsOpen(false);
  };

  const handleCancelAdd = () => {
    setShowAddRow(false);
    setError(null);
    setAreasOpen(false);
    setPlantsOpen(false);
  };

  const handleAreaToggle = (areaId: number) => {
    const ids = newRow.area_ids.includes(areaId)
      ? newRow.area_ids.filter((id) => id !== areaId)
      : [...newRow.area_ids, areaId];
    setNewRow({ ...newRow, area_ids: ids });
  };

  const handleCopyPassword = async (password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) { }
  };

  const saveNewUser = async () => {
    if (submitting) return;

    const emailVal = newRow.email.trim().toLowerCase();
    const nameVal = newRow.full_name.trim();

    if (!nameVal && !emailVal) {
      setShowAddRow(false);
      return;
    }

    if (!nameVal) {
      setError("Full name is required.");
      return;
    }

    if (!emailVal || !emailVal.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (newRow.area_ids.length === 0) {
      setError("At least one area must be assigned.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: emailVal,
          fullName: nameVal,
          plantId: newRow.admin_plant_id,
          isPlantAdmin: isSuperadmin ? newRow.is_admin : false,
          areaIds: newRow.area_ids,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save user.");
      }

      const assignedPlant = plants.find((p) => p.id === newRow.admin_plant_id);
      const assignedAreaCodes = areas.filter((a) => newRow.area_ids.includes(a.id)).map((a) => a.code);

      const createdUser: UserListItem = {
        user_id: data.userId,
        email: emailVal,
        full_name: nameVal,
        is_admin: isSuperadmin ? newRow.is_admin : false,
        admin_plant_id: newRow.is_admin ? newRow.admin_plant_id : null,
        active: true,
        must_change_password: true,
        area_codes: assignedAreaCodes,
        admin_plant_code: assignedPlant ? assignedPlant.code : null,
        plant_id: newRow.admin_plant_id,
        area_ids: newRow.area_ids,
      };

      setUsers([...users, createdUser]);
      setSuccessType("created");
      setSuccessData({
        email: emailVal,
        fullName: nameVal,
        temporaryPassword: data.temporaryPassword,
      });
      setShowAddRow(false);
    } catch (err: any) {
      setError(err.message || "Failed to create user.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveNewUser();
    } else if (e.key === "Escape") {
      handleCancelAdd();
    }
  };

  return (
    <div className="flex flex-col min-h-screen pb-8 bg-app-bg">
      {areasOpen && (
        <div className="fixed inset-0 bg-brand-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-40 animate-fade-in">
          <div className="bg-app-surface border border-app-border rounded-xl shadow-2xl p-6 max-w-sm w-full animate-scale-up">
            <h3 className="text-sm font-bold text-brand-navy uppercase tracking-wider border-b border-app-border pb-2 mb-4">
              Select Functional Areas
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-6 pr-1">
              {areas.map((a) => (
                <label
                  key={a.id}
                  className="flex items-center gap-3 p-2 hover:bg-app-surface-2 border border-app-border rounded-lg cursor-pointer select-none transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={newRow.area_ids.includes(a.id)}
                    onChange={() => handleAreaToggle(a.id)}
                    className="w-4 h-4 text-brand-blue border-app-border rounded focus:ring-0 cursor-pointer"
                  />
                  <span className="text-sm text-brand-navy font-semibold">
                    <strong>{a.code}</strong>
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAreasOpen(false)}
              className="w-full py-2 bg-brand-navy hover:bg-brand-blue text-white font-semibold text-sm rounded-lg shadow transition-colors duration-150"
            >
              Confirm Selection ({newRow.area_ids.length})
            </button>
          </div>
        </div>
      )}

      {editingAreasOpen && (
        <div className="fixed inset-0 bg-brand-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-40 animate-fade-in">
          <div className="bg-app-surface border border-app-border rounded-xl shadow-2xl p-6 max-w-sm w-full animate-scale-up">
            <h3 className="text-sm font-bold text-brand-navy uppercase tracking-wider border-b border-app-border pb-2 mb-4">
              Select Functional Areas (Edit)
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-6 pr-1">
              {areas.map((a) => (
                <label
                  key={a.id}
                  className="flex items-center gap-3 p-2 hover:bg-app-surface-2 border border-app-border rounded-lg cursor-pointer select-none transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={editingRow.area_ids.includes(a.id)}
                    onChange={() => {
                      const ids = editingRow.area_ids.includes(a.id)
                        ? editingRow.area_ids.filter((id) => id !== a.id)
                        : [...editingRow.area_ids, a.id];
                      setEditingRow({ ...editingRow, area_ids: ids });
                    }}
                    className="w-4 h-4 text-brand-blue border-app-border rounded focus:ring-0 cursor-pointer"
                  />
                  <span className="text-sm text-brand-navy font-semibold">
                    <strong>{a.code}</strong>
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setEditingAreasOpen(false)}
              className="w-full py-2 bg-brand-navy hover:bg-brand-blue text-white font-semibold text-sm rounded-lg shadow transition-colors duration-150"
            >
              Confirm Selection ({editingRow.area_ids.length})
            </button>
          </div>
        </div>
      )}

      {plantsOpen && (
        <div className="fixed inset-0 bg-brand-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-40 animate-fade-in">
          <div className="bg-app-surface border border-app-border rounded-xl shadow-2xl p-6 max-w-sm w-full animate-scale-up">
            <h3 className="text-sm font-bold text-brand-navy uppercase tracking-wider border-b border-app-border pb-2 mb-4">
              Select Plant
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-6 pr-1">
              {plants.map((p) => (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 p-2 hover:bg-app-surface-2 border rounded-lg cursor-pointer select-none transition-colors ${
                    newRow.admin_plant_id === p.id
                      ? "bg-brand-blue/10 border-brand-blue"
                      : "border-app-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="newRowPlant"
                    checked={newRow.admin_plant_id === p.id}
                    onChange={() => setNewRow({ ...newRow, admin_plant_id: p.id })}
                    className="w-4 h-4 text-brand-blue border-app-border focus:ring-0 cursor-pointer"
                  />
                  <span className="text-sm text-brand-navy font-semibold">
                    <strong>{p.code}</strong> - {p.name}
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPlantsOpen(false)}
              className="w-full py-2 bg-brand-navy hover:bg-brand-blue text-white font-semibold text-sm rounded-lg shadow transition-colors duration-150"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {editingPlantsOpen && (
        <div className="fixed inset-0 bg-brand-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-40 animate-fade-in">
          <div className="bg-app-surface border border-app-border rounded-xl shadow-2xl p-6 max-w-sm w-full animate-scale-up">
            <h3 className="text-sm font-bold text-brand-navy uppercase tracking-wider border-b border-app-border pb-2 mb-4">
              Select Plant (Edit)
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-6 pr-1">
              {plants.map((p) => (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 p-2 hover:bg-app-surface-2 border rounded-lg cursor-pointer select-none transition-colors ${
                    editingRow.admin_plant_id === p.id
                      ? "bg-brand-blue/10 border-brand-blue"
                      : "border-app-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="editingRowPlant"
                    checked={editingRow.admin_plant_id === p.id}
                    onChange={() => setEditingRow({ ...editingRow, admin_plant_id: p.id })}
                    className="w-4 h-4 text-brand-blue border-app-border focus:ring-0 cursor-pointer"
                  />
                  <span className="text-sm text-brand-navy font-semibold">
                    <strong>{p.code}</strong> - {p.name}
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setEditingPlantsOpen(false)}
              className="w-full py-2 bg-brand-navy hover:bg-brand-blue text-white font-semibold text-sm rounded-lg shadow transition-colors duration-150"
            >
              Confirm
            </button>
          </div>
        </div>
      )}


      {successData && (
        <div className="fixed inset-0 bg-brand-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-app-surface border border-app-border rounded-xl shadow-2xl p-8 max-w-md w-full animate-scale-up">
            <div className="flex items-center justify-center w-12 h-12 bg-scorecard-green/10 text-scorecard-green rounded-full mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-center text-brand-navy mb-6">
              {successType === "reset" ? "Password Reset Successfully!" : "User Created Successfully!"}
            </h2>

            <div className="space-y-4 mb-6">
              <div className="p-3 bg-app-surface-2 rounded-lg border border-app-border">
                <span className="block text-xs font-semibold text-app-muted uppercase tracking-wider">Full Name</span>
                <span className="block text-sm font-bold text-brand-navy">{successData.fullName}</span>
              </div>
              <div className="p-3 bg-app-surface-2 rounded-lg border border-app-border">
                <span className="block text-xs font-semibold text-app-muted uppercase tracking-wider">Email Address</span>
                <span className="block text-sm font-bold text-brand-navy">{successData.email}</span>
              </div>
              <div className="p-4 bg-scorecard-yellow/10 rounded-lg border border-scorecard-yellow/30">
                <span className="block text-xs font-semibold text-scorecard-cell-text uppercase tracking-wider mb-1">
                  Temporary Password
                </span>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-base font-bold text-brand-navy select-all tracking-wider">
                    {successData.temporaryPassword}
                  </span>
                  <button
                    onClick={() => handleCopyPassword(successData.temporaryPassword)}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all duration-150 border ${copied
                      ? "bg-scorecard-green text-white border-scorecard-green"
                      : "bg-white text-brand-navy border-app-border hover:bg-app-surface-2"
                      }`}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-scorecard-red/10 border border-scorecard-red/30 rounded-lg mb-6">
              <div className="flex gap-2">
                <span className="text-scorecard-red font-bold text-sm">⚠</span>
                <p className="text-xs text-scorecard-cell-text leading-relaxed">
                  <strong>Important:</strong> This password is shown <strong>only once</strong>. Copy it now and hand it
                  to the user through a secure direct channel. After you close this view, the password cannot be retrieved.
                </p>
              </div>
            </div>

            <button
              onClick={() => setSuccessData(null)}
              className="w-full py-2.5 bg-brand-navy hover:bg-brand-blue text-white font-semibold text-sm rounded-lg shadow transition-colors duration-150"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <AppHeader />

      <main className="p-6 max-w-7xl w-full mx-auto flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-brand-navy">User Management</h2>
            <p className="text-sm text-app-muted">
              {isSuperadmin
                ? "Superadmin console: view and manage users across all manufacturing plants."
                : "Plant admin console: view and manage local users."}
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

        <div className="bg-app-surface border border-app-border rounded-xl shadow-sm overflow-visible">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="min-w-full divide-y divide-app-border table-fixed">
              <thead className="bg-app-surface-2">
                <tr>
                  <th className="w-1/5 px-6 py-3.5 text-left text-xs font-semibold text-brand-navy uppercase tracking-wider">
                    Full Name
                  </th>
                  <th className="w-1/4 px-6 py-3.5 text-left text-xs font-semibold text-brand-navy uppercase tracking-wider">
                    Email
                  </th>
                  <th className="w-1/6 px-6 py-3.5 text-left text-xs font-semibold text-brand-navy uppercase tracking-wider">
                    Role Badge
                  </th>
                  <th className="w-1/12 px-6 py-3.5 text-left text-xs font-semibold text-brand-navy uppercase tracking-wider">
                    Plant
                  </th>
                  <th className="w-1/6 px-6 py-3.5 text-left text-xs font-semibold text-brand-navy uppercase tracking-wider">
                    Areas
                  </th>
                  <th className="w-1/12 px-6 py-3.5 text-left text-xs font-semibold text-brand-navy uppercase tracking-wider">
                    Password Setup
                  </th>
                  <th className="w-1/12 px-6 py-3.5 text-left text-xs font-semibold text-brand-navy uppercase tracking-wider">
                    Status
                  </th>
                  <th className="w-1/12 px-6 py-3.5 text-center text-xs font-semibold text-brand-navy uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-app-border overflow-y-visible">
                {users.map((user) => {
                  const isEditing = editingUserId === user.user_id;

                  let role = "OPERATIONAL";
                  let badgeBg = "bg-app-surface-2 text-app-text";
                  if (user.is_admin) {
                    if (user.admin_plant_id === null) {
                      role = "SUPERADMIN";
                      badgeBg = "bg-brand-navy text-white";
                    } else {
                      role = "PLANT ADMIN";
                      badgeBg = "bg-brand-blue text-white";
                    }
                  }

                  const activeBadge = (
                    <button
                      type="button"
                      onClick={() => toggleUserActive(user)}
                      title="Click to toggle status"
                      disabled={submitting}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold transition-colors cursor-pointer select-none ${user.active
                          ? "bg-scorecard-green/10 text-scorecard-green hover:bg-scorecard-green/20"
                          : "bg-scorecard-red/10 text-scorecard-red hover:bg-scorecard-red/20"
                        }`}
                    >
                      {user.active ? "Active" : "Inactive"}
                    </button>
                  );

                  const passwordBadge = user.must_change_password ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-scorecard-yellow/20 text-scorecard-cell-text border border-scorecard-yellow/40">
                      pending
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-scorecard-green/20 text-scorecard-cell-text border border-scorecard-green/40">
                      ok
                    </span>
                  );

                  const formattedAreas =
                    user.area_codes && user.area_codes.length && user.area_codes[0] !== null
                      ? user.area_codes.map((code) => (
                        <span
                          key={code}
                          className="inline-flex items-center px-2 py-0.5 rounded bg-brand-gray text-brand-navy text-xs font-bold mr-1"
                        >
                          {code}
                        </span>
                      ))
                      : "—";

                  if (isEditing) {
                    return (
                      <tr key={user.user_id} className="bg-brand-blue/5 border-2 border-brand-blue animate-fade-in overflow-y-visible">
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            required
                            placeholder="Full Name"
                            value={editingRow.full_name}
                            onChange={(e) => setEditingRow({ ...editingRow, full_name: e.target.value })}
                            onKeyDown={handleEditingKeyDown}
                            className="w-full px-2.5 py-1.5 border border-app-border rounded-lg text-sm text-brand-navy bg-white focus:outline-none focus:border-brand-blue font-semibold"
                            autoFocus
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="email"
                            required
                            placeholder="email@safe-demo.com"
                            value={editingRow.email}
                            onChange={(e) => setEditingRow({ ...editingRow, email: e.target.value })}
                            onKeyDown={handleEditingKeyDown}
                            className="w-full px-2.5 py-1.5 border border-app-border rounded-lg text-sm text-brand-navy bg-white focus:outline-none focus:border-brand-blue"
                          />
                        </td>
                        <td className="px-4 py-3">
                          {isSuperadmin ? (
                            <select
                              value={editingRow.is_admin ? "true" : "false"}
                              onChange={(e) => {
                                const val = e.target.value === "true";
                                setEditingRow({ ...editingRow, is_admin: val });
                              }}
                              className="w-full px-2 py-1.5 border border-app-border rounded-lg text-sm bg-white text-brand-navy font-bold focus:outline-none focus:border-brand-blue"
                            >
                              <option value="false">OPERATIONAL</option>
                              <option value="true">PLANT ADMIN</option>
                            </select>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-app-surface-2 text-app-text border border-app-border">
                              {user.is_admin ? "PLANT ADMIN" : "OPERATIONAL"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isSuperadmin ? (
                            <button
                              type="button"
                              onClick={() => setEditingPlantsOpen(true)}
                              className="w-full px-2.5 py-1.5 border border-app-border rounded-lg text-sm bg-white text-brand-navy font-bold hover:bg-app-surface-2 flex items-center justify-between focus:outline-none"
                            >
                              <span className="truncate">
                                {plants.find((p) => p.id === editingRow.admin_plant_id)?.code ?? "Select plant..."}
                              </span>
                              <span className="ml-1 text-xs text-app-muted">⚙</span>
                            </button>
                          ) : (
                            <span className="text-sm font-bold text-brand-navy">
                              {user.admin_plant_code || plantAdminPlant?.code || "—"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 overflow-visible">
                          <div className="w-full text-left">
                            <button
                              type="button"
                              onClick={() => setEditingAreasOpen(true)}
                              className="w-full px-2.5 py-1.5 border border-app-border rounded-lg text-sm bg-white text-brand-navy font-bold hover:bg-app-surface-2 flex items-center justify-between focus:outline-none"
                            >
                              <span className="truncate">
                                {editingRow.area_ids.length === 0
                                  ? "Select areas..."
                                  : areas
                                    .filter((a) => editingRow.area_ids.includes(a.id))
                                    .map((a) => a.code)
                                    .join(", ")}
                              </span>
                              <span className="ml-1 text-xs text-app-muted">⚙</span>
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {passwordBadge}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {activeBadge}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={saveEditingUser}
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
                              onClick={() => setEditingUserId(null)}
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

                  const isAuthorizedToEdit = isSuperadmin || (user.plant_id !== null && Number(user.plant_id) === Number(currentUser.adminPlantId) && !user.is_admin);

                  return (
                    <tr
                      key={user.user_id}
                      onDoubleClick={() => {
                        if (isAuthorizedToEdit) {
                          handleRowDoubleClick(user);
                        }
                      }}
                      className={`hover:bg-app-surface-alt transition-colors duration-75 ${isAuthorizedToEdit ? "cursor-pointer" : ""
                        }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-brand-navy truncate">
                        {user.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-app-text truncate">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold tracking-wider uppercase ${badgeBg}`}>
                          {role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-brand-navy">
                        {user.admin_plant_code || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-app-text">
                        <div className="flex flex-wrap gap-1">{formattedAreas}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {passwordBadge}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {activeBadge}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                        {isAuthorizedToEdit && (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleRowDoubleClick(user)}
                              title="Edit user"
                              className="p-1 text-brand-blue hover:bg-brand-blue/10 rounded-full transition-colors"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => resetUserPassword(user)}
                              title="Reset password"
                              className="p-1 text-scorecard-yellow hover:bg-scorecard-yellow/10 rounded-full transition-colors"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {showAddRow && (
                  <tr ref={rowRef} className="bg-brand-blue/5 border-2 border-brand-blue animate-fade-in overflow-y-visible">
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        required
                        placeholder="Full Name"
                        value={newRow.full_name}
                        onChange={(e) => setNewRow({ ...newRow, full_name: e.target.value })}
                        onKeyDown={handleKeyDown}
                        className="w-full px-2.5 py-1.5 border border-app-border rounded-lg text-sm text-brand-navy bg-white focus:outline-none focus:border-brand-blue font-semibold"
                        autoFocus
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="email"
                        required
                        placeholder="email@safe-demo.com"
                        value={newRow.email}
                        onChange={(e) => setNewRow({ ...newRow, email: e.target.value })}
                        onKeyDown={handleKeyDown}
                        className="w-full px-2.5 py-1.5 border border-app-border rounded-lg text-sm text-brand-navy bg-white focus:outline-none focus:border-brand-blue"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {isSuperadmin ? (
                        <select
                          value={newRow.is_admin ? "true" : "false"}
                          onChange={(e) => {
                            const val = e.target.value === "true";
                            setNewRow({ ...newRow, is_admin: val });
                          }}
                          className="w-full px-2 py-1.5 border border-app-border rounded-lg text-sm bg-white text-brand-navy font-bold focus:outline-none focus:border-brand-blue"
                        >
                          <option value="false">OPERATIONAL</option>
                          <option value="true">PLANT ADMIN</option>
                        </select>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-app-surface-2 text-app-text border border-app-border">
                          OPERATIONAL
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isSuperadmin ? (
                        <button
                          type="button"
                          onClick={() => setPlantsOpen(true)}
                          className="w-full px-2.5 py-1.5 border border-app-border rounded-lg text-sm bg-white text-brand-navy font-bold hover:bg-app-surface-2 flex items-center justify-between focus:outline-none"
                        >
                          <span className="truncate">
                            {plants.find((p) => p.id === newRow.admin_plant_id)?.code ?? "Select plant..."}
                          </span>
                          <span className="ml-1 text-xs text-app-muted">⚙</span>
                        </button>
                      ) : (
                        <span className="text-sm font-bold text-brand-navy">
                          {plantAdminPlant?.code ?? ""}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 overflow-visible">
                      <div className="w-full text-left">
                        <button
                          type="button"
                          onClick={() => setAreasOpen(true)}
                          className="w-full px-2.5 py-1.5 border border-app-border rounded-lg text-sm bg-white text-brand-navy font-bold hover:bg-app-surface-2 flex items-center justify-between focus:outline-none"
                        >
                          <span className="truncate">
                            {newRow.area_ids.length === 0
                              ? "Select areas..."
                              : areas
                                .filter((a) => newRow.area_ids.includes(a.id))
                                .map((a) => a.code)
                                .join(", ")}
                          </span>
                          <span className="ml-1 text-xs text-app-muted">⚙</span>
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-app-muted">
                      pending
                    </td>
                    <td className="px-4 py-3 text-sm text-scorecard-green font-semibold">
                      Active
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={saveNewUser}
                          disabled={submitting}
                          title="Save row"
                          className="p-1 text-scorecard-green hover:bg-scorecard-green/10 rounded-full transition-colors"
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

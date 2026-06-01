"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Image from "next/image";

export default function ChangePasswordPage() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clientError = (): string | null => {
    if (newPassword.length > 0 && newPassword.length < 8) {
      return "New password must be at least 8 characters";
    }
    if (confirmPassword.length > 0 && newPassword !== confirmPassword) {
      return "Passwords do not match";
    }
    if (newPassword.length > 0 && newPassword === currentPassword) {
      return "New password must be different from current password";
    }
    return null;
  };

  const hint = clientError();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (hint) {
      setError(hint);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const data = (await res.json()) as { error?: string; ok?: boolean };

      if (!res.ok) {
        setError(data.error ?? "An error occurred");
        setLoading(false);
        return;
      }

      await signOut({ redirect: false });
      router.replace("/login?msg=password-changed");
    } catch {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-navy flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Image
            src="/safe-demo_logo-blc-Photoroom.png"
            alt="Safe Demo"
            width={160}
            height={48}
            className="h-12 w-auto object-contain"
            priority
          />
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-xl font-bold text-brand-navy mb-2 text-center">
            Change Password
          </h1>
          <p className="text-sm text-app-muted text-center mb-6">
            You must set a new password before continuing.
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="currentPassword"
                className="block text-sm font-medium text-brand-navy mb-1"
              >
                Current Password
              </label>
              <input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-brand-navy mb-1"
              >
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-brand-navy mb-1"
              >
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              />
              {hint && (
                <p className="mt-1 text-xs text-red-600">{hint}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !!hint}
              className="w-full py-2 px-4 bg-brand-blue text-white font-semibold rounded-lg text-sm hover:bg-brand-navy transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Saving…" : "Change Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function UserMenu() {
  const { data: session } = useSession();

  if (!session) return null;

  const label = session.user.name || session.user.email;

  return (
    <div className="flex items-center gap-3 shrink-0">
      <span className="text-sm text-white/80 hidden sm:block truncate max-w-[140px]">
        {label}
      </span>
      {session.user.isAdmin && (
        <Link
          href="/admin/users"
          className="px-3 py-1 rounded text-xs font-semibold text-white border border-white/30 hover:bg-white/10 transition-colors whitespace-nowrap"
        >
          Admin
        </Link>
      )}
      {session.user.isAdmin && (
        <Link
          href="/admin/metrics"
          className="px-3 py-1 rounded text-xs font-semibold text-white border border-white/30 hover:bg-white/10 transition-colors whitespace-nowrap"
        >
          Metrics
        </Link>
      )}
      {session.user.isAdmin && session.user.adminPlantId && (
        <Link
          href="/admin/targets"
          className="px-3 py-1 rounded text-xs font-semibold text-white border border-white/30 hover:bg-white/10 transition-colors whitespace-nowrap"
        >
          Targets
        </Link>
      )}
      {session.user.isAdmin && !session.user.adminPlantId && (
        <Link
          href="/admin/logs"
          className="px-3 py-1 rounded text-xs font-semibold text-white border border-white/30 hover:bg-white/10 transition-colors whitespace-nowrap"
        >
          Logs
        </Link>
      )}
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="px-3 py-1 rounded text-xs font-semibold text-white border border-white/30 hover:bg-white/10 transition-colors whitespace-nowrap"
      >
        Sign out
      </button>
    </div>
  );
}

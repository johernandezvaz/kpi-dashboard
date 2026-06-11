"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface NavLink {
  label: string;
  path: string;
  showFor: (isAdmin: boolean, adminPlantId: number | null, isGlobalViewer: boolean) => boolean;
}

const NAV_LINKS: NavLink[] = [
  {
    label: "Dashboard",
    path: "/",
    showFor: () => true,
  },
  {
    label: "Capture",
    path: "/capture",
    showFor: (_a, _p, isGV) => !isGV,
  },
  {
    label: "Issues",
    path: "/issues",
    showFor: (_a, _p, isGV) => !isGV,
  },
  {
    label: "Users",
    path: "/admin/users",
    showFor: (isAdmin, _p, isGV) => isAdmin && !isGV,
  },
  {
    label: "Metrics",
    path: "/admin/metrics",
    showFor: (isAdmin, _p, isGV) => isAdmin && !isGV,
  },
  {
    label: "Targets",
    path: "/admin/targets",
    showFor: (isAdmin, adminPlantId, isGV) => isAdmin && adminPlantId !== null && !isGV,
  },
  {
    label: "Thresholds",
    path: "/admin/thresholds",
    showFor: (isAdmin, _adminPlantId, isGV) => isAdmin && !isGV,
  },
  {
    label: "Logs",
    path: "/admin/logs",
    showFor: (isAdmin, adminPlantId, isGV) => isAdmin && adminPlantId === null && !isGV,
  },
];

export default function AppHeader() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (status !== "authenticated" || !session) return null;

  const { isAdmin, adminPlantId, isGlobalViewer, name, email } = session.user;
  const displayName = name || email;

  const visibleLinks = NAV_LINKS.filter((link) =>
    link.showFor(isAdmin, adminPlantId, isGlobalViewer)
  );

  function isActive(linkPath: string): boolean {
    if (linkPath === "/") return pathname === "/";
    return pathname === linkPath || pathname.startsWith(linkPath + "/");
  }

  return (
    <header className="flex items-center justify-between gap-6 flex-wrap px-6 py-[0.875rem] bg-brand-navy border-b-2 border-b-brand-blue sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/safe-demo_logo-blc-Photoroom.png"
            alt="Safe Demo"
            width={140}
            height={40}
            className="h-10 w-auto object-contain"
            priority
          />
          <h1 className="text-xl font-bold text-white tracking-[-0.01em]">CDI DTC</h1>
        </Link>
      </div>

      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        {visibleLinks.map((link) => (
          <Link
            key={link.path}
            href={link.path}
            className={`px-3 py-1 rounded text-xs font-semibold text-white border transition-colors whitespace-nowrap ${
              isActive(link.path)
                ? "bg-white/15 border-white/50"
                : "border-white/30 hover:bg-white/10"
            }`}
          >
            {link.label}
          </Link>
        ))}

        <span className="text-xs text-white/80 hidden sm:block truncate max-w-[140px] select-none">
          {displayName}
        </span>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="px-3 py-1 rounded text-xs font-semibold text-white border border-white/30 hover:bg-white/10 transition-colors whitespace-nowrap"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

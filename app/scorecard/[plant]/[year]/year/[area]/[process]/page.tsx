import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, isAuthorizedForPlant } from "@/lib/auth";
import { query } from "@/lib/db";
import YearlyDetailPanel from "@/components/YearlyDetailPanel";

interface PlantRow { plant_id: string; plant_name: string }
interface DimRow { name: string }

export default async function YearlyCellDetailPage({
  params,
}: {
  params: Promise<{ plant: string; year: string; area: string; process: string }>;
}) {
  const { plant, year, area, process: processCode } = await params;

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const authorized = session.user.isGlobalViewer || await isAuthorizedForPlant(session, plant);
  if (!authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-app-bg p-6">
        <div className="bg-app-surface border border-app-border rounded-xl p-8 max-w-md w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-scorecard-red/10 rounded-full flex items-center justify-center mx-auto mb-4 text-scorecard-red text-2xl font-bold">⚠</div>
          <h2 className="text-lg font-bold text-brand-navy mb-2">Access Denied</h2>
          <p className="text-sm text-app-muted mb-6">You do not have permission to view scorecard details for <strong>{plant}</strong>.</p>
          <Link href="/" className="inline-block px-4 py-2 bg-brand-navy hover:bg-brand-blue text-white rounded text-sm font-semibold transition-colors duration-100">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const yearNum = parseInt(year, 10);
  const areaDecoded = decodeURIComponent(area);

  const [plantRes, areaRes, processRes] = await Promise.all([
    query<PlantRow>(`SELECT plant_id::text, name AS plant_name FROM plant WHERE code = $1 AND active = true`, [plant]),
    query<DimRow>(`SELECT name FROM area WHERE code = $1`, [areaDecoded]),
    query<DimRow>(`SELECT name FROM process WHERE code = $1`, [processCode]),
  ]);

  if ((plantRes.rowCount ?? 0) === 0 || (areaRes.rowCount ?? 0) === 0 || (processRes.rowCount ?? 0) === 0) {
    notFound();
  }

  const plantLabel = plantRes.rows[0].plant_name;
  const areaLabel = areaRes.rows[0].name;
  const processLabel = processRes.rows[0].name;

  const backHref = `/?plant=${plant}&year=${year}&mode=year`;
  const apiUrl = `/api/scorecard/yearly-cell?plant=${encodeURIComponent(plant)}&year=${year}&area=${encodeURIComponent(area)}&process=${encodeURIComponent(processCode)}`;

  return (
    <div className="flex flex-col min-h-screen pb-8">
      <header className="flex items-center gap-4 px-6 py-[0.875rem] bg-brand-navy border-b-2 border-b-brand-blue sticky top-0 z-10">
        <Link href={backHref} className="flex items-center gap-1.5 text-white/70 hover:text-white text-[0.8rem] font-semibold transition-colors duration-100 shrink-0">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 2L3 7l6 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to results
        </Link>
        <div className="h-4 w-px bg-white/20" aria-hidden="true" />
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-white/50">Annual Detail</span>
          <h1 className="text-[0.95rem] font-bold text-white tracking-[-0.01em] truncate">
            {areaLabel} &middot; {processLabel} &middot; {plantLabel} &mdash; Year {yearNum}
          </h1>
        </div>
      </header>
      <main className="flex-1 flex flex-col max-w-[96rem] w-full mx-auto px-6 pt-6">
        <div className="rounded-xl border border-brand-navy/20 bg-app-surface shadow-sm overflow-hidden flex flex-col">
          <YearlyDetailPanel apiUrl={apiUrl} />
        </div>
      </main>
    </div>
  );
}

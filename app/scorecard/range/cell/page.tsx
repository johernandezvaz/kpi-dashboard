import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, isAuthorizedForPlant } from "@/lib/auth";
import { query } from "@/lib/db";
import RangeDetailPanel from "@/components/RangeDetailPanel";

interface PlantRow { plant_name: string }
interface DimRow { name: string }

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function RangeCellDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ plant?: string; startYear?: string; startMonth?: string; endYear?: string; endMonth?: string; area?: string; process?: string }>;
}) {
  const { plant, startYear, startMonth, endYear, endMonth, area, process: proc } = await searchParams;

  if (!plant || !startYear || !startMonth || !endYear || !endMonth || !area || !proc) {
    notFound();
  }

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

  const sy = parseInt(startYear, 10);
  const sm = parseInt(startMonth, 10);
  const ey = parseInt(endYear, 10);
  const em = parseInt(endMonth, 10);
  const areaDecoded = decodeURIComponent(area);

  const [plantRes, areaRes, processRes] = await Promise.all([
    query<PlantRow>(`SELECT name AS plant_name FROM plant WHERE code = $1 AND active = true`, [plant]),
    query<DimRow>(`SELECT name FROM area WHERE code = $1`, [areaDecoded]),
    query<DimRow>(`SELECT name FROM process WHERE code = $1`, [proc]),
  ]);

  if ((plantRes.rowCount ?? 0) === 0 || (areaRes.rowCount ?? 0) === 0 || (processRes.rowCount ?? 0) === 0) notFound();

  const plantLabel = plantRes.rows[0].plant_name;
  const areaLabel = areaRes.rows[0].name;
  const processLabel = processRes.rows[0].name;

  const startLabel = `${MONTH_ABBR[sm - 1]} ${sy}`;
  const endLabel   = `${MONTH_ABBR[em - 1]} ${ey}`;

  const params = new URLSearchParams({ plant, startYear, startMonth, endYear, endMonth, area, process: proc });
  const apiUrl = `/api/scorecard/range-cell?${params.toString()}`;
  const backHref = `/?plant=${plant}&mode=range&startYear=${sy}&startMonth=${sm}&endYear=${ey}&endMonth=${em}`;

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
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-white/50">Range Detail</span>
          <h1 className="text-[0.95rem] font-bold text-white tracking-[-0.01em] truncate">
            {areaLabel} &middot; {processLabel} &middot; {plantLabel} &mdash; {startLabel} → {endLabel}
          </h1>
        </div>
      </header>
      <main className="flex-1 flex flex-col max-w-[96rem] w-full mx-auto px-6 pt-6">
        <div className="rounded-xl border border-brand-navy/20 bg-app-surface shadow-sm overflow-hidden flex flex-col">
          <RangeDetailPanel apiUrl={apiUrl} />
        </div>
      </main>
    </div>
  );
}

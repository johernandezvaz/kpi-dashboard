import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, isAuthorizedForPlant } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDbMetricColor } from "@/lib/scorecard";
import type { DbMetricRow, TrendPoint } from "@/lib/scorecard";
import DetailChartPanel from "@/components/DetailChartPanel";

interface PlantRow   { plant_id: string; plant_name: string; }
interface DimRow     { id: string; name: string; }
interface PeriodRow  { period_id: string; month_label: string; }
interface MetricRow  {
  metric_id: string;
  name: string;
  owner: string;
  result_value: string | null;
  yellow_limit: string | null;
  green_limit: string | null;
  higher_is_better: boolean;
  extra_label: string;
}
interface HistoryRow { label: string; compliance_ratio: string; }

export default async function TotalDetailPage({
  params,
}: {
  params: Promise<{ dimension: string; code: string; plant: string; year: string; month: string }>;
}) {
  const { dimension, code, plant, year, month } = await params;

  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const authorized = await isAuthorizedForPlant(session, plant);
  if (!authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-app-bg p-6">
        <div className="bg-app-surface border border-app-border rounded-xl p-8 max-w-md w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-scorecard-red/10 rounded-full flex items-center justify-center mx-auto mb-4 text-scorecard-red text-2xl font-bold">
            ⚠
          </div>
          <h2 className="text-lg font-bold text-brand-navy mb-2">Access Denied</h2>
          <p className="text-sm text-app-muted mb-6 leading-relaxed">
            You do not have permission to view scorecard details for the plant <strong>{plant}</strong>.
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-brand-navy hover:bg-brand-blue text-white rounded text-sm font-semibold transition-colors duration-100"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const yearNum  = parseInt(year, 10);
  const monthNum = parseInt(month, 10);
  const codeDecoded = decodeURIComponent(code);
  const isProcess = dimension === "process";

  const [plantRes, dimRes, periodRes] = await Promise.all([
    query<PlantRow>(
      `SELECT plant_id::text, name AS plant_name FROM plant WHERE code = $1 AND active = true`,
      [plant]
    ),
    isProcess
      ? query<DimRow>(
          `SELECT process_id::text AS id, name FROM process WHERE code = $1`,
          [codeDecoded]
        )
      : query<DimRow>(
          `SELECT area_id::text AS id, name FROM area WHERE code = $1`,
          [codeDecoded]
        ),
    query<PeriodRow>(
      `SELECT period_id::text,
              to_char(period_date, 'FMMonth') AS month_label
       FROM period
       WHERE EXTRACT(YEAR  FROM period_date)::int = $1
         AND EXTRACT(MONTH FROM period_date)::int = $2`,
      [yearNum, monthNum]
    ),
  ]);

  if (
    (plantRes.rowCount ?? 0) === 0 ||
    (dimRes.rowCount ?? 0) === 0 ||
    (periodRes.rowCount ?? 0) === 0
  ) {
    notFound();
  }

  const plantId    = plantRes.rows[0].plant_id;
  const plantLabel = plantRes.rows[0].plant_name;
  const dimId      = dimRes.rows[0].id;
  const dimLabel   = dimRes.rows[0].name;
  const periodId   = periodRes.rows[0].period_id;
  const monthLabel = periodRes.rows[0].month_label;

  const metricsQuery = isProcess
    ? query<MetricRow>(
        `SELECT
           m.metric_id::text               AS metric_id,
           m.name,
           COALESCE(u.full_name, '')       AS owner,
           mr.result_value::text,
           mt.yellow_limit::text,
           mt.green_limit::text,
           m.higher_is_better,
           a.name                          AS extra_label
         FROM metric_result mr
         JOIN metric  m ON m.metric_id  = mr.metric_id
         JOIN area    a ON a.area_id    = m.area_id
         LEFT JOIN metric_target mt
                ON mt.plant_id  = mr.plant_id
               AND mt.metric_id = mr.metric_id
               AND mt.period_id = mr.period_id
         LEFT JOIN app_user u ON u.user_id = mr.owner_user_id
         WHERE mr.plant_id   = $1
           AND mr.period_id  = $2
           AND m.process_id  = $3
         ORDER BY a.sort_order, m.name`,
        [plantId, periodId, dimId]
      )
    : query<MetricRow>(
        `SELECT
           m.metric_id::text               AS metric_id,
           m.name,
           COALESCE(u.full_name, '')       AS owner,
           mr.result_value::text,
           mt.yellow_limit::text,
           mt.green_limit::text,
           m.higher_is_better,
           p.name                          AS extra_label
         FROM metric_result mr
         JOIN metric  m ON m.metric_id  = mr.metric_id
         JOIN process p ON p.process_id = m.process_id
         LEFT JOIN metric_target mt
                ON mt.plant_id  = mr.plant_id
               AND mt.metric_id = mr.metric_id
               AND mt.period_id = mr.period_id
         LEFT JOIN app_user u ON u.user_id = mr.owner_user_id
         WHERE mr.plant_id  = $1
           AND mr.period_id = $2
           AND m.area_id    = $3
         ORDER BY p.sort_order, m.name`,
        [plantId, periodId, dimId]
      );

  const historyQuery = isProcess
    ? query<HistoryRow>(
        `SELECT
           to_char(period_date, 'Mon YY') AS label,
           compliance_ratio::text
         FROM v_process_compliance_history
         WHERE plant_id   = $1
           AND process_id = $2
         ORDER BY period_date DESC
         LIMIT 12`,
        [plantId, dimId]
      )
    : query<HistoryRow>(
        `SELECT
           to_char(period_date, 'Mon YY') AS label,
           compliance_ratio::text
         FROM v_area_compliance_history
         WHERE plant_id = $1
           AND area_id  = $2
         ORDER BY period_date DESC
         LIMIT 12`,
        [plantId, dimId]
      );

  const [metricsRes, historyRes] = await Promise.all([metricsQuery, historyQuery]);

  const metrics: DbMetricRow[] = metricsRes.rows.map((r) => {
    const resultValue    = r.result_value !== null ? Number(r.result_value)  : null;
    const yellowLimit    = r.yellow_limit !== null ? Number(r.yellow_limit)  : null;
    const greenLimit     = r.green_limit  !== null ? Number(r.green_limit)   : null;
    const higherIsBetter = Boolean(r.higher_is_better);
    return {
      metricId: r.metric_id,
      name: r.name,
      responsible: r.owner,
      resultValue,
      yellowLimit,
      greenLimit,
      higherIsBetter,
      color: getDbMetricColor({ resultValue, yellowLimit, greenLimit, higherIsBetter }),
      extraLabel: r.extra_label,
    };
  });

  const generalSeries: TrendPoint[] = [...historyRes.rows]
    .reverse()
    .map((r) => ({
      label: r.label,
      value: Math.round(Number(r.compliance_ratio) * 1000) / 10,
    }));

  const extraColumnHeader = isProcess ? "Area" : "Process";
  const generalKey  = `total-${dimension}-${codeDecoded}`;
  const backHref    = `/?plant=${plant}&year=${year}&month=${month}`;
  const breadcrumb  = isProcess
    ? `Results / Total · Process ${dimLabel} · ${plantLabel} — ${monthLabel} ${year}`
    : `Results / Total · Area ${dimLabel} · ${plantLabel} — ${monthLabel} ${year}`;

  return (
    <div className="flex flex-col min-h-screen pb-8">
      <header className="flex items-center gap-4 px-6 py-[0.875rem] bg-brand-navy border-b-2 border-b-brand-blue sticky top-0 z-10">
        <Link
          href={backHref}
          className="flex items-center gap-1.5 text-white/70 hover:text-white text-[0.8rem] font-semibold transition-colors duration-100 shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 2L3 7l6 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to results
        </Link>
        <div className="h-4 w-px bg-white/20" aria-hidden="true" />
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-white/50">
            Total Detail
          </span>
          <h1 className="text-[0.95rem] font-bold text-white tracking-[-0.01em] truncate">
            {breadcrumb}
          </h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-5xl w-full mx-auto px-6 pt-6">
        <div className="rounded-xl border border-brand-navy/20 bg-app-surface shadow-sm overflow-hidden flex flex-col">
          <DetailChartPanel
            plantCode={plant}
            year={yearNum}
            month={monthNum}
            generalSeries={generalSeries}
            generalKey={generalKey}
            pageLabel={dimLabel}
            metrics={metrics}
            extraColumnHeader={extraColumnHeader}
          />
          <div className="px-5 py-2 border-t border-t-brand-navy/15 bg-app-surface-2 flex items-center">
            <span className="text-[0.72rem] text-app-muted">
              {metrics.length} metric{metrics.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

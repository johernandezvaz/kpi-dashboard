import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAuthorizedForPlant } from "@/lib/auth";
import { query } from "@/lib/db";
import type {
  DbCell,
  DbProcessTotal,
  DbAreaTotal,
  DbOverall,
  DbDimension,
} from "@/lib/scorecard";

export const dynamic = "force-dynamic";

interface PlantRow { plant_id: string }
interface PeriodRow { period_id: string }
interface CellRow { area_code: string; process_code: string; metrics_count: number; total_score: number; compliance_ratio: number; color: string }
interface ProcessTotalRow { process_code: string; metrics_count: number; total_score: number; compliance_ratio: number; color: string }
interface AreaTotalRow { area_code: string; metrics_count: number; total_score: number; compliance_ratio: number; color: string }
interface OverallRow { metrics_count: number; total_score: number; compliance_ratio: number; color: string }
interface DimensionRow { code: string; name: string; sort_order: number }

const RANGE_CELL_SQL = `
WITH scored AS (
  SELECT
    m.area_id,
    m.process_id,
    CASE WHEN m.higher_is_better THEN
      CASE WHEN mr.result_value >= mt.green_limit  THEN 2
           WHEN mr.result_value >= mt.yellow_limit THEN 1
           ELSE 0 END
    ELSE
      CASE WHEN mr.result_value <= mt.green_limit  THEN 2
           WHEN mr.result_value <= mt.yellow_limit THEN 1
           ELSE 0 END
    END AS score
  FROM metric_result mr
  JOIN metric        m  ON m.metric_id  = mr.metric_id
  JOIN period        p  ON p.period_id  = mr.period_id
  JOIN metric_target mt ON mt.plant_id  = mr.plant_id
                        AND mt.metric_id = mr.metric_id
                        AND mt.period_id = mr.period_id
  WHERE mr.plant_id       = $1
    AND mr.result_value   IS NOT NULL
    AND p.period_date >= make_date($2::int, $3::int, 1)
    AND p.period_date <= make_date($4::int, $5::int, 1)
)
SELECT
  a.code  AS area_code,
  pr.code AS process_code,
  COUNT(*)::int                                                           AS metrics_count,
  SUM(s.score)::int                                                       AS total_score,
  ROUND(SUM(s.score)::numeric / NULLIF(2 * COUNT(*), 0), 4)              AS compliance_ratio,
  CASE
    WHEN ROUND(SUM(s.score)::numeric / NULLIF(2 * COUNT(*), 0), 4)
         >= (SELECT green_min  FROM scorecard_threshold WHERE effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1) THEN 'green'
    WHEN ROUND(SUM(s.score)::numeric / NULLIF(2 * COUNT(*), 0), 4)
         >= (SELECT yellow_min FROM scorecard_threshold WHERE effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1) THEN 'yellow'
    ELSE 'red'
  END AS color
FROM scored s
JOIN area    a  ON a.area_id    = s.area_id
JOIN process pr ON pr.process_id = s.process_id
GROUP BY s.area_id, a.code, s.process_id, pr.code
`;

const RANGE_PROCESS_SQL = `
WITH scored AS (
  SELECT
    m.process_id,
    CASE WHEN m.higher_is_better THEN
      CASE WHEN mr.result_value >= mt.green_limit  THEN 2
           WHEN mr.result_value >= mt.yellow_limit THEN 1
           ELSE 0 END
    ELSE
      CASE WHEN mr.result_value <= mt.green_limit  THEN 2
           WHEN mr.result_value <= mt.yellow_limit THEN 1
           ELSE 0 END
    END AS score
  FROM metric_result mr
  JOIN metric        m  ON m.metric_id  = mr.metric_id
  JOIN period        p  ON p.period_id  = mr.period_id
  JOIN metric_target mt ON mt.plant_id  = mr.plant_id
                        AND mt.metric_id = mr.metric_id
                        AND mt.period_id = mr.period_id
  WHERE mr.plant_id      = $1
    AND mr.result_value  IS NOT NULL
    AND p.period_date >= make_date($2::int, $3::int, 1)
    AND p.period_date <= make_date($4::int, $5::int, 1)
)
SELECT
  pr.code AS process_code,
  COUNT(*)::int                                                           AS metrics_count,
  SUM(s.score)::int                                                       AS total_score,
  ROUND(SUM(s.score)::numeric / NULLIF(2 * COUNT(*), 0), 4)              AS compliance_ratio,
  CASE
    WHEN ROUND(SUM(s.score)::numeric / NULLIF(2 * COUNT(*), 0), 4)
         >= (SELECT green_min  FROM scorecard_threshold WHERE effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1) THEN 'green'
    WHEN ROUND(SUM(s.score)::numeric / NULLIF(2 * COUNT(*), 0), 4)
         >= (SELECT yellow_min FROM scorecard_threshold WHERE effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1) THEN 'yellow'
    ELSE 'red'
  END AS color
FROM scored s
JOIN process pr ON pr.process_id = s.process_id
GROUP BY s.process_id, pr.code
`;

const RANGE_AREA_SQL = `
WITH scored AS (
  SELECT
    m.area_id,
    CASE WHEN m.higher_is_better THEN
      CASE WHEN mr.result_value >= mt.green_limit  THEN 2
           WHEN mr.result_value >= mt.yellow_limit THEN 1
           ELSE 0 END
    ELSE
      CASE WHEN mr.result_value <= mt.green_limit  THEN 2
           WHEN mr.result_value <= mt.yellow_limit THEN 1
           ELSE 0 END
    END AS score
  FROM metric_result mr
  JOIN metric        m  ON m.metric_id  = mr.metric_id
  JOIN period        p  ON p.period_id  = mr.period_id
  JOIN metric_target mt ON mt.plant_id  = mr.plant_id
                        AND mt.metric_id = mr.metric_id
                        AND mt.period_id = mr.period_id
  WHERE mr.plant_id      = $1
    AND mr.result_value  IS NOT NULL
    AND p.period_date >= make_date($2::int, $3::int, 1)
    AND p.period_date <= make_date($4::int, $5::int, 1)
)
SELECT
  a.code AS area_code,
  COUNT(*)::int                                                           AS metrics_count,
  SUM(s.score)::int                                                       AS total_score,
  ROUND(SUM(s.score)::numeric / NULLIF(2 * COUNT(*), 0), 4)              AS compliance_ratio,
  CASE
    WHEN ROUND(SUM(s.score)::numeric / NULLIF(2 * COUNT(*), 0), 4)
         >= (SELECT green_min  FROM scorecard_threshold WHERE effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1) THEN 'green'
    WHEN ROUND(SUM(s.score)::numeric / NULLIF(2 * COUNT(*), 0), 4)
         >= (SELECT yellow_min FROM scorecard_threshold WHERE effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1) THEN 'yellow'
    ELSE 'red'
  END AS color
FROM scored s
JOIN area a ON a.area_id = s.area_id
GROUP BY s.area_id, a.code
`;

const RANGE_OVERALL_SQL = `
WITH scored AS (
  SELECT
    CASE WHEN m.higher_is_better THEN
      CASE WHEN mr.result_value >= mt.green_limit  THEN 2
           WHEN mr.result_value >= mt.yellow_limit THEN 1
           ELSE 0 END
    ELSE
      CASE WHEN mr.result_value <= mt.green_limit  THEN 2
           WHEN mr.result_value <= mt.yellow_limit THEN 1
           ELSE 0 END
    END AS score
  FROM metric_result mr
  JOIN metric        m  ON m.metric_id  = mr.metric_id
  JOIN period        p  ON p.period_id  = mr.period_id
  JOIN metric_target mt ON mt.plant_id  = mr.plant_id
                        AND mt.metric_id = mr.metric_id
                        AND mt.period_id = mr.period_id
  WHERE mr.plant_id      = $1
    AND mr.result_value  IS NOT NULL
    AND p.period_date >= make_date($2::int, $3::int, 1)
    AND p.period_date <= make_date($4::int, $5::int, 1)
)
SELECT
  COUNT(*)::int                                                           AS metrics_count,
  SUM(score)::int                                                         AS total_score,
  ROUND(SUM(score)::numeric / NULLIF(2 * COUNT(*), 0), 4)               AS compliance_ratio,
  CASE
    WHEN ROUND(SUM(score)::numeric / NULLIF(2 * COUNT(*), 0), 4)
         >= (SELECT green_min  FROM scorecard_threshold WHERE effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1) THEN 'green'
    WHEN ROUND(SUM(score)::numeric / NULLIF(2 * COUNT(*), 0), 4)
         >= (SELECT yellow_min FROM scorecard_threshold WHERE effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1) THEN 'yellow'
    ELSE 'red'
  END AS color
FROM scored
`;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const plantCode = searchParams.get("plant");
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  const mode = searchParams.get("mode") ?? "month";

  if (!plantCode) {
    return NextResponse.json({ error: "Missing required query param: plant" }, { status: 400 });
  }

  if (mode === "range") {
    const startYear  = searchParams.get("startYear");
    const startMonth = searchParams.get("startMonth");
    const endYear    = searchParams.get("endYear");
    const endMonth   = searchParams.get("endMonth");

    if (!startYear || !startMonth || !endYear || !endMonth) {
      return NextResponse.json(
        { error: "mode=range requires startYear, startMonth, endYear, endMonth" },
        { status: 400 }
      );
    }

    const sy = parseInt(startYear, 10);
    const sm = parseInt(startMonth, 10);
    const ey = parseInt(endYear, 10);
    const em = parseInt(endMonth, 10);

    if ([sy, sm, ey, em].some(isNaN)) {
      return NextResponse.json({ error: "startYear, startMonth, endYear, endMonth must be integers" }, { status: 400 });
    }

    if (ey < sy || (ey === sy && em < sm)) {
      return NextResponse.json({ error: "End period must be on or after Start period" }, { status: 400 });
    }

    try {
      const session = await getServerSession(authOptions);
      if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const authorized = session.user.isGlobalViewer || await isAuthorizedForPlant(session, plantCode);
      if (!authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const plantResult = await query<PlantRow>(
        `SELECT plant_id::text FROM plant WHERE code = $1 AND active = true`,
        [plantCode]
      );
      if (plantResult.rowCount === 0) return NextResponse.json({ error: "Plant not found" }, { status: 404 });
      const plantId = plantResult.rows[0].plant_id;

      const rangeParams = [plantId, sy, sm, ey, em];

      const [cellsRes, processTotalsRes, areaTotalsRes, overallRes, processesRes, areasRes] =
        await Promise.all([
          query<CellRow>(RANGE_CELL_SQL, rangeParams),
          query<ProcessTotalRow>(RANGE_PROCESS_SQL, rangeParams),
          query<AreaTotalRow>(RANGE_AREA_SQL, rangeParams),
          query<OverallRow>(RANGE_OVERALL_SQL, rangeParams),
          query<DimensionRow>(`SELECT code, name, sort_order FROM process WHERE active = true ORDER BY sort_order`, []),
          query<DimensionRow>(`SELECT code, name, sort_order FROM area WHERE active = true ORDER BY sort_order`, []),
        ]);

      return NextResponse.json({
        cells: cellsRes.rows.map((r) => ({
          areaCode: r.area_code,
          processCode: r.process_code,
          metricsCount: Number(r.metrics_count),
          totalScore: Number(r.total_score),
          ratio: Number(r.compliance_ratio),
          color: r.color as DbCell["color"],
        })),
        processTotals: processTotalsRes.rows.map((r) => ({
          processCode: r.process_code,
          metricsCount: Number(r.metrics_count),
          totalScore: Number(r.total_score),
          ratio: Number(r.compliance_ratio),
          color: r.color as DbProcessTotal["color"],
        })),
        areaTotals: areaTotalsRes.rows.map((r) => ({
          areaCode: r.area_code,
          metricsCount: Number(r.metrics_count),
          totalScore: Number(r.total_score),
          ratio: Number(r.compliance_ratio),
          color: r.color as DbAreaTotal["color"],
        })),
        overall: (overallRes.rowCount ?? 0) > 0
          ? {
            metricsCount: Number(overallRes.rows[0].metrics_count),
            totalScore: Number(overallRes.rows[0].total_score),
            ratio: Number(overallRes.rows[0].compliance_ratio),
            color: overallRes.rows[0].color as DbOverall["color"],
          }
          : null,
        processes: processesRes.rows.map((r) => ({ code: r.code, label: r.name, sortOrder: Number(r.sort_order) })),
        areas: areasRes.rows.map((r) => ({ code: r.code, label: r.name, sortOrder: Number(r.sort_order) })),
      });
    } catch (err) {
      console.error("[/api/scorecard range] DB error:", err);
      return NextResponse.json({ error: "Database query failed" }, { status: 500 });
    }
  }

  if (!year) {
    return NextResponse.json({ error: "Missing required query param: year" }, { status: 400 });
  }

  if (mode === "month" && !month) {
    return NextResponse.json({ error: "Missing required query param: month" }, { status: 400 });
  }

  const yearNum = parseInt(year, 10);
  if (isNaN(yearNum)) {
    return NextResponse.json({ error: "year must be an integer" }, { status: 400 });
  }

  const monthNum = month ? parseInt(month, 10) : 0;
  if (mode === "month" && isNaN(monthNum)) {
    return NextResponse.json({ error: "month must be an integer" }, { status: 400 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authorized = session.user.isGlobalViewer || await isAuthorizedForPlant(session, plantCode);
    if (!authorized) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this plant's scorecard" },
        { status: 403 }
      );
    }

    const plantResult = await query<PlantRow>(
      `SELECT plant_id::text FROM plant WHERE code = $1 AND active = true`,
      [plantCode]
    );
    if (plantResult.rowCount === 0) {
      return NextResponse.json({ error: "Plant not found" }, { status: 404 });
    }
    const plantId = plantResult.rows[0].plant_id;

    if (mode === "year") {
      const [cellsRes, processTotalsRes, areaTotalsRes, overallRes, processesRes, areasRes] =
        await Promise.all([
          query<CellRow>(
            `SELECT
               a.code  AS area_code,
               p.code  AS process_code,
               c.metrics_count,
               c.total_score,
               c.compliance_ratio,
               c.color
             FROM v_scorecard_cell_yearly c
             JOIN area    a ON a.area_id    = c.area_id
             JOIN process p ON p.process_id = c.process_id
             WHERE c.plant_id = $1
               AND c.year     = $2`,
            [plantId, yearNum]
          ),
          query<ProcessTotalRow>(
            `SELECT
               p.code AS process_code,
               t.metrics_count,
               t.total_score,
               t.compliance_ratio,
               t.color
             FROM v_scorecard_process_total_yearly t
             JOIN process p ON p.process_id = t.process_id
             WHERE t.plant_id = $1
               AND t.year     = $2`,
            [plantId, yearNum]
          ),
          query<AreaTotalRow>(
            `SELECT
               a.code AS area_code,
               t.metrics_count,
               t.total_score,
               t.compliance_ratio,
               t.color
             FROM v_scorecard_area_total_yearly t
             JOIN area a ON a.area_id = t.area_id
             WHERE t.plant_id = $1
               AND t.year     = $2`,
            [plantId, yearNum]
          ),
          query<OverallRow>(
            `SELECT metrics_count, total_score, compliance_ratio, color
             FROM v_scorecard_overall_yearly
             WHERE plant_id = $1
               AND year     = $2`,
            [plantId, yearNum]
          ),
          query<DimensionRow>(`SELECT code, name, sort_order FROM process WHERE active = true ORDER BY sort_order`, []),
          query<DimensionRow>(`SELECT code, name, sort_order FROM area WHERE active = true ORDER BY sort_order`, []),
        ]);

      return NextResponse.json({
        cells: cellsRes.rows.map((r) => ({
          areaCode: r.area_code,
          processCode: r.process_code,
          metricsCount: Number(r.metrics_count),
          totalScore: Number(r.total_score),
          ratio: Number(r.compliance_ratio),
          color: r.color as DbCell["color"],
        })),
        processTotals: processTotalsRes.rows.map((r) => ({
          processCode: r.process_code,
          metricsCount: Number(r.metrics_count),
          totalScore: Number(r.total_score),
          ratio: Number(r.compliance_ratio),
          color: r.color as DbProcessTotal["color"],
        })),
        areaTotals: areaTotalsRes.rows.map((r) => ({
          areaCode: r.area_code,
          metricsCount: Number(r.metrics_count),
          totalScore: Number(r.total_score),
          ratio: Number(r.compliance_ratio),
          color: r.color as DbAreaTotal["color"],
        })),
        overall: (overallRes.rowCount ?? 0) > 0
          ? {
            metricsCount: Number(overallRes.rows[0].metrics_count),
            totalScore: Number(overallRes.rows[0].total_score),
            ratio: Number(overallRes.rows[0].compliance_ratio),
            color: overallRes.rows[0].color as DbOverall["color"],
          }
          : null,
        processes: processesRes.rows.map((r) => ({ code: r.code, label: r.name, sortOrder: Number(r.sort_order) })),
        areas: areasRes.rows.map((r) => ({ code: r.code, label: r.name, sortOrder: Number(r.sort_order) })),
      });
    }

    const periodResult = await query<PeriodRow>(
      `SELECT period_id::text
       FROM period
       WHERE EXTRACT(YEAR  FROM period_date)::int = $1
         AND EXTRACT(MONTH FROM period_date)::int = $2`,
      [yearNum, monthNum]
    );
    if (periodResult.rowCount === 0) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }
    const periodId = periodResult.rows[0].period_id;

    const [cellsRes, processTotalsRes, areaTotalsRes, overallRes, processesRes, areasRes] =
      await Promise.all([
        query<CellRow>(
          `SELECT
             a.code  AS area_code,
             p.code  AS process_code,
             c.metrics_count,
             c.total_score,
             c.compliance_ratio,
             c.color
           FROM v_scorecard_cell c
           JOIN area    a ON a.area_id    = c.area_id
           JOIN process p ON p.process_id = c.process_id
           WHERE c.plant_id  = $1
             AND c.period_id = $2`,
          [plantId, periodId]
        ),
        query<ProcessTotalRow>(
          `SELECT
             p.code AS process_code,
             t.metrics_count,
             t.total_score,
             t.compliance_ratio,
             t.color
           FROM v_scorecard_process_total t
           JOIN process p ON p.process_id = t.process_id
           WHERE t.plant_id  = $1
             AND t.period_id = $2`,
          [plantId, periodId]
        ),
        query<AreaTotalRow>(
          `SELECT
             a.code AS area_code,
             t.metrics_count,
             t.total_score,
             t.compliance_ratio,
             t.color
           FROM v_scorecard_area_total t
           JOIN area a ON a.area_id = t.area_id
           WHERE t.plant_id  = $1
             AND t.period_id = $2`,
          [plantId, periodId]
        ),
        query<OverallRow>(
          `SELECT metrics_count, total_score, compliance_ratio, color
           FROM v_scorecard_overall
           WHERE plant_id  = $1
             AND period_id = $2`,
          [plantId, periodId]
        ),
        query<DimensionRow>(`SELECT code, name, sort_order FROM process WHERE active = true ORDER BY sort_order`, []),
        query<DimensionRow>(`SELECT code, name, sort_order FROM area WHERE active = true ORDER BY sort_order`, []),
      ]);

    const cells: DbCell[] = cellsRes.rows.map((r) => ({
      areaCode: r.area_code,
      processCode: r.process_code,
      metricsCount: Number(r.metrics_count),
      totalScore: Number(r.total_score),
      ratio: Number(r.compliance_ratio),
      color: r.color as DbCell["color"],
    }));

    const processTotals: DbProcessTotal[] = processTotalsRes.rows.map((r) => ({
      processCode: r.process_code,
      metricsCount: Number(r.metrics_count),
      totalScore: Number(r.total_score),
      ratio: Number(r.compliance_ratio),
      color: r.color as DbProcessTotal["color"],
    }));

    const areaTotals: DbAreaTotal[] = areaTotalsRes.rows.map((r) => ({
      areaCode: r.area_code,
      metricsCount: Number(r.metrics_count),
      totalScore: Number(r.total_score),
      ratio: Number(r.compliance_ratio),
      color: r.color as DbAreaTotal["color"],
    }));

    const overall: DbOverall | null = (overallRes.rowCount ?? 0) > 0
      ? {
        metricsCount: Number(overallRes.rows[0].metrics_count),
        totalScore: Number(overallRes.rows[0].total_score),
        ratio: Number(overallRes.rows[0].compliance_ratio),
        color: overallRes.rows[0].color as DbOverall["color"],
      }
      : null;

    const processes: DbDimension[] = processesRes.rows.map((r) => ({
      code: r.code,
      label: r.name,
      sortOrder: Number(r.sort_order),
    }));

    const areas: DbDimension[] = areasRes.rows.map((r) => ({
      code: r.code,
      label: r.name,
      sortOrder: Number(r.sort_order),
    }));

    return NextResponse.json({ cells, processTotals, areaTotals, overall, processes, areas });
  } catch (err) {
    console.error("[/api/scorecard] DB error:", err);
    return NextResponse.json({ error: "Database query failed" }, { status: 500 });
  }
}

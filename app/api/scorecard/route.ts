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


export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const plantCode = searchParams.get("plant");
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  if (!plantCode || !year || !month) {
    return NextResponse.json(
      { error: "Missing required query params: plant, year, month" },
      { status: 400 }
    );
  }

  const yearNum = parseInt(year, 10);
  const monthNum = parseInt(month, 10);
  if (isNaN(yearNum) || isNaN(monthNum)) {
    return NextResponse.json(
      { error: "year and month must be integers" },
      { status: 400 }
    );
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authorized = await isAuthorizedForPlant(session, plantCode);
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

        query<DimensionRow>(
          `SELECT code, name, sort_order
           FROM process
           WHERE active = true
           ORDER BY sort_order`,
          []
        ),

        query<DimensionRow>(
          `SELECT code, name, sort_order
           FROM area
           WHERE active = true
           ORDER BY sort_order`,
          []
        ),
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

    return NextResponse.json({
      cells,
      processTotals,
      areaTotals,
      overall,
      processes,
      areas,
    });
  } catch (err) {
    console.error("[/api/scorecard] DB error:", err);
    return NextResponse.json(
      { error: "Database query failed" },
      { status: 500 }
    );
  }
}

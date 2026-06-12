import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAuthorizedForPlant } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

interface HistoryRow {
  label: string;
  result_value: string | null;
  yellow_limit: string | null;
  green_limit: string | null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const plantCode = searchParams.get("plant");
  const metricId = searchParams.get("metric_id");
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  if (!plantCode || !metricId || !yearParam || !monthParam) {
    return NextResponse.json(
      { error: "Missing required params: plant, metric_id, year, month" },
      { status: 400 }
    );
  }

  const year = parseInt(yearParam, 10);
  const month = parseInt(monthParam, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json(
      { error: "Invalid year or month" },
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
        { error: "Forbidden: You do not have access to this plant's scorecard data" },
        { status: 403 }
      );
    }

    const plantRes = await query<{ plant_id: string }>(
      `SELECT plant_id::text FROM plant WHERE code = $1 AND active = true`,
      [plantCode]
    );
    if ((plantRes.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Plant not found" }, { status: 404 });
    }
    const plantId = plantRes.rows[0].plant_id;

    const res = await query<HistoryRow>(
      `SELECT
         to_char(period_date, 'Mon YY') AS label,
         result_value::text,
         yellow_limit::text,
         green_limit::text
       FROM v_metric_history
       WHERE plant_id = $1
         AND metric_id = $2
         AND period_date <= make_date($3::int, $4::int, 1)
         AND period_date > make_date($3::int, $4::int, 1) - INTERVAL '12 months'
       ORDER BY period_date`,
      [plantId, metricId, year, month]
    );

    const points = res.rows.map((r) => ({
      label: r.label,
      result_value: r.result_value !== null ? Number(r.result_value) : null,
      yellow_limit: r.yellow_limit !== null ? Number(r.yellow_limit) : null,
      green_limit: r.green_limit !== null ? Number(r.green_limit) : null,
    }));

    return NextResponse.json({ points });
  } catch (err) {
    console.error("[/api/metric-history] DB error:", err);
    return NextResponse.json(
      { error: "Database query failed" },
      { status: 500 }
    );
  }
}

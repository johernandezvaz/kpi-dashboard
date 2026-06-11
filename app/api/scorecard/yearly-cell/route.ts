import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAuthorizedForPlant } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

interface YearlyMetricRow {
  metric_id: string;
  name: string;
  unit: string | null;
  higher_is_better: boolean;
  aggregated_value: string | null;
  yellow_limit: string | null;
  green_limit: string | null;
  color: string;
}

interface MonthlyRow {
  metric_id: string;
  month_num: number;
  result_value: string | null;
  yellow_limit: string | null;
  green_limit: string | null;
  higher_is_better: boolean;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const plantCode = searchParams.get("plant");
  const year = searchParams.get("year");
  const area = searchParams.get("area");
  const process = searchParams.get("process");

  if (!plantCode || !year || !area || !process) {
    return NextResponse.json({ error: "Missing params: plant, year, area, process" }, { status: 400 });
  }

  const yearNum = parseInt(year, 10);
  if (isNaN(yearNum)) {
    return NextResponse.json({ error: "year must be an integer" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authorized = session.user.isGlobalViewer || await isAuthorizedForPlant(session, plantCode);
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const plantRes = await query<{ plant_id: string }>(
      `SELECT plant_id::text FROM plant WHERE code = $1 AND active = true`,
      [plantCode]
    );
    if ((plantRes.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Plant not found" }, { status: 404 });
    }
    const plantId = plantRes.rows[0].plant_id;

    const areaDecoded = decodeURIComponent(area);

    const [yearlyRes, monthlyRes] = await Promise.all([
      query<YearlyMetricRow>(
        `SELECT
           vy.metric_id::text,
           vy.name,
           vy.unit,
           vy.higher_is_better,
           vy.aggregated_value::text,
           vy.yellow_limit::text,
           vy.green_limit::text,
           vy.color
         FROM v_metric_yearly vy
         JOIN area    ar ON ar.area_id    = vy.area_id
         JOIN process pr ON pr.process_id = vy.process_id
         WHERE vy.plant_id = $1
           AND vy.year     = $2
           AND ar.code     = $3
           AND pr.code     = $4
         ORDER BY vy.name`,
        [plantId, yearNum, areaDecoded, process]
      ),
      query<MonthlyRow>(
        `SELECT
           mr.metric_id::text,
           EXTRACT(MONTH FROM p.period_date)::int AS month_num,
           mr.result_value::text,
           mt.yellow_limit::text,
           mt.green_limit::text,
           m.higher_is_better
         FROM metric_result mr
         JOIN metric        m  ON m.metric_id  = mr.metric_id
         JOIN area          ar ON ar.area_id   = m.area_id
         JOIN process       pr ON pr.process_id = m.process_id
         JOIN period        p  ON p.period_id  = mr.period_id
         LEFT JOIN metric_target mt
                ON mt.plant_id  = mr.plant_id
               AND mt.metric_id = mr.metric_id
               AND mt.period_id = mr.period_id
         WHERE mr.plant_id = $1
           AND EXTRACT(YEAR FROM p.period_date)::int = $2
           AND ar.code     = $3
           AND pr.code     = $4
         ORDER BY mr.metric_id, month_num`,
        [plantId, yearNum, areaDecoded, process]
      ),
    ]);

    const monthlyMap = new Map<string, Map<number, MonthlyRow>>();
    for (const r of monthlyRes.rows) {
      if (!monthlyMap.has(r.metric_id)) monthlyMap.set(r.metric_id, new Map());
      monthlyMap.get(r.metric_id)!.set(r.month_num, r);
    }

    const metrics = yearlyRes.rows.map((r) => {
      const byMonth = monthlyMap.get(r.metric_id) ?? new Map<number, MonthlyRow>();
      const months = Array.from({ length: 12 }, (_, i) => {
        const m = byMonth.get(i + 1);
        if (!m || m.result_value === null) return { month: i + 1, value: null, yellowLimit: null, greenLimit: null, color: "neutral" };
        const val = Number(m.result_value);
        const yl = m.yellow_limit !== null ? Number(m.yellow_limit) : null;
        const gl = m.green_limit !== null ? Number(m.green_limit) : null;
        let color = "red";
        if (yl !== null && gl !== null) {
          if (m.higher_is_better) {
            color = val >= gl ? "green" : val >= yl ? "yellow" : "red";
          } else {
            color = val <= gl ? "green" : val <= yl ? "yellow" : "red";
          }
        }
        return { month: i + 1, value: val, yellowLimit: yl, greenLimit: gl, color };
      });

      return {
        metricId: r.metric_id,
        name: r.name,
        unit: r.unit,
        higherIsBetter: r.higher_is_better,
        yearly: {
          yellowLimit: r.yellow_limit !== null ? Number(r.yellow_limit) : null,
          greenLimit: r.green_limit !== null ? Number(r.green_limit) : null,
          aggregatedValue: r.aggregated_value !== null ? Number(r.aggregated_value) : null,
          color: r.color,
        },
        months,
      };
    });

    return NextResponse.json({ metrics });
  } catch (err) {
    console.error("[/api/scorecard/yearly-cell] error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

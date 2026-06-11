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
  year_num: number;
  month_num: number;
  result_value: string | null;
  yellow_limit: string | null;
  green_limit: string | null;
  higher_is_better: boolean;
}

function enumerateMonths(sy: number, sm: number, ey: number, em: number): { year: number; month: number }[] {
  const result: { year: number; month: number }[] = [];
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    result.push({ year: y, month: m });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return result;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const plantCode  = searchParams.get("plant");
  const startYear  = searchParams.get("startYear");
  const startMonth = searchParams.get("startMonth");
  const endYear    = searchParams.get("endYear");
  const endMonth   = searchParams.get("endMonth");
  const area       = searchParams.get("area");
  const proc       = searchParams.get("process");

  if (!plantCode || !startYear || !startMonth || !endYear || !endMonth || !area || !proc) {
    return NextResponse.json({ error: "Missing params: plant, startYear, startMonth, endYear, endMonth, area, process" }, { status: 400 });
  }

  const sy = parseInt(startYear, 10);
  const sm = parseInt(startMonth, 10);
  const ey = parseInt(endYear, 10);
  const em = parseInt(endMonth, 10);

  if ([sy, sm, ey, em].some(isNaN)) {
    return NextResponse.json({ error: "Year/month params must be integers" }, { status: 400 });
  }
  if (ey < sy || (ey === sy && em < sm)) {
    return NextResponse.json({ error: "End period must be on or after Start period" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authorized = session.user.isGlobalViewer || await isAuthorizedForPlant(session, plantCode);
  if (!authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const plantRes = await query<{ plant_id: string }>(
      `SELECT plant_id::text FROM plant WHERE code = $1 AND active = true`,
      [plantCode]
    );
    if ((plantRes.rowCount ?? 0) === 0) return NextResponse.json({ error: "Plant not found" }, { status: 404 });
    const plantId = plantRes.rows[0].plant_id;

    const areaDecoded = decodeURIComponent(area);

    const rangeParams = [plantId, sy, sm, ey, em];

    const [aggregatedRes, monthlyRes] = await Promise.all([
      query<YearlyMetricRow>(
        `SELECT
           mr.metric_id::text,
           m.name,
           m.unit,
           m.higher_is_better,
           AVG(mr.result_value)::text   AS aggregated_value,
           MAX(mt.yellow_limit)::text   AS yellow_limit,
           MAX(mt.green_limit)::text    AS green_limit,
           CASE
             WHEN m.higher_is_better THEN
               CASE WHEN AVG(mr.result_value) >= MAX(mt.green_limit)  THEN 'green'
                    WHEN AVG(mr.result_value) >= MAX(mt.yellow_limit) THEN 'yellow'
                    ELSE 'red' END
             ELSE
               CASE WHEN AVG(mr.result_value) <= MAX(mt.green_limit)  THEN 'green'
                    WHEN AVG(mr.result_value) <= MAX(mt.yellow_limit) THEN 'yellow'
                    ELSE 'red' END
           END AS color
         FROM metric_result mr
         JOIN metric        m  ON m.metric_id  = mr.metric_id
         JOIN area          ar ON ar.area_id   = m.area_id
         JOIN process       pr ON pr.process_id = m.process_id
         JOIN period        p  ON p.period_id  = mr.period_id
         JOIN metric_target mt ON mt.plant_id  = mr.plant_id
                               AND mt.metric_id = mr.metric_id
                               AND mt.period_id = mr.period_id
         WHERE mr.plant_id     = $1
           AND mr.result_value IS NOT NULL
           AND ar.code         = $6
           AND pr.code         = $7
           AND p.period_date >= make_date($2::int, $3::int, 1)
           AND p.period_date <= make_date($4::int, $5::int, 1)
         GROUP BY mr.metric_id, m.name, m.unit, m.higher_is_better
         ORDER BY m.name`,
        [...rangeParams, areaDecoded, proc]
      ),
      query<MonthlyRow>(
        `SELECT
           mr.metric_id::text,
           EXTRACT(YEAR  FROM p.period_date)::int AS year_num,
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
         LEFT JOIN metric_target mt ON mt.plant_id  = mr.plant_id
                                    AND mt.metric_id = mr.metric_id
                                    AND mt.period_id = mr.period_id
         WHERE mr.plant_id  = $1
           AND ar.code      = $6
           AND pr.code      = $7
           AND p.period_date >= make_date($2::int, $3::int, 1)
           AND p.period_date <= make_date($4::int, $5::int, 1)
         ORDER BY mr.metric_id, year_num, month_num`,
        [...rangeParams, areaDecoded, proc]
      ),
    ]);

    const monthSlots = enumerateMonths(sy, sm, ey, em);

    const monthlyMap = new Map<string, Map<string, MonthlyRow>>();
    for (const r of monthlyRes.rows) {
      if (!monthlyMap.has(r.metric_id)) monthlyMap.set(r.metric_id, new Map());
      monthlyMap.get(r.metric_id)!.set(`${r.year_num}-${r.month_num}`, r);
    }

    const metrics = aggregatedRes.rows.map((r) => {
      const bySlot = monthlyMap.get(r.metric_id) ?? new Map<string, MonthlyRow>();
      const months = monthSlots.map(({ year, month }) => {
        const key = `${year}-${month}`;
        const mr = bySlot.get(key);
        if (!mr || mr.result_value === null) return { year, month, value: null, yellowLimit: null, greenLimit: null, color: "neutral" };
        const val = Number(mr.result_value);
        const yl = mr.yellow_limit !== null ? Number(mr.yellow_limit) : null;
        const gl = mr.green_limit !== null ? Number(mr.green_limit) : null;
        let color = "red";
        if (yl !== null && gl !== null) {
          if (mr.higher_is_better) {
            color = val >= gl ? "green" : val >= yl ? "yellow" : "red";
          } else {
            color = val <= gl ? "green" : val <= yl ? "yellow" : "red";
          }
        }
        return { year, month, value: val, yellowLimit: yl, greenLimit: gl, color };
      });

      return {
        metricId: r.metric_id,
        name: r.name,
        unit: r.unit,
        higherIsBetter: r.higher_is_better,
        range: {
          yellowLimit: r.yellow_limit !== null ? Number(r.yellow_limit) : null,
          greenLimit: r.green_limit !== null ? Number(r.green_limit) : null,
          aggregatedValue: r.aggregated_value !== null ? Number(r.aggregated_value) : null,
          color: r.color,
        },
        months,
      };
    });

    return NextResponse.json({ metrics, monthSlots });
  } catch (err) {
    console.error("[/api/scorecard/range-cell] error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

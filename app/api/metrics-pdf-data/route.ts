import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAuthorizedForPlant } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";


const METRIC_IDS = [1030, 1095, 2041, 2050, 4030];

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function shortMonthLabel(year: number, month: number): string {
  const shortNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const yy = String(year).slice(-2);
  return `${shortNames[month - 1]} ${yy}`;
}


type MetricColor = "red" | "yellow" | "green" | "neutral";

interface MetricInfoRow {
  metric_id: string;
  name: string;
  unit: string | null;
  higher_is_better: boolean;
}

interface CurrentMonthRow {
  result_value: string | null;
  yellow_limit: string | null;
  green_limit: string | null;
}

interface HistoryRow {
  year: number;
  month: number;
  result_value: string | null;
  yellow_limit: string | null;
  green_limit: string | null;
}

interface PlantRow {
  plant_id: string;
  name: string;
}


function computeColor(
  resultValue: number | null,
  yellowLimit: number | null,
  greenLimit: number | null,
  higherIsBetter: boolean
): MetricColor {
  if (resultValue === null || yellowLimit === null || greenLimit === null) {
    return "neutral";
  }
  if (higherIsBetter) {
    if (resultValue >= greenLimit) return "green";
    if (resultValue >= yellowLimit) return "yellow";
    return "red";
  } else {
    if (resultValue <= greenLimit) return "green";
    if (resultValue <= yellowLimit) return "yellow";
    return "red";
  }
}


export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const plantCode = searchParams.get("plant");
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  if (!plantCode || !yearParam || !monthParam) {
    return NextResponse.json(
      { error: "Missing required params: plant, year, month" },
      { status: 400 }
    );
  }

  const year = parseInt(yearParam, 10);
  const month = parseInt(monthParam, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json(
      { error: "Invalid year or month. month must be an integer between 1 and 12." },
      { status: 400 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.user.isAdmin) {
    return NextResponse.json(
      { error: "Forbidden: admin access required" },
      { status: 403 }
    );
  }

  const authorized = await isAuthorizedForPlant(session, plantCode);
  if (!authorized) {
    return NextResponse.json(
      { error: "Forbidden: you do not have access to this plant" },
      { status: 403 }
    );
  }

  try {
    const plantRes = await query<PlantRow>(
      `SELECT plant_id::text, name FROM plant WHERE code = $1 AND active = true`,
      [plantCode]
    );
    if ((plantRes.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Plant not found" }, { status: 404 });
    }
    const plantId = plantRes.rows[0].plant_id;
    const plantName = plantRes.rows[0].name;

    const metricResults = await Promise.all(
      METRIC_IDS.map(async (metricId) => {
        const infoRes = await query<MetricInfoRow>(
          `SELECT metric_id::text, name, unit, higher_is_better
           FROM metric
           WHERE metric_id = $1`,
          [metricId]
        );

        if ((infoRes.rowCount ?? 0) === 0) {
          return {
            metricId: String(metricId),
            name: `Metric ${metricId}`,
            unit: null,
            higherIsBetter: true,
            currentMonth: {
              resultValue: null,
              yellowLimit: null,
              greenLimit: null,
              color: "neutral" as MetricColor,
            },
            history: buildEmptyHistory(year, month),
          };
        }

        const info = infoRes.rows[0];
        const higherIsBetter = info.higher_is_better;

        const curRes = await query<CurrentMonthRow>(
          `SELECT
             mr.result_value::text,
             mt.yellow_limit::text,
             mt.green_limit::text
           FROM metric_result mr
           JOIN period p  ON p.period_id  = mr.period_id
           LEFT JOIN metric_target mt
             ON mt.plant_id  = mr.plant_id
            AND mt.metric_id = mr.metric_id
            AND mt.period_id = mr.period_id
           WHERE mr.plant_id  = $1
             AND mr.metric_id = $2
             AND EXTRACT(YEAR  FROM p.period_date)::int = $3
             AND EXTRACT(MONTH FROM p.period_date)::int = $4`,
          [plantId, metricId, year, month]
        );

        const curRow = curRes.rows[0] ?? null;
        const resultValue =
          curRow?.result_value != null ? Number(curRow.result_value) : null;
        const yellowLimit =
          curRow?.yellow_limit != null ? Number(curRow.yellow_limit) : null;
        const greenLimit =
          curRow?.green_limit != null ? Number(curRow.green_limit) : null;

        const color = computeColor(resultValue, yellowLimit, greenLimit, higherIsBetter);

        const histRes = await query<HistoryRow>(
          `SELECT
             EXTRACT(YEAR  FROM p.period_date)::int AS year,
             EXTRACT(MONTH FROM p.period_date)::int AS month,
             mr.result_value::text                  AS result_value,
             mt.yellow_limit::text                  AS yellow_limit,
             mt.green_limit::text                   AS green_limit
           FROM metric_result mr
           JOIN period p  ON p.period_id  = mr.period_id
           LEFT JOIN metric_target mt
             ON mt.plant_id  = mr.plant_id
            AND mt.metric_id = mr.metric_id
            AND mt.period_id = mr.period_id
           WHERE mr.plant_id  = $1
             AND mr.metric_id = $2
             AND p.period_date <= make_date($3::int, $4::int, 1)
             AND p.period_date >  make_date($3::int, $4::int, 1) - INTERVAL '12 months'
           ORDER BY p.period_date`,
          [plantId, metricId, year, month]
        );

        const histMap = new Map<string, HistoryRow>();
        for (const row of histRes.rows) {
          histMap.set(`${row.year}-${String(row.month).padStart(2, "0")}`, row);
        }

        const history = buildHistory(year, month, histMap);

        return {
          metricId: info.metric_id,
          name: info.name,
          unit: info.unit,
          higherIsBetter,
          currentMonth: { resultValue, yellowLimit, greenLimit, color },
          history,
        };
      })
    );

    return NextResponse.json({
      plant: { code: plantCode, name: plantName },
      year,
      month,
      monthLabel: MONTH_LABELS[month - 1],
      metrics: metricResults,
    });
  } catch (err) {
    console.error("[/api/metrics-pdf-data] DB error:", err);
    return NextResponse.json({ error: "Database query failed" }, { status: 500 });
  }
}

function buildHistory(
  year: number,
  month: number,
  dataMap: Map<string, HistoryRow>
) {
  const points = [];
  for (let i = 11; i >= 0; i--) {
    let m = month - i;
    let y = year;
    if (m <= 0) {
      m += 12;
      y -= 1;
    }
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const row = dataMap.get(key);
    points.push({
      year: y,
      month: m,
      label: shortMonthLabel(y, m),
      resultValue: row?.result_value != null ? Number(row.result_value) : null,
      yellowLimit: row?.yellow_limit != null ? Number(row.yellow_limit) : null,
      greenLimit: row?.green_limit != null ? Number(row.green_limit) : null,
    });
  }
  return points;
}

function buildEmptyHistory(year: number, month: number) {
  return buildHistory(year, month, new Map());
}

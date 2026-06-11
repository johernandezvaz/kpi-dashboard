import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, pool } from "@/lib/db";

function getPlantAdminId(session: any): number | null {

  if (!session?.user?.isAdmin) return null;
  const pid = session.user.adminPlantId;
  if (pid === null || pid === undefined) return null;
  return Number(pid);
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.isGlobalViewer) {
      return NextResponse.json({ error: "Global viewers cannot access this endpoint" }, { status: 403 });
    }

    const plantId = getPlantAdminId(session);
    if (plantId === null) {
      if (session.user.isAdmin && session.user.adminPlantId === null) {
        return NextResponse.json(
          { error: "Targets are defined by plant administrators. Superadmins do not have access to this screen." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const yearStr = searchParams.get("year");
    const monthStr = searchParams.get("month");

    const year = yearStr ? parseInt(yearStr, 10) : null;
    const month = monthStr ? parseInt(monthStr, 10) : null;

    if (!year || !month || isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Valid year and month are required" }, { status: 400 });
    }

    const res = await query<{
      metric_id: number;
      name: string;
      unit: string | null;
      higher_is_better: boolean;
      process_code: string;
      area_code: string;
      yellow_limit: string | null;
      green_limit: string | null;
      period_id: number | null;
    }>(
      `SELECT
         m.metric_id,
         m.name,
         m.unit,
         m.higher_is_better,
         pr.code AS process_code,
         a.code  AS area_code,
         mt.yellow_limit::text AS yellow_limit,
         mt.green_limit::text  AS green_limit,
         mt.period_id
       FROM metric m
       JOIN process pr ON pr.process_id = m.process_id
       JOIN area a     ON a.area_id = m.area_id
       LEFT JOIN period p ON p.year = $2 AND p.month = $3
       LEFT JOIN metric_target mt
              ON mt.plant_id  = m.plant_id
             AND mt.metric_id = m.metric_id
             AND mt.period_id = p.period_id
       WHERE m.plant_id = $1
         AND m.active   = true
       ORDER BY pr.sort_order, a.sort_order, m.metric_id`,
      [plantId, year, month]
    );

    return NextResponse.json({ targets: res.rows });
  } catch (error: any) {
    console.error("Error in GET /api/admin/targets:", error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.isGlobalViewer) {
      return NextResponse.json({ error: "Global viewers cannot access this endpoint" }, { status: 403 });
    }

    const plantId = getPlantAdminId(session);
    if (plantId === null) {
      if (session.user.isAdmin && session.user.adminPlantId === null) {
        return NextResponse.json(
          { error: "Targets are defined by plant administrators. Superadmins do not have access to this screen." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { year, month, metricId, yellowLimit, greenLimit } = body;

    if (typeof year !== "number" || typeof month !== "number" || month < 1 || month > 12) {
      return NextResponse.json({ error: "Valid year and month are required" }, { status: 400 });
    }
    if (typeof metricId !== "number") {
      return NextResponse.json({ error: "Valid metricId is required" }, { status: 400 });
    }

    const yellow = parseFloat(yellowLimit);
    const green = parseFloat(greenLimit);
    if (isNaN(yellow) || isNaN(green)) {
      return NextResponse.json({ error: "yellowLimit and greenLimit must be numeric" }, { status: 400 });
    }

    const metricRes = await query<{ higher_is_better: boolean }>(
      `SELECT higher_is_better FROM metric WHERE metric_id = $1 AND plant_id = $2 AND active = true`,
      [metricId, plantId]
    );
    if (metricRes.rows.length === 0) {
      return NextResponse.json({ error: "Metric not found for this plant" }, { status: 404 });
    }

    const { higher_is_better } = metricRes.rows[0];

    if (higher_is_better) {
      if (green < yellow) {
        return NextResponse.json(
          { error: "For metrics where higher is better, green limit must be ≥ yellow limit" },
          { status: 400 }
        );
      }
    } else {
      if (green > yellow) {
        return NextResponse.json(
          { error: "For metrics where lower is better, green limit must be ≤ yellow limit" },
          { status: 400 }
        );
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [String(session.user.id)]);

      await client.query(
        `INSERT INTO period (year, month) VALUES ($1, $2) ON CONFLICT (year, month) DO NOTHING`,
        [year, month]
      );

      const periodRes = await client.query<{ period_id: number }>(
        `SELECT period_id FROM period WHERE year = $1 AND month = $2`,
        [year, month]
      );
      const periodId = periodRes.rows[0].period_id;

      await client.query(
        `INSERT INTO metric_target (plant_id, metric_id, period_id, yellow_limit, green_limit, updated_at, updated_by)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)
         ON CONFLICT (plant_id, metric_id, period_id)
         DO UPDATE SET
           yellow_limit = EXCLUDED.yellow_limit,
           green_limit  = EXCLUDED.green_limit,
           updated_at   = NOW(),
           updated_by   = EXCLUDED.updated_by`,
        [plantId, metricId, periodId, yellow, green, Number(session.user.id)]
      );

      await client.query("COMMIT");
      return NextResponse.json({ success: true });
    } catch (txError) {
      await client.query("ROLLBACK");
      throw txError;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error in POST /api/admin/targets:", error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}

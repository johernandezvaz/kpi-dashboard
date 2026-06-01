import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const pid = session.user.adminPlantId;
    if (pid === null || pid === undefined) {
      return NextResponse.json(
        { error: "Targets are defined by plant administrators. Superadmins do not have access to this screen." },
        { status: 403 }
      );
    }
    const plantId = Number(pid);

    const body = await req.json();
    const { year, month } = body;

    if (typeof year !== "number" || typeof month !== "number" || month < 1 || month > 12) {
      return NextResponse.json({ error: "Valid year and month are required" }, { status: 400 });
    }

    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [String(session.user.id)]);

      await client.query(
        `INSERT INTO period (year, month) VALUES ($1, $2) ON CONFLICT (year, month) DO NOTHING`,
        [year, month]
      );

      const [targetPeriodRes, sourcePeriodRes] = await Promise.all([
        client.query<{ period_id: number }>(
          `SELECT period_id FROM period WHERE year = $1 AND month = $2`,
          [year, month]
        ),
        client.query<{ period_id: number }>(
          `SELECT period_id FROM period WHERE year = $1 AND month = $2`,
          [prevYear, prevMonth]
        ),
      ]);

      if (sourcePeriodRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: `No data found for ${prevYear}-${String(prevMonth).padStart(2, "0")}. Nothing to copy.` },
          { status: 404 }
        );
      }

      const targetPeriodId = targetPeriodRes.rows[0].period_id;
      const sourcePeriodId = sourcePeriodRes.rows[0].period_id;

      const copyRes = await client.query(
        `INSERT INTO metric_target (plant_id, metric_id, period_id, yellow_limit, green_limit, updated_at, updated_by)
         SELECT plant_id, metric_id, $1, yellow_limit, green_limit, NOW(), $2
         FROM metric_target
         WHERE plant_id = $3 AND period_id = $4
           AND metric_id NOT IN (
             SELECT metric_id FROM metric_target
             WHERE plant_id = $3 AND period_id = $1
           )`,
        [targetPeriodId, Number(session.user.id), plantId, sourcePeriodId]
      );

      await client.query("COMMIT");

      const copied = copyRes.rowCount ?? 0;
      return NextResponse.json({
        success: true,
        copied,
        message:
          copied === 0
            ? "All targets for the selected period already exist. Nothing was copied."
            : `Copied ${copied} target(s) from ${prevYear}-${String(prevMonth).padStart(2, "0")}.`,
      });
    } catch (txError) {
      await client.query("ROLLBACK");
      throw txError;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error in POST /api/admin/targets/copy-from-previous:", error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}

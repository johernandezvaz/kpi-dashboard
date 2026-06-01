import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, pool } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!session.user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      metricId,
      plantId,
      processId,
      areaId,
      name,
      unit,
      higherIsBetter,
      active,
      ownerUserId,
      pnlItem,
    } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "Name is required and cannot be empty" }, { status: 400 });
    }
    if (typeof plantId !== "number") {
      return NextResponse.json({ error: "Invalid plant ID" }, { status: 400 });
    }
    if (typeof processId !== "number") {
      return NextResponse.json({ error: "Invalid process ID" }, { status: 400 });
    }
    if (typeof areaId !== "number") {
      return NextResponse.json({ error: "Invalid area ID" }, { status: 400 });
    }

    const callerPlantId = session.user.adminPlantId ?? null;
    if (callerPlantId !== null && plantId !== callerPlantId) {
      return NextResponse.json({ error: "Forbidden: Plant admins can only manage metrics for their own plant" }, { status: 403 });
    }

    const [plantCheck, processCheck, areaCheck] = await Promise.all([
      query("SELECT 1 FROM plant WHERE plant_id = $1", [plantId]),
      query("SELECT 1 FROM process WHERE process_id = $1", [processId]),
      query("SELECT 1 FROM area WHERE area_id = $1", [areaId]),
    ]);

    if (plantCheck.rows.length === 0) {
      return NextResponse.json({ error: "Plant not found" }, { status: 400 });
    }
    if (processCheck.rows.length === 0) {
      return NextResponse.json({ error: "Process not found" }, { status: 400 });
    }
    if (areaCheck.rows.length === 0) {
      return NextResponse.json({ error: "Area not found" }, { status: 400 });
    }

    if (metricId === undefined || metricId === null || typeof metricId !== "number" || isNaN(metricId) || !Number.isInteger(metricId) || metricId < 1000 || metricId > 99999) {
      return NextResponse.json({ error: "Metric ID is required and must be an integer between 1000 and 99999" }, { status: 400 });
    }

    const metricCheck = await query("SELECT 1 FROM metric WHERE metric_id = $1", [metricId]);
    if (metricCheck.rows.length > 0) {
      return NextResponse.json({ error: "Metric ID already exists" }, { status: 409 });
    }

    if (ownerUserId !== undefined && ownerUserId !== null) {
      const ownerCheck = await query(
        `SELECT 1 FROM app_user u
         WHERE u.user_id = $1 AND u.active = true AND (
           (u.is_admin = true AND u.admin_plant_id IS NULL)
           OR (u.is_admin = true AND u.admin_plant_id = $2)
           OR EXISTS (
             SELECT 1 FROM user_plant_area_access upaa
             WHERE upaa.user_id = u.user_id AND upaa.plant_id = $2
           )
         )`,
        [ownerUserId, plantId]
      );
      if (ownerCheck.rows.length === 0) {
        return NextResponse.json({ error: "Selected owner user does not have access to this plant or is inactive" }, { status: 400 });
      }
    }

    const activeVal = typeof active === "boolean" ? active : true;
    const higherIsBetterVal = typeof higherIsBetter === "boolean" ? higherIsBetter : false;
    const unitVal = unit && typeof unit === "string" ? unit.trim() : null;
    const pnlItemVal = pnlItem && typeof pnlItem === "string" ? pnlItem.trim() : null;
    const ownerVal = ownerUserId !== undefined && ownerUserId !== null ? ownerUserId : null;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [String(session.user.id)]);

      await client.query(
        `INSERT INTO metric (
          metric_id, plant_id, process_id, area_id, name, unit,
          higher_is_better, active, owner_user_id, pnl_item
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          metricId,
          plantId,
          processId,
          areaId,
          name.trim(),
          unitVal,
          higherIsBetterVal,
          activeVal,
          ownerVal,
          pnlItemVal,
        ]
      );

      await client.query("COMMIT");

      return NextResponse.json(
        {
          success: true,
          metricId: metricId,
        },
        { status: 201 }
      );
    } catch (txError) {
      await client.query("ROLLBACK");
      throw txError;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error in POST /api/admin/metrics:", error);
    return NextResponse.json({ error: error.message || "An unexpected error occurred during metric creation" }, { status: 500 });
  }
}

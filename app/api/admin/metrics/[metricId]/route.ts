import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, pool } from "@/lib/db";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ metricId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!session.user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { metricId: rawMetricId } = await params;
    const metricId = parseInt(rawMetricId, 10);
    if (isNaN(metricId)) {
      return NextResponse.json({ error: "Invalid metric ID" }, { status: 400 });
    }

    const metricRes = await query("SELECT * FROM metric WHERE metric_id = $1", [metricId]);
    if (metricRes.rows.length === 0) {
      return NextResponse.json({ error: "Metric not found" }, { status: 404 });
    }
    const currentMetric = metricRes.rows[0];

    const body = await req.json();

    const plantId = currentMetric.plant_id;
    const processId = typeof body.processId === "number" ? body.processId : currentMetric.process_id;
    const areaId = typeof body.areaId === "number" ? body.areaId : currentMetric.area_id;
    const name = typeof body.name === "string" ? body.name : currentMetric.name;
    const unit = body.unit !== undefined ? body.unit : currentMetric.unit;
    const higherIsBetter = typeof body.higherIsBetter === "boolean" ? body.higherIsBetter : currentMetric.higher_is_better;
    const active = typeof body.active === "boolean" ? body.active : currentMetric.active;
    const ownerUserId = body.ownerUserId !== undefined ? body.ownerUserId : currentMetric.owner_user_id;
    const pnlItem = body.pnlItem !== undefined ? body.pnlItem : currentMetric.pnl_item;

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }

    const callerPlantId = session.user.adminPlantId ?? null;
    if (callerPlantId !== null) {
      if (currentMetric.plant_id !== callerPlantId) {
        return NextResponse.json({ error: "Forbidden: Plant admins can only manage metrics for their own plant" }, { status: 403 });
      }
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

    if (ownerUserId !== null && ownerUserId !== undefined) {
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

    const unitVal = unit && typeof unit === "string" ? unit.trim() : null;
    const pnlItemVal = pnlItem && typeof pnlItem === "string" ? pnlItem.trim() : null;
    const ownerVal = ownerUserId !== null && ownerUserId !== undefined ? ownerUserId : null;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [String(session.user.id)]);

      await client.query(
        `UPDATE metric
         SET process_id = $1,
             area_id = $2,
             name = $3,
             unit = $4,
             higher_is_better = $5,
             active = $6,
             owner_user_id = $7,
             pnl_item = $8
         WHERE metric_id = $9`,
        [
          processId,
          areaId,
          name.trim(),
          unitVal,
          higherIsBetter,
          active,
          ownerVal,
          pnlItemVal,
          metricId,
        ]
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
    console.error(`Error in PUT /api/admin/metrics/[metricId]:`, error);
    return NextResponse.json({ error: error.message || "An unexpected error occurred during metric update" }, { status: 500 });
  }
}

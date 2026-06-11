import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, pool } from "@/lib/db";

const FORBIDDEN_SUPERADMIN = "Validity is configured by plant administrators.";
const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"] as const;

function defaultRow(metricId: number, plantId: number, year: number) {
  return { metricId, plantId, year, jan:false, feb:false, mar:false, apr:false, may:false, jun:false, jul:false, aug:false, sep:false, oct:false, nov:false, dec:false };
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.isGlobalViewer) {
      return NextResponse.json({ error: "Global viewers cannot access this endpoint" }, { status: 403 });
    }

    if (!session.user.isAdmin || session.user.adminPlantId === null) {
      return NextResponse.json({ error: FORBIDDEN_SUPERADMIN }, { status: 403 });
    }

    const adminPlantId = session.user.adminPlantId;
    const { searchParams } = new URL(req.url);
    const metricId = parseInt(searchParams.get("metricId") ?? "", 10);
    const year = parseInt(searchParams.get("year") ?? "", 10);

    if (isNaN(metricId) || isNaN(year)) {
      return NextResponse.json({ error: "metricId and year are required" }, { status: 400 });
    }

    const ownership = await query(
      `SELECT 1 FROM metric WHERE metric_id = $1 AND plant_id = $2`,
      [metricId, adminPlantId]
    );
    if (ownership.rows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const res = await query<{
      jan: boolean; feb: boolean; mar: boolean; apr: boolean;
      may: boolean; jun: boolean; jul: boolean; aug: boolean;
      sep: boolean; oct: boolean; nov: boolean; dec: boolean;
    }>(
      `SELECT jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,dec
       FROM metric_validity
       WHERE metric_id = $1 AND plant_id = $2 AND year = $3`,
      [metricId, adminPlantId, year]
    );

    if (res.rows.length === 0) {
      return NextResponse.json(defaultRow(metricId, adminPlantId, year));
    }

    const row = res.rows[0];
    return NextResponse.json({ metricId, plantId: adminPlantId, year, ...row });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.isGlobalViewer) {
      return NextResponse.json({ error: "Global viewers cannot access this endpoint" }, { status: 403 });
    }

    if (!session.user.isAdmin || session.user.adminPlantId === null) {
      return NextResponse.json({ error: FORBIDDEN_SUPERADMIN }, { status: 403 });
    }

    const adminPlantId = session.user.adminPlantId;
    const userId = Number(session.user.id);
    const body = await req.json();
    const { metricId, year } = body;

    if (typeof metricId !== "number" || typeof year !== "number") {
      return NextResponse.json({ error: "metricId and year are required numbers" }, { status: 400 });
    }
    if (year < 2020 || year > 2027) {
      return NextResponse.json({ error: "year must be between 2020 and 2027" }, { status: 400 });
    }

    for (const m of MONTHS) {
      if (typeof body[m] !== "boolean") {
        return NextResponse.json({ error: `Month '${m}' must be a boolean` }, { status: 400 });
      }
    }

    const ownership = await query(
      `SELECT 1 FROM metric WHERE metric_id = $1 AND plant_id = $2`,
      [metricId, adminPlantId]
    );
    if (ownership.rows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [String(userId)]);
      await client.query(
        `INSERT INTO metric_validity
           (metric_id, plant_id, year, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (metric_id, plant_id, year) DO UPDATE SET
           jan=$4, feb=$5, mar=$6, apr=$7, may=$8, jun=$9,
           jul=$10, aug=$11, sep=$12, oct=$13, nov=$14, dec=$15`,
        [
          metricId, adminPlantId, year,
          body.jan, body.feb, body.mar, body.apr, body.may, body.jun,
          body.jul, body.aug, body.sep, body.oct, body.nov, body.dec,
        ]
      );
      await client.query("COMMIT");
      return NextResponse.json({ success: true });
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}

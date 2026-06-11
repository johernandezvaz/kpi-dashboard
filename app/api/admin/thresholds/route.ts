import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.isGlobalViewer) {
      return NextResponse.json({ error: "Global viewers cannot access this endpoint" }, { status: 403 });
    }
    if (!session.user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const res = await query<{
      threshold_id: number;
      yellow_min: string;
      green_min: string;
      effective_from: string;
      notes: string | null;
      created_by: number | null;
      created_at: string;
    }>(
      `SELECT threshold_id, yellow_min, green_min, effective_from, notes, created_by, created_at
       FROM scorecard_threshold
       WHERE effective_from <= CURRENT_DATE
       ORDER BY effective_from DESC
       LIMIT 1`
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "No threshold configured" }, { status: 404 });
    }

    const row = res.rows[0];
    return NextResponse.json({
      threshold_id: row.threshold_id,
      yellow_min: Number(row.yellow_min),
      green_min: Number(row.green_min),
      effective_from: row.effective_from,
      notes: row.notes,
      created_by: row.created_by,
      created_at: row.created_at,
    });
  } catch (err: any) {
    console.error("[GET /api/admin/thresholds] error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
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
    if (!session.user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { yellowMin, greenMin, notes } = body;

    if (typeof yellowMin !== "number" || !isFinite(yellowMin) || yellowMin < 0 || yellowMin > 1) {
      return NextResponse.json({ error: "yellowMin must be a number between 0 and 1" }, { status: 400 });
    }
    if (typeof greenMin !== "number" || !isFinite(greenMin) || greenMin < 0 || greenMin > 1) {
      return NextResponse.json({ error: "greenMin must be a number between 0 and 1" }, { status: 400 });
    }
    if (yellowMin >= greenMin) {
      return NextResponse.json({ error: "yellowMin must be strictly less than greenMin" }, { status: 400 });
    }
    if (notes !== undefined && notes !== null) {
      if (typeof notes !== "string" || notes.length > 500) {
        return NextResponse.json({ error: "notes must be a string of at most 500 characters" }, { status: 400 });
      }
    }

    const userId = Number(session.user.id);
    const notesVal = notes ?? null;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [String(userId)]);

      const existing = await client.query<{ threshold_id: number }>(
        `SELECT threshold_id FROM scorecard_threshold WHERE effective_from = CURRENT_DATE`
      );

      let row: any;
      if (existing.rows.length > 0) {
        const updated = await client.query(
          `UPDATE scorecard_threshold
           SET yellow_min = $1, green_min = $2, notes = $3, created_by = $4
           WHERE effective_from = CURRENT_DATE
           RETURNING threshold_id, yellow_min, green_min, effective_from, notes, created_by, created_at`,
          [yellowMin, greenMin, notesVal, userId]
        );
        row = updated.rows[0];
      } else {
        const inserted = await client.query(
          `INSERT INTO scorecard_threshold (yellow_min, green_min, effective_from, notes, created_by)
           VALUES ($1, $2, CURRENT_DATE, $3, $4)
           RETURNING threshold_id, yellow_min, green_min, effective_from, notes, created_by, created_at`,
          [yellowMin, greenMin, notesVal, userId]
        );
        row = inserted.rows[0];
      }

      await client.query("COMMIT");

      return NextResponse.json({
        threshold_id: row.threshold_id,
        yellow_min: Number(row.yellow_min),
        green_min: Number(row.green_min),
        effective_from: row.effective_from,
        notes: row.notes,
        created_by: row.created_by,
        created_at: row.created_at,
      });
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("[POST /api/admin/thresholds] error:", err);
    return NextResponse.json({ error: err.message || "Database error" }, { status: 500 });
  }
}

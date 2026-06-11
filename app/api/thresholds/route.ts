import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    console.error("[/api/thresholds] error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

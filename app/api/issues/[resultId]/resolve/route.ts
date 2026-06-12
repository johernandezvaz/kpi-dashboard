import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ resultId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { isAdmin, isGlobal, isGlobalViewer, adminPlantId } = session.user;

  if (isGlobalViewer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isSuperadmin = (isAdmin || isGlobal) && adminPlantId === null;
  if (isSuperadmin) {
    return NextResponse.json(
      { error: "Superadmins cannot mark issues resolved." },
      { status: 403 }
    );
  }

  const { resultId: resultIdStr } = await params;
  const resultId = parseInt(resultIdStr, 10);
  if (isNaN(resultId)) {
    return NextResponse.json({ error: "Invalid resultId" }, { status: 400 });
  }

  let body: { resolutionNote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const resolutionNote = (body.resolutionNote ?? "").trim();
  if (!resolutionNote) {
    return NextResponse.json({ error: "resolutionNote must not be empty" }, { status: 400 });
  }
  if (resolutionNote.length > 1000) {
    return NextResponse.json({ error: "resolutionNote exceeds 1000 characters" }, { status: 400 });
  }

  const userId = Number(session.user.id);

  try {
    const rowRes = await query<{
      is_resolved: boolean;
      created_by: number | null;
      updated_by: number | null;
    }>(
      `SELECT is_resolved, created_by, updated_by
       FROM metric_result
       WHERE result_id = $1`,
      [resultId]
    );

    if ((rowRes.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    const row = rowRes.rows[0];

    if (row.is_resolved) {
      return NextResponse.json(
        { error: "Issue already resolved. Resolution cannot be undone." },
        { status: 400 }
      );
    }

    if (row.created_by !== userId && row.updated_by !== userId) {
      return NextResponse.json(
        { error: "Only the user who captured the issue can mark it resolved." },
        { status: 403 }
      );
    }

    await query(`SELECT set_config('app.user_id', $1::text, true)`, [userId]);

    const updRes = await query<Record<string, unknown>>(
      `UPDATE metric_result
       SET is_resolved     = TRUE,
           resolution_note = $1,
           resolved_at     = NOW(),
           resolved_by     = $2
       WHERE result_id = $3
       RETURNING result_id, is_resolved, resolution_note, resolved_at, resolved_by`,
      [resolutionNote, userId, resultId]
    );

    return NextResponse.json(updRes.rows[0]);
  } catch (err) {
    console.error("[PUT /api/issues/[resultId]/resolve] DB error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

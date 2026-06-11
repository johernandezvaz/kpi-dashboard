import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(req: Request) {
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

    const callerPlantId = session.user.adminPlantId ?? null;
    if (callerPlantId !== null) {
      return NextResponse.json({ error: "Forbidden: Only superadmins can view logs" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const logType = searchParams.get("logType") || "audit";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get("pageSize") || "50", 10)));
    const userId = searchParams.get("userId");
    const tableName = searchParams.get("tableName");
    const action = searchParams.get("action");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const success = searchParams.get("success");

    const offset = (page - 1) * pageSize;

    if (logType === "login") {

      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (userId) {
        conditions.push(`le.user_id = $${idx++}`);
        params.push(parseInt(userId, 10));
      }
      if (success !== null && success !== "") {
        conditions.push(`le.success = $${idx++}`);
        params.push(success === "true");
      }
      if (from) {
        conditions.push(`le.created_at >= $${idx++}::timestamptz`);
        params.push(from);
      }
      if (to) {
        conditions.push(`le.created_at < ($${idx++}::date + INTERVAL '1 day')`);
        params.push(to);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const countRes = await query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM login_event le ${whereClause}`,
        params
      );
      const totalCount = parseInt(countRes.rows[0].count, 10);

      const dataRes = await query(
        `SELECT le.event_id, le.user_id, le.email, le.success, le.ip_address, le.user_agent, le.created_at,
                u.full_name AS user_name
         FROM login_event le
         LEFT JOIN app_user u ON u.user_id = le.user_id
         ${whereClause}
         ORDER BY le.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, pageSize, offset]
      );

      return NextResponse.json({
        logType: "login",
        data: dataRes.rows,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
        },
      });
    } else {

      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (userId) {
        conditions.push(`al.changed_by = $${idx++}`);
        params.push(parseInt(userId, 10));
      }
      if (tableName) {
        conditions.push(`al.table_name = $${idx++}`);
        params.push(tableName);
      }
      if (action) {
        conditions.push(`al.action = $${idx++}`);
        params.push(action);
      }
      if (from) {
        conditions.push(`al.changed_at >= $${idx++}::timestamptz`);
        params.push(from);
      }
      if (to) {
        conditions.push(`al.changed_at < ($${idx++}::date + INTERVAL '1 day')`);
        params.push(to);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const countRes = await query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM audit_log al ${whereClause}`,
        params
      );
      const totalCount = parseInt(countRes.rows[0].count, 10);

      const dataRes = await query(
        `SELECT al.audit_id, al.table_name, al.record_id, al.action, al.old_data, al.new_data,
                al.changed_by, al.changed_at,
                u.email AS user_email, u.full_name AS user_name
         FROM audit_log al
         LEFT JOIN app_user u ON u.user_id = al.changed_by
         ${whereClause}
         ORDER BY al.changed_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, pageSize, offset]
      );

      return NextResponse.json({
        logType: "audit",
        data: dataRes.rows,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
        },
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("Error in GET /api/admin/logs:", error);
    return NextResponse.json({ error: message }, { status: 500 });
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
    if (!session.user.isAdmin || (session.user.adminPlantId ?? null) !== null) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    if (body.action !== "stats") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }


    const [auditToday, loginToday, failedToday, totalUsers, distinctTables] = await Promise.all([
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM audit_log WHERE changed_at >= CURRENT_DATE`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM login_event WHERE created_at >= CURRENT_DATE AND success = true`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM login_event WHERE created_at >= CURRENT_DATE AND success = false`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM app_user WHERE active = true`
      ),
      query<{ table_name: string }>(
        `SELECT DISTINCT table_name FROM audit_log ORDER BY table_name`
      ),
    ]);


    const usersRes = await query<{ user_id: number; email: string; full_name: string }>(
      `SELECT user_id, email, full_name FROM app_user ORDER BY full_name`
    );

    return NextResponse.json({
      stats: {
        auditEventsToday: parseInt(auditToday.rows[0].count, 10),
        loginsToday: parseInt(loginToday.rows[0].count, 10),
        failedLoginsToday: parseInt(failedToday.rows[0].count, 10),
        activeUsers: parseInt(totalUsers.rows[0].count, 10),
      },
      tables: distinctTables.rows.map((r) => r.table_name),
      users: usersRes.rows,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("Error in POST /api/admin/logs:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

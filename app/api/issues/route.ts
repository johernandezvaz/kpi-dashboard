import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const COLOR_EXPR = `
  CASE
    WHEN m.higher_is_better THEN
      CASE WHEN mr.result_value >= mt.green_limit  THEN 'green'
           WHEN mr.result_value >= mt.yellow_limit THEN 'yellow'
           ELSE 'red'
      END
    ELSE
      CASE WHEN mr.result_value <= mt.green_limit  THEN 'green'
           WHEN mr.result_value <= mt.yellow_limit THEN 'yellow'
           ELSE 'red'
      END
  END
`;

function buildIssueSelect(extraWhere: string[], params: unknown[]): { sql: string; params: unknown[] } {
  const whereClause = extraWhere.length > 0 ? `AND ${extraWhere.join(" AND ")}` : "";
  const sql = `
    WITH computed AS (
      SELECT
        mr.result_id,
        mr.metric_id,
        m.name           AS metric_name,
        m.unit,
        pl.plant_id,
        pl.code          AS plant_code,
        a.area_id,
        a.code           AS area_code,
        pr.process_id,
        pr.code          AS process_code,
        p.period_id,
        EXTRACT(YEAR  FROM p.period_date)::int AS year,
        EXTRACT(MONTH FROM p.period_date)::int AS month,
        mr.result_value,
        mt.yellow_limit,
        mt.green_limit,
        m.higher_is_better,
        ${COLOR_EXPR}    AS color,
        mr.comment,
        mr.corrective_action,
        mr.target_date,
        mr.owner_user_id,
        ou.full_name     AS owner_name,
        mr.owner_text,
        mr.created_by,
        cu.full_name     AS created_by_name,
        mr.created_at,
        mr.updated_by,
        uu.full_name     AS updated_by_name,
        mr.updated_at,
        mr.is_resolved,
        mr.resolution_note,
        mr.resolved_at,
        mr.resolved_by,
        rv.full_name     AS resolved_by_name
      FROM metric_result mr
      JOIN metric         m   ON m.metric_id   = mr.metric_id
      JOIN area           a   ON a.area_id      = m.area_id
      JOIN process        pr  ON pr.process_id  = m.process_id
      JOIN plant          pl  ON pl.plant_id    = mr.plant_id
      JOIN period         p   ON p.period_id    = mr.period_id
      JOIN metric_target  mt  ON mt.metric_id   = mr.metric_id
                              AND mt.plant_id    = mr.plant_id
                              AND mt.period_id   = mr.period_id
      LEFT JOIN app_user  ou  ON ou.user_id     = mr.owner_user_id
      LEFT JOIN app_user  cu  ON cu.user_id     = mr.created_by
      LEFT JOIN app_user  uu  ON uu.user_id     = mr.updated_by
      LEFT JOIN app_user  rv  ON rv.user_id     = mr.resolved_by
      WHERE mr.result_value IS NOT NULL
        AND mr.comment          IS NOT NULL AND mr.comment          <> ''
        AND mr.corrective_action IS NOT NULL AND mr.corrective_action <> ''
        AND mr.target_date      IS NOT NULL
        AND (mr.owner_user_id IS NOT NULL OR (mr.owner_text IS NOT NULL AND mr.owner_text <> ''))
    )
    SELECT * FROM computed
    WHERE color = 'red'
    ${whereClause}
    ORDER BY target_date ASC NULLS LAST, year DESC, month DESC
  `;
  return { sql, params };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.isGlobalViewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = request.nextUrl;
  const status   = searchParams.get("status")   ?? "open";
  const plantIdQ = searchParams.get("plantId");
  const areaIdQ  = searchParams.get("areaId");
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10)));

  if (!["open", "resolved", "all"].includes(status)) {
    return NextResponse.json({ error: "status must be open, resolved, or all" }, { status: 400 });
  }

  const { isAdmin, isGlobal, adminPlantId, id: sessionUserId } = session.user;
  const userId = Number(sessionUserId);
  const isOperational = !isAdmin && !isGlobal && !session.user.isGlobalViewer;
  const isSuperadmin  = isAdmin && adminPlantId === null;

  try {
    const extraWhere: string[] = [];
    const params: unknown[] = [];
    let pIdx = 1;

    if (status === "open")     { extraWhere.push(`is_resolved = FALSE`); }
    if (status === "resolved") { extraWhere.push(`is_resolved = TRUE`);  }

    if (isOperational) {
      params.push(userId);
      const pUser = pIdx++;
      params.push(userId);
      const pUser2 = pIdx++;
      extraWhere.push(
        `(created_by = $${pUser} OR updated_by = $${pUser2} OR area_id IN (
           SELECT area_id FROM user_plant_area_access WHERE user_id = $${pUser}
         ))`
      );
    } else if (isAdmin && !isSuperadmin) {
      params.push(adminPlantId);
      extraWhere.push(`plant_id = $${pIdx++}`);
      if (areaIdQ) {
        params.push(Number(areaIdQ));
        extraWhere.push(`area_id = $${pIdx++}`);
      }
    } else {
      if (plantIdQ) {
        params.push(Number(plantIdQ));
        extraWhere.push(`plant_id = $${pIdx++}`);
      }
      if (areaIdQ) {
        params.push(Number(areaIdQ));
        extraWhere.push(`area_id = $${pIdx++}`);
      }
    }

    const { sql, params: builtParams } = buildIssueSelect(extraWhere, params);

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const countRes = await query<{ total: string }>(countSql, builtParams);
    const total = parseInt(countRes.rows[0]?.total ?? "0", 10);

    const offset = (page - 1) * pageSize;
    const pageSql = `${sql} LIMIT $${pIdx} OFFSET $${pIdx + 1}`;
    const pageParams = [...builtParams, pageSize, offset];

    const issuesRes = await query<Record<string, unknown>>(pageSql, pageParams);

    const issues = issuesRes.rows.map((r) => {
      const canMarkResolved =
        isOperational &&
        !r.is_resolved &&
        (r.created_by === userId || r.updated_by === userId);
      return {
        resultId:       r.result_id,
        metricId:       r.metric_id,
        metricName:     r.metric_name,
        unit:           r.unit,
        plantId:        r.plant_id,
        plantCode:      r.plant_code,
        areaId:         r.area_id,
        areaCode:       r.area_code,
        processId:      r.process_id,
        processCode:    r.process_code,
        periodId:       r.period_id,
        year:           r.year,
        month:          r.month,
        resultValue:    r.result_value !== null ? Number(r.result_value) : null,
        yellowLimit:    r.yellow_limit !== null ? Number(r.yellow_limit) : null,
        greenLimit:     r.green_limit  !== null ? Number(r.green_limit)  : null,
        higherIsBetter: r.higher_is_better,
        color:          r.color,
        comment:           r.comment,
        correctiveAction:  r.corrective_action,
        targetDate:        r.target_date,
        ownerUserId:       r.owner_user_id,
        ownerName:         r.owner_name,
        ownerText:         r.owner_text,
        createdBy:         r.created_by,
        createdByName:     r.created_by_name,
        createdAt:         r.created_at,
        updatedBy:         r.updated_by,
        updatedByName:     r.updated_by_name,
        updatedAt:         r.updated_at,
        isResolved:        r.is_resolved,
        resolutionNote:    r.resolution_note,
        resolvedAt:        r.resolved_at,
        resolvedBy:        r.resolved_by,
        resolvedByName:    r.resolved_by_name,
        canMarkResolved,
      };
    });

    return NextResponse.json({
      issues,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    console.error("[/api/issues] DB error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, pool } from "@/lib/db";

type ColorLabel = "green" | "yellow" | "red";

function computeColor(
  resultValue: number,
  yellowLimit: number,
  greenLimit: number,
  higherIsBetter: boolean
): ColorLabel {
  if (higherIsBetter) {
    if (resultValue >= greenLimit) return "green";
    if (resultValue >= yellowLimit) return "yellow";
    return "red";
  } else {
    if (resultValue <= greenLimit) return "green";
    if (resultValue <= yellowLimit) return "yellow";
    return "red";
  }
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
    const userId = Number(session.user.id);

    const { searchParams } = new URL(req.url);
    const plantId = parseInt(searchParams.get("plantId") ?? "", 10);
    const areaId = parseInt(searchParams.get("areaId") ?? "", 10);
    const year = parseInt(searchParams.get("year") ?? "", 10);
    const month = parseInt(searchParams.get("month") ?? "", 10);

    if (isNaN(plantId) || isNaN(areaId) || isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "plantId, areaId, year, and month are required" }, { status: 400 });
    }

    const accessCheck = await query(
      `SELECT 1 FROM user_plant_area_access
       WHERE user_id = $1 AND plant_id = $2 AND area_id = $3`,
      [userId, plantId, areaId]
    );
    if (accessCheck.rows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const periodRes = await query<{ period_id: number }>(
      `SELECT period_id FROM period WHERE year = $1 AND month = $2`,
      [year, month]
    );

    if (periodRes.rows.length === 0) {
      return NextResponse.json({ metrics: [], periodMissing: true });
    }

    const periodId = periodRes.rows[0].period_id;

    const metricsRes = await query<{
      metric_id: number;
      name: string;
      unit: string | null;
      higher_is_better: boolean;
      yellow_limit: string;
      green_limit: string;
      result_value: string | null;
      comment: string | null;
      corrective_action: string | null;
      target_date: string | null;
      owner_user_id: number | null;
      owner_text: string | null;
      owner_full_name: string | null;
    }>(
      `SELECT
         m.metric_id,
         m.name,
         m.unit,
         m.higher_is_better,
         mt.yellow_limit::text AS yellow_limit,
         mt.green_limit::text  AS green_limit,
         mr.result_value::text AS result_value,
         mr.comment,
         mr.corrective_action,
         mr.target_date::text  AS target_date,
         mr.owner_user_id,
         mr.owner_text,
         ou.full_name          AS owner_full_name
       FROM metric m
       JOIN metric_target mt
         ON mt.plant_id  = m.plant_id
        AND mt.metric_id = m.metric_id
        AND mt.period_id = $3
       LEFT JOIN metric_result mr
         ON mr.plant_id  = m.plant_id
        AND mr.metric_id = m.metric_id
        AND mr.period_id = $3
       LEFT JOIN app_user ou ON ou.user_id = mr.owner_user_id
       LEFT JOIN metric_validity mv
         ON mv.metric_id = m.metric_id
        AND mv.plant_id  = m.plant_id
        AND mv.year      = $4
       WHERE m.plant_id = $1
         AND m.area_id  = $2
         AND m.active   = true
         AND CASE $5::int
               WHEN 1  THEN mv.jan WHEN 2  THEN mv.feb WHEN 3  THEN mv.mar
               WHEN 4  THEN mv.apr WHEN 5  THEN mv.may WHEN 6  THEN mv.jun
               WHEN 7  THEN mv.jul WHEN 8  THEN mv.aug WHEN 9  THEN mv.sep
               WHEN 10 THEN mv.oct WHEN 11 THEN mv.nov WHEN 12 THEN mv.dec
             END = TRUE
       ORDER BY m.metric_id`,
      [plantId, areaId, periodId, year, month]
    );

    const eligibleUsersRes = await query<{ user_id: number; full_name: string }>(
      `SELECT DISTINCT u.user_id, u.full_name
       FROM app_user u
       WHERE u.active = true AND (
         (u.is_admin = true AND u.admin_plant_id IS NULL)
         OR (u.is_admin = true AND u.admin_plant_id = $1)
         OR EXISTS (
           SELECT 1 FROM user_plant_area_access upaa
           WHERE upaa.user_id = u.user_id AND upaa.plant_id = $1
         )
       )
       ORDER BY u.full_name`,
      [plantId]
    );

    return NextResponse.json({
      metrics: metricsRes.rows,
      periodMissing: false,
      eligibleUsers: eligibleUsersRes.rows,
    });
  } catch (error: any) {
    console.error("Error in GET /api/capture:", error);
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
    const userId = Number(session.user.id);

    const body = await req.json();
    const { plantId, areaId, year, month, rows } = body;

    if (typeof plantId !== "number" || typeof areaId !== "number") {
      return NextResponse.json({ error: "plantId and areaId are required" }, { status: 400 });
    }
    if (typeof year !== "number" || typeof month !== "number" || month < 1 || month > 12) {
      return NextResponse.json({ error: "Valid year and month are required" }, { status: 400 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "rows must be a non-empty array" }, { status: 400 });
    }

    const accessCheck = await query(
      `SELECT 1 FROM user_plant_area_access WHERE user_id = $1 AND plant_id = $2 AND area_id = $3`,
      [userId, plantId, areaId]
    );
    if (accessCheck.rows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const metricIds: number[] = rows.map((r: any) => Number(r.metricId));

    const validityRes = await query<{ metric_id: number }>(
      `SELECT m.metric_id
       FROM metric m
       LEFT JOIN metric_validity mv
         ON mv.metric_id = m.metric_id
        AND mv.plant_id  = m.plant_id
        AND mv.year      = $3
       WHERE m.metric_id = ANY($1)
         AND m.plant_id  = $2
         AND m.active    = true
         AND CASE $4::int
               WHEN 1  THEN mv.jan WHEN 2  THEN mv.feb WHEN 3  THEN mv.mar
               WHEN 4  THEN mv.apr WHEN 5  THEN mv.may WHEN 6  THEN mv.jun
               WHEN 7  THEN mv.jul WHEN 8  THEN mv.aug WHEN 9  THEN mv.sep
               WHEN 10 THEN mv.oct WHEN 11 THEN mv.nov WHEN 12 THEN mv.dec
             END = TRUE`,
      [metricIds, plantId, year, month]
    );

    const validMetricIdSet = new Set(validityRes.rows.map((r) => r.metric_id));
    const invalidByValidity = metricIds.filter((id) => !validMetricIdSet.has(id));
    if (invalidByValidity.length > 0) {
      return NextResponse.json(
        { error: "One or more metrics are not available for capture in this period. Refresh the page and try again." },
        { status: 400 }
      );
    }

    const validMetricsRes = await query<{
      metric_id: number;
      yellow_limit: string;
      green_limit: string;
      higher_is_better: boolean;
    }>(
      `SELECT m.metric_id, mt.yellow_limit::text, mt.green_limit::text, m.higher_is_better
       FROM metric m
       JOIN period p ON p.year = $3 AND p.month = $4
       JOIN metric_target mt
         ON mt.plant_id  = m.plant_id
        AND mt.metric_id = m.metric_id
        AND mt.period_id = p.period_id
       WHERE m.metric_id = ANY($1)
         AND m.plant_id  = $2
         AND m.area_id   = $5
         AND m.active    = true`,
      [metricIds, plantId, year, month, areaId]
    );

    const validMetricMap = new Map(
      validMetricsRes.rows.map((r) => [r.metric_id, r])
    );

    const invalidMetricIds = metricIds.filter((id) => !validMetricMap.has(id));
    if (invalidMetricIds.length > 0) {
      return NextResponse.json(
        { error: `Metric IDs ${invalidMetricIds.join(", ")} are not valid or have no targets for this period` },
        { status: 400 }
      );
    }

    const rowErrors: { metricId: number; error: string }[] = [];
    for (const row of rows) {
      const metricId = Number(row.metricId);
      const meta = validMetricMap.get(metricId)!;

      if (row.resultValue === null || row.resultValue === undefined || row.resultValue === "") {
        continue;
      }

      const result = parseFloat(row.resultValue);
      if (isNaN(result)) {
        rowErrors.push({ metricId, error: "result_value must be numeric" });
        continue;
      }

      const color = computeColor(
        result,
        parseFloat(meta.yellow_limit),
        parseFloat(meta.green_limit),
        meta.higher_is_better
      );

      if (color === "red") {
        if (!row.comment || String(row.comment).trim() === "") {
          rowErrors.push({ metricId, error: "Comment is required when result is red" });
        }
        if (!row.correctiveAction || String(row.correctiveAction).trim() === "") {
          rowErrors.push({ metricId, error: "Corrective action is required when result is red" });
        }
        if (!row.targetDate || String(row.targetDate).trim() === "") {
          rowErrors.push({ metricId, error: "Target date is required when result is red" });
        }
        const hasOwnerUser = row.ownerUserId !== null && row.ownerUserId !== undefined && row.ownerUserId !== "";
        const hasOwnerText = row.ownerText !== null && row.ownerText !== undefined && String(row.ownerText).trim() !== "";
        if (!hasOwnerUser && !hasOwnerText) {
          rowErrors.push({ metricId, error: "Corrective action requires an owner" });
        }
        if (hasOwnerUser && hasOwnerText) {
          rowErrors.push({ metricId, error: "Provide either a registered user OR a free-text name, not both" });
        }
      }
    }

    if (rowErrors.length > 0) {
      return NextResponse.json({ error: "Validation failed", rowErrors }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [String(userId)]);

      await client.query(
        `INSERT INTO period (year, month) VALUES ($1, $2) ON CONFLICT (year, month) DO NOTHING`,
        [year, month]
      );
      const periodRes = await client.query<{ period_id: number }>(
        `SELECT period_id FROM period WHERE year = $1 AND month = $2`,
        [year, month]
      );
      const periodId = periodRes.rows[0].period_id;

      const savedRows: { metricId: number; color: string | null }[] = [];

      for (const row of rows) {
        const metricId = Number(row.metricId);
        const meta = validMetricMap.get(metricId)!;

        const resultVal = (row.resultValue !== null && row.resultValue !== undefined && row.resultValue !== "")
          ? parseFloat(row.resultValue)
          : null;

        if (resultVal === null) {
          const existingRes = await client.query(
            `SELECT result_id FROM metric_result WHERE plant_id=$1 AND metric_id=$2 AND period_id=$3`,
            [plantId, metricId, periodId]
          );
          if (existingRes.rows.length === 0) {
            savedRows.push({ metricId, color: null });
            continue;
          }
        }

        const color = resultVal !== null
          ? computeColor(resultVal, parseFloat(meta.yellow_limit), parseFloat(meta.green_limit), meta.higher_is_better)
          : null;

        const commentVal = row.comment ? String(row.comment).trim() : null;
        const correctiveActionVal = row.correctiveAction ? String(row.correctiveAction).trim() : null;
        const targetDateVal = row.targetDate ? String(row.targetDate).trim() : null;
        const ownerUserIdVal = (row.ownerUserId !== null && row.ownerUserId !== undefined && row.ownerUserId !== "")
          ? Number(row.ownerUserId)
          : null;
        const ownerTextVal = (row.ownerText !== null && row.ownerText !== undefined && String(row.ownerText).trim() !== "")
          ? String(row.ownerText).trim()
          : null;

        await client.query(
          `INSERT INTO metric_result
             (plant_id, metric_id, period_id, result_value, comment, corrective_action,
              target_date, owner_user_id, owner_text, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
           ON CONFLICT (plant_id, metric_id, period_id) DO UPDATE SET
             result_value       = EXCLUDED.result_value,
             comment            = EXCLUDED.comment,
             corrective_action  = EXCLUDED.corrective_action,
             target_date        = EXCLUDED.target_date,
             owner_user_id      = EXCLUDED.owner_user_id,
             owner_text         = EXCLUDED.owner_text,
             updated_at         = NOW(),
             updated_by         = EXCLUDED.updated_by`,
          [plantId, metricId, periodId, resultVal, commentVal, correctiveActionVal,
            targetDateVal, ownerUserIdVal, ownerTextVal, userId]
        );

        savedRows.push({ metricId, color });
      }

      await client.query("COMMIT");
      return NextResponse.json({ success: true, saved: savedRows });
    } catch (txError) {
      await client.query("ROLLBACK");
      throw txError;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error in POST /api/capture:", error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthorizedPlants } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [authorizedPlants, periodsResult] = await Promise.all([
      getAuthorizedPlants(session),
      query<{ year: number; month: number }>(
        `SELECT DISTINCT
           EXTRACT(YEAR  FROM period_date)::int AS year,
           EXTRACT(MONTH FROM period_date)::int AS month
         FROM period
         ORDER BY year, month`
      ),
    ]);

    const plants = authorizedPlants.map((r) => ({
      id: r.code,
      code: r.code,
      label: r.name,
    }));

    const periods = periodsResult.rows.map((r) => ({
      year: Number(r.year),
      month: Number(r.month),
    }));

    return NextResponse.json({ plants, periods });
  } catch (err) {
    console.error("[/api/scorecard/selectors] DB error:", err);
    return NextResponse.json(
      { error: "Failed to load selectors" },
      { status: 500 }
    );
  }
}

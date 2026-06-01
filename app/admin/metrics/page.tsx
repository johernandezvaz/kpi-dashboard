import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import AdminMetricsClient from "@/components/AdminMetricsClient";

interface DbMetric {
  metric_id: number;
  plant_id: number;
  process_id: number;
  area_id: number;
  name: string;
  unit: string | null;
  higher_is_better: boolean;
  active: boolean;
  owner_user_id: number | null;
  pnl_item: string | null;
  plant_code: string;
  process_code: string;
  area_code: string;
  owner_name: string | null;
}

interface DbPlant {
  plant_id: number;
  code: string;
  name: string;
}

interface DbProcess {
  process_id: number;
  code: string;
  name: string;
}

interface DbArea {
  area_id: number;
  code: string;
  name: string;
}

interface DbUser {
  user_id: number;
  full_name: string;
  email: string;
  is_admin: boolean;
  admin_plant_id: number | null;
  plant_ids: number[] | null;
}

export default async function AdminMetricsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (!session.user.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-app-bg p-6">
        <div className="bg-app-surface p-8 rounded-xl border border-app-border max-w-md text-center shadow-sm">
          <div className="text-scorecard-red text-4xl mb-4">⚠</div>
          <h1 className="text-xl font-bold text-app-text mb-2">403 Forbidden</h1>
          <p className="text-sm text-app-muted mb-6">
            You do not have the required administrative permissions to access this section.
          </p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-brand-navy hover:bg-brand-blue text-white rounded text-sm font-semibold transition-colors duration-100"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  const callerPlantId = session.user.adminPlantId ?? null;
  let metrics: DbMetric[] = [];

  if (callerPlantId === null) {
    const res = await query<DbMetric>(
      `SELECT m.metric_id, m.plant_id, m.process_id, m.area_id, m.name, m.unit,
              m.higher_is_better, m.active, m.owner_user_id, m.pnl_item,
              p.code AS plant_code, pr.code AS process_code, a.code AS area_code,
              u.full_name AS owner_name
       FROM metric m
       JOIN plant p ON p.plant_id = m.plant_id
       JOIN process pr ON pr.process_id = m.process_id
       JOIN area a ON a.area_id = m.area_id
       LEFT JOIN app_user u ON u.user_id = m.owner_user_id
       ORDER BY m.metric_id`
    );
    metrics = res.rows;
  } else {
    const res = await query<DbMetric>(
      `SELECT m.metric_id, m.plant_id, m.process_id, m.area_id, m.name, m.unit,
              m.higher_is_better, m.active, m.owner_user_id, m.pnl_item,
              p.code AS plant_code, pr.code AS process_code, a.code AS area_code,
              u.full_name AS owner_name
       FROM metric m
       JOIN plant p ON p.plant_id = m.plant_id
       JOIN process pr ON pr.process_id = m.process_id
       JOIN area a ON a.area_id = m.area_id
       LEFT JOIN app_user u ON u.user_id = m.owner_user_id
       WHERE m.plant_id = $1
       ORDER BY m.metric_id`,
      [callerPlantId]
    );
    metrics = res.rows;
  }

  // Fetch active metadata dropdown lists
  const [plantsRes, processesRes, areasRes, usersRes] = await Promise.all([
    query<DbPlant>("SELECT plant_id, code, name FROM plant WHERE active = true ORDER BY code"),
    query<DbProcess>("SELECT process_id, code, name FROM process WHERE active = true ORDER BY sort_order"),
    query<DbArea>("SELECT area_id, code, name FROM area WHERE active = true ORDER BY sort_order"),
    query<DbUser>(
      `SELECT u.user_id, u.full_name, u.email, u.is_admin, u.admin_plant_id,
              ARRAY(
                SELECT DISTINCT upaa.plant_id
                FROM user_plant_area_access upaa
                WHERE upaa.user_id = u.user_id
              ) AS plant_ids
       FROM app_user u
       WHERE u.active = true
       ORDER BY u.full_name`
    ),
  ]);

  const currentUser = {
    isAdmin: session.user.isAdmin,
    adminPlantId: session.user.adminPlantId ?? null,
  };

  return (
    <AdminMetricsClient
      initialMetrics={metrics}
      plants={plantsRes.rows}
      processes={processesRes.rows}
      areas={areasRes.rows}
      users={usersRes.rows}
      currentUser={currentUser}
    />
  );
}

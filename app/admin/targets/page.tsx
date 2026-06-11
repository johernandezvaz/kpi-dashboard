import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import AdminTargetsClient from "@/components/AdminTargetsClient";

interface DbMetric {
  metric_id: number;
  name: string;
  unit: string | null;
  higher_is_better: boolean;
  process_code: string;
  area_code: string;
}

interface DbPlant {
  plant_id: number;
  code: string;
  name: string;
}

export default async function AdminTargetsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.isGlobalViewer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-app-bg p-6">
        <div className="bg-app-surface p-8 rounded-xl border border-app-border max-w-md text-center shadow-sm">
          <div className="text-scorecard-yellow text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-app-text mb-2">Access Restricted</h1>
          <p className="text-sm text-app-muted mb-6">
            Global viewers have read-only access to the scorecard. This page is not available for your role.
          </p>
          <a href="/" className="inline-block px-4 py-2 bg-brand-navy hover:bg-brand-blue text-white rounded text-sm font-semibold transition-colors duration-100">
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (!session.user.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-app-bg p-6">
        <div className="bg-app-surface p-8 rounded-xl border border-app-border max-w-md text-center shadow-sm">
          <div className="text-scorecard-red text-4xl mb-4">⚠</div>
          <h1 className="text-xl font-bold text-app-text mb-2">403 Forbidden</h1>
          <p className="text-sm text-app-muted mb-6">
            You do not have the required permissions to access this section.
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

  if (session.user.adminPlantId === null || session.user.adminPlantId === undefined) {

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-app-bg p-6">
        <div className="bg-app-surface p-8 rounded-xl border border-app-border max-w-md text-center shadow-sm">
          <div className="text-scorecard-yellow text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-app-text mb-2">Access Restricted</h1>
          <p className="text-sm text-app-muted mb-6">
            Targets are defined by plant administrators. As a superadmin, you supervise
            the platform but do not define targets directly.
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

  const plantId = Number(session.user.adminPlantId);

  const plantRes = await query<DbPlant>(
    `SELECT plant_id, code, name FROM plant WHERE plant_id = $1`,
    [plantId]
  );
  const plant = plantRes.rows[0] ?? null;

  const metricsRes = await query<DbMetric>(
    `SELECT m.metric_id, m.name, m.unit, m.higher_is_better,
            pr.code AS process_code, a.code AS area_code
     FROM metric m
     JOIN process pr ON pr.process_id = m.process_id
     JOIN area a     ON a.area_id = m.area_id
     WHERE m.plant_id = $1 AND m.active = true
     ORDER BY pr.sort_order, a.sort_order, m.metric_id`,
    [plantId]
  );

  const now = new Date();

  return (
    <AdminTargetsClient
      plant={plant}
      initialMetrics={metricsRes.rows}
      defaultYear={now.getFullYear()}
      defaultMonth={now.getMonth() + 1}
    />
  );
}

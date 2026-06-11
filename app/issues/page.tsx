import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import IssuesClient from "@/components/IssuesClient";

interface PlantRow { plant_id: number; code: string; name: string }
interface AreaRow  { area_id: number;  code: string; name: string }

export default async function IssuesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

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

  const { isAdmin, isGlobal, adminPlantId } = session.user;
  const isOperational = !isAdmin && !isGlobal && !session.user.isGlobalViewer;
  const isSuperadmin  = isAdmin && adminPlantId === null;

  const plantsRes = await query<PlantRow>(
    `SELECT plant_id, code, name FROM plant WHERE active = true ORDER BY name`
  );
  const areasRes = await query<AreaRow>(
    `SELECT area_id, code, name FROM area WHERE active = true ORDER BY sort_order`
  );

  const plants = plantsRes.rows.map((p) => ({ id: p.plant_id, code: p.code, name: p.name }));
  const areas  = areasRes.rows.map((a)  => ({ id: a.area_id,  code: a.code, name: a.name }));

  return (
    <IssuesClient
      isAdmin={isAdmin}
      isSuperadmin={isSuperadmin}
      isOperational={isOperational}
      plants={plants}
      areas={areas}
      adminPlantId={adminPlantId ?? null}
    />
  );
}

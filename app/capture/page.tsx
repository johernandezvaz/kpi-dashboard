import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import CaptureClient from "@/components/CaptureClient";

interface AccessRow {
  plant_id: number;
  plant_code: string;
  plant_name: string
  area_id: number;
  area_code: string;
  area_name: string;
}

export default async function CapturePage() {
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

  const userId = Number(session.user.id);

  const accessRes = await query<AccessRow>(
    `SELECT upa.plant_id, p.code AS plant_code, p.name AS plant_name,
            upa.area_id,  a.code AS area_code,  a.name AS area_name
     FROM user_plant_area_access upa
     JOIN plant p ON p.plant_id = upa.plant_id
     JOIN area  a ON a.area_id  = upa.area_id
     WHERE upa.user_id = $1
       AND p.active    = true
       AND a.active    = true
     ORDER BY p.name, a.name`,
    [userId]
  );

  const now = new Date();

  return (
    <CaptureClient
      accessRows={accessRes.rows}
      userId={userId}
      defaultYear={now.getFullYear()}
      defaultMonth={now.getMonth() + 1}
    />
  );
}

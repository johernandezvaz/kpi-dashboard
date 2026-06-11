import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import AdminThresholdsClient from "@/components/AdminThresholdsClient";

interface ThresholdRow {
  threshold_id: number;
  yellow_min: string;
  green_min: string;
  effective_from: string;
  notes: string | null;
  created_by: number | null;
  created_at: string;
}

export default async function AdminThresholdsPage() {
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
            You do not have the required administrative permissions to access this section.
          </p>
          <a href="/" className="inline-block px-4 py-2 bg-brand-navy hover:bg-brand-blue text-white rounded text-sm font-semibold transition-colors duration-100">
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  const res = await query<ThresholdRow>(
    `SELECT threshold_id, yellow_min, green_min, effective_from, notes, created_by, created_at
     FROM scorecard_threshold
     WHERE effective_from <= CURRENT_DATE
     ORDER BY effective_from DESC
     LIMIT 1`
  );

  if (res.rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-app-bg p-6">
        <div className="bg-app-surface p-8 rounded-xl border border-app-border max-w-md text-center shadow-sm">
          <div className="text-scorecard-yellow text-4xl mb-4">⚙</div>
          <h1 className="text-xl font-bold text-app-text mb-2">No Thresholds Configured</h1>
          <p className="text-sm text-app-muted">
            No threshold row found in the database. Please seed the scorecard_threshold table.
          </p>
        </div>
      </div>
    );
  }

  const row = res.rows[0];
  const threshold = {
    threshold_id: row.threshold_id,
    yellow_min: Number(row.yellow_min),
    green_min: Number(row.green_min),
    effective_from: row.effective_from,
    notes: row.notes,
    created_by: row.created_by,
    created_at: row.created_at,
  };

  return <AdminThresholdsClient initialThreshold={threshold} />;
}

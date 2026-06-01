import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminLogsClient from "@/components/AdminLogsClient";

export default async function AdminLogsPage() {
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
  if (callerPlantId !== null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-app-bg p-6">
        <div className="bg-app-surface p-8 rounded-xl border border-app-border max-w-md text-center shadow-sm">
          <div className="text-scorecard-yellow text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-app-text mb-2">Access Restricted</h1>
          <p className="text-sm text-app-muted mb-6">
            Activity logs are only accessible to superadmins.
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

  return <AdminLogsClient />;
}

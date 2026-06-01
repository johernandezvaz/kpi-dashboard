import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import AdminUsersClient from "@/components/AdminUsersClient";

interface UserListItem {
  user_id: number;
  email: string;
  full_name: string;
  is_admin: boolean;
  admin_plant_id: number | null;
  active: boolean;
  must_change_password: boolean;
  area_codes: string[] | null;
  admin_plant_code: string | null;
  plant_id: number | null;
  area_ids: number[] | null;
}

interface DbPlant {
  plant_id: number;
  code: string;
  name: string;
}

interface DbArea {
  area_id: number;
  code: string;
  name: string;
}

export default async function AdminUsersPage() {
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
  let users: UserListItem[] = [];

  if (callerPlantId === null) {
    const res = await query<UserListItem>(
      `SELECT u.user_id, u.email, u.full_name, u.is_admin, u.admin_plant_id,
              u.active, u.must_change_password,
              (SELECT array_agg(a.code ORDER BY a.code)
               FROM user_plant_area_access upa
               JOIN area a ON a.area_id = upa.area_id
               WHERE upa.user_id = u.user_id) AS area_codes,
              (SELECT array_agg(upa.area_id ORDER BY upa.area_id)
               FROM user_plant_area_access upa
               WHERE upa.user_id = u.user_id) AS area_ids,
              COALESCE(
                u.admin_plant_id,
                (SELECT upa.plant_id FROM user_plant_area_access upa WHERE upa.user_id = u.user_id LIMIT 1)
              ) AS plant_id,
              COALESCE(
                p.code,
                (SELECT p2.code FROM user_plant_area_access upa2
                 JOIN plant p2 ON p2.plant_id = upa2.plant_id
                 WHERE upa2.user_id = u.user_id LIMIT 1)
              ) AS admin_plant_code
       FROM app_user u
       LEFT JOIN plant p ON p.plant_id = u.admin_plant_id
       ORDER BY u.user_id`
    );
    users = res.rows;
  } else {
    const res = await query<UserListItem>(
      `SELECT u.user_id, u.email, u.full_name, u.is_admin, u.admin_plant_id,
              u.active, u.must_change_password,
              (SELECT array_agg(a.code ORDER BY a.code)
               FROM user_plant_area_access upa
               JOIN area a ON a.area_id = upa.area_id
               WHERE upa.user_id = u.user_id) AS area_codes,
              (SELECT array_agg(upa.area_id ORDER BY upa.area_id)
               FROM user_plant_area_access upa
               WHERE upa.user_id = u.user_id) AS area_ids,
              COALESCE(
                u.admin_plant_id,
                (SELECT upa.plant_id FROM user_plant_area_access upa WHERE upa.user_id = u.user_id LIMIT 1)
              ) AS plant_id,
              COALESCE(
                p.code,
                (SELECT p2.code FROM user_plant_area_access upa2
                 JOIN plant p2 ON p2.plant_id = upa2.plant_id
                 WHERE upa2.user_id = u.user_id LIMIT 1)
              ) AS admin_plant_code
       FROM app_user u
       LEFT JOIN plant p ON p.plant_id = u.admin_plant_id
       WHERE u.admin_plant_id = $1
          OR EXISTS (
             SELECT 1 FROM user_plant_area_access upa
             WHERE upa.user_id = u.user_id AND upa.plant_id = $1
          )
       ORDER BY u.user_id`,
      [callerPlantId]
    );
    users = res.rows;
  }

  const plantsRes = await query<DbPlant>("SELECT plant_id, code, name FROM plant WHERE active = true ORDER BY code");
  const areasRes = await query<DbArea>("SELECT area_id, code, name FROM area WHERE active = true ORDER BY code");

  const plants = plantsRes.rows.map((p) => ({
    id: p.plant_id,
    code: p.code,
    name: p.name,
  }));

  const areas = areasRes.rows.map((a) => ({
    id: a.area_id,
    code: a.code,
    name: a.name,
  }));

  const currentUser = {
    isAdmin: session.user.isAdmin,
    adminPlantId: session.user.adminPlantId,
  };

  return (
    <AdminUsersClient
      initialUsers={users}
      plants={plants}
      areas={areas}
      currentUser={currentUser}
    />
  );
}

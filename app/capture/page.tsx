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

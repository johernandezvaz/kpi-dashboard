import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import argon2 from "argon2";
import { query } from "@/lib/db";

const DUMMY_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

interface AppUserRow {
  user_id: number;
  email: string;
  full_name: string;
  password_hash: string;
  is_admin: boolean;
  is_global: boolean;
  is_global_viewer: boolean;
  active: boolean;
  must_change_password: boolean;
  admin_plant_id: number | null;
}

function logLoginEvent(
  userId: number | null,
  email: string,
  success: boolean,
  ip: string | null,
  userAgent: string | null
) {
  query(
    `INSERT INTO login_event (user_id, email, success, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, email.toLowerCase(), success, ip, userAgent]
  ).catch((err) => console.error("Failed to log login event:", err));
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const forwarded = req?.headers?.["x-forwarded-for"];
        const ip = typeof forwarded === "string"
          ? forwarded.split(",")[0].trim()
          : (req?.headers?.["x-real-ip"] as string | undefined) ?? null;
        const userAgent = (req?.headers?.["user-agent"] as string | undefined) ?? null;

        try {
          const result = await query<AppUserRow>(
            `SELECT user_id, email, full_name, password_hash, is_admin, is_global, is_global_viewer, active, must_change_password, admin_plant_id
             FROM app_user
             WHERE email = $1`,
            [credentials.email]
          );

          const user = result.rows[0] ?? null;

          if (!user || !user.active) {
            await argon2.verify(DUMMY_HASH, credentials.password).catch(() => null);
            logLoginEvent(user?.user_id ?? null, credentials.email, false, ip, userAgent);
            return null;
          }

          const valid = await argon2.verify(user.password_hash, credentials.password);
          if (!valid) {
            logLoginEvent(user.user_id, credentials.email, false, ip, userAgent);
            return null;
          }

          logLoginEvent(user.user_id, credentials.email, true, ip, userAgent);
          query(
            `UPDATE app_user SET last_login_at = NOW() WHERE user_id = $1`,
            [user.user_id]
          ).catch((err) => console.error("Failed to update last_login_at:", err));

          return {
            id: String(user.user_id),
            email: user.email,
            name: user.full_name,
            isAdmin: user.is_admin,
            isGlobal: user.is_global,
            isGlobalViewer: user.is_global_viewer,
            mustChangePassword: user.must_change_password,
            adminPlantId: user.admin_plant_id,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = user.isAdmin;
        token.isGlobal = user.isGlobal;
        token.isGlobalViewer = user.isGlobalViewer;
        token.mustChangePassword = user.mustChangePassword;
        token.adminPlantId = user.adminPlantId ?? null;
      }

      if (token.adminPlantId === undefined) token.adminPlantId = null;
      if (token.isAdmin === undefined) token.isAdmin = false;
      if (token.isGlobal === undefined) token.isGlobal = false;
      if (token.isGlobalViewer === undefined) token.isGlobalViewer = false;
      if (token.mustChangePassword === undefined) token.mustChangePassword = false;
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.isAdmin = token.isAdmin;
      session.user.isGlobal = token.isGlobal;
      session.user.isGlobalViewer = token.isGlobalViewer;
      session.user.mustChangePassword = token.mustChangePassword;
      session.user.adminPlantId = token.adminPlantId;
      return session;
    },
  },
};

export async function getAuthorizedPlants(session: any) {
  if (!session?.user) return [];

  const { id: userId, isAdmin, isGlobal, isGlobalViewer, adminPlantId } = session.user;

  if (isGlobal || isGlobalViewer || (isAdmin && adminPlantId === null)) {
    const res = await query<{ plant_id: number; code: string; name: string }>(
      `SELECT plant_id, code, name
       FROM plant
       WHERE active = true
       ORDER BY name`
    );
    return res.rows;
  }

  if (isAdmin && adminPlantId !== null) {
    const res = await query<{ plant_id: number; code: string; name: string }>(
      `SELECT plant_id, code, name
       FROM plant
       WHERE plant_id = $1 AND active = true`,
      [adminPlantId]
    );
    return res.rows;
  }

  if (!isAdmin && !isGlobal && !isGlobalViewer) {
    const res = await query<{ plant_id: number; code: string; name: string }>(
      `SELECT DISTINCT p.plant_id, p.code, p.name
       FROM plant p
       JOIN user_plant_area_access upa ON upa.plant_id = p.plant_id
       WHERE upa.user_id = $1 AND p.active = true
       ORDER BY p.name`,
      [Number(userId)]
    );
    return res.rows;
  }

  return [];
}

export async function isAuthorizedForPlant(session: any, plantCode: string): Promise<boolean> {
  if (!session?.user) return false;

  const { id: userId, isAdmin, isGlobal, isGlobalViewer, adminPlantId } = session.user;

  if (isGlobal || isGlobalViewer || (isAdmin && adminPlantId === null)) {
    return true;
  }
  if (isAdmin && adminPlantId !== null) {
    const res = await query(
      "SELECT 1 FROM plant WHERE plant_id = $1 AND code = $2 AND active = true",
      [adminPlantId, plantCode]
    );
    return (res.rowCount ?? 0) > 0;
  }

  if (!isAdmin && !isGlobal && !isGlobalViewer) {
    const res = await query(
      `SELECT 1 FROM plant p
       JOIN user_plant_area_access upa ON upa.plant_id = p.plant_id
       WHERE upa.user_id = $1 AND p.code = $2 AND p.active = true`,
      [Number(userId), plantCode]
    );
    return (res.rowCount ?? 0) > 0;
  }

  return false;
}


import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import argon2 from "argon2";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

interface PasswordHashRow {
  password_hash: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { currentPassword, newPassword, confirmPassword } = body as Record<string, unknown>;

  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
  }

  if (newPassword === currentPassword) {
    return NextResponse.json(
      { error: "New password must be different" },
      { status: 400 }
    );
  }

  try {
    const result = await query<PasswordHashRow>(
      `SELECT password_hash FROM app_user WHERE user_id = $1`,
      [session.user.id]
    );

    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 400 });
    }

    const storedHash = result.rows[0].password_hash;
    const valid = await argon2.verify(storedHash, currentPassword);
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    const newHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
      hashLength: 32,
    });

    await query(
      `UPDATE app_user SET password_hash = $1, must_change_password = FALSE WHERE user_id = $2`,
      [newHash, session.user.id]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/account/change-password] error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

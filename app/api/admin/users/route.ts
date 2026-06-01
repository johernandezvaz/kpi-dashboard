import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, pool } from "@/lib/db";
import argon2 from "argon2";
import crypto from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*+-=";
const UPPERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERS = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%&*+-=";

function generatePassword(): string {
  while (true) {
    let pw = "";
    for (let i = 0; i < 16; i++) {
      const idx = crypto.randomInt(0, ALPHABET.length);
      pw += ALPHABET[idx];
    }
    const hasUpper = [...pw].some((c) => UPPERS.includes(c));
    const hasLower = [...pw].some((c) => LOWERS.includes(c));
    const hasDigit = [...pw].some((c) => DIGITS.includes(c));
    const hasSymbol = [...pw].some((c) => SYMBOLS.includes(c));
    if (hasUpper && hasLower && hasDigit && hasSymbol) {
      return pw;
    }
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!session.user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { email, fullName, plantId, isPlantAdmin, areaIds } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (!fullName || typeof fullName !== "string" || fullName.trim() === "") {
      return NextResponse.json({ error: "Invalid full name" }, { status: 400 });
    }
    if (typeof plantId !== "number") {
      return NextResponse.json({ error: "Invalid plant ID" }, { status: 400 });
    }

    const callerPlantId = session.user.adminPlantId;
    if (callerPlantId !== null && callerPlantId !== undefined) {
      if (plantId !== callerPlantId) {
        return NextResponse.json({ error: "Forbidden: Plant admin mismatch" }, { status: 403 });
      }
      if (isPlantAdmin) {
        return NextResponse.json({ error: "Forbidden: Plant admins cannot create other admins" }, { status: 403 });
      }
    }

    if (!Array.isArray(areaIds) || areaIds.length === 0) {
      return NextResponse.json({ error: "At least one area must be assigned" }, { status: 400 });
    }
    const areaCheck = await query("SELECT area_id FROM area WHERE area_id = ANY($1)", [areaIds]);
    if (areaCheck.rows.length !== areaIds.length) {
      return NextResponse.json({ error: "Invalid area ID(s)" }, { status: 400 });
    }

    const plantCheck = await query("SELECT 1 FROM plant WHERE plant_id = $1", [plantId]);
    if (plantCheck.rows.length === 0) {
      return NextResponse.json({ error: "Plant not found" }, { status: 400 });
    }

    const lowerEmail = email.trim().toLowerCase();
    const emailCheck = await query("SELECT 1 FROM app_user WHERE email = $1", [lowerEmail]);
    if (emailCheck.rows.length > 0) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    const temporaryPassword = generatePassword();
    const passwordHash = await argon2.hash(temporaryPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
      hashLength: 32,
    });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [String(session.user.id)]);

      const userInsert = await client.query(
        `INSERT INTO app_user (email, full_name, password_hash, is_admin, admin_plant_id, is_global, active, must_change_password)
         VALUES ($1, $2, $3, $4, $5, FALSE, TRUE, TRUE)
         RETURNING user_id`,
        [lowerEmail, fullName.trim(), passwordHash, !!isPlantAdmin, isPlantAdmin ? plantId : null]
      );
      const newUserId = userInsert.rows[0].user_id;

      for (const areaId of areaIds) {
        await client.query(
          `INSERT INTO user_plant_area_access (user_id, plant_id, area_id, can_edit)
           VALUES ($1, $2, $3, TRUE)`,
          [newUserId, plantId, areaId]
        );
      }

      await client.query("COMMIT");

      return NextResponse.json(
        {
          userId: newUserId,
          email: lowerEmail,
          temporaryPassword,
        },
        { status: 201 }
      );
    } catch (txError) {
      await client.query("ROLLBACK");
      throw txError;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error in POST /api/admin/users:", error);
    return NextResponse.json({ error: error.message || "An unexpected error occurred during user creation" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!session.user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, email, fullName, plantId, isPlantAdmin, areaIds, active, resetPassword } = body;

    if (!userId || typeof userId !== "number") {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    // Load target user
    const userRes = await query("SELECT * FROM app_user WHERE user_id = $1", [userId]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const targetUser = userRes.rows[0];

    // Load target user's current plant
    const targetUserPlantRes = await query(
      `SELECT COALESCE(
         admin_plant_id,
         (SELECT plant_id FROM user_plant_area_access WHERE user_id = $1 LIMIT 1)
       ) AS plant_id FROM app_user WHERE user_id = $1`,
      [userId]
    );
    const targetUserPlantId = targetUserPlantRes.rows[0]?.plant_id;

    const callerPlantId = session.user.adminPlantId;
    if (callerPlantId !== null && callerPlantId !== undefined) {
      if (targetUser.is_admin) {
        return NextResponse.json({ error: "Forbidden: Plant admins can only manage operational users" }, { status: 403 });
      }
      if (targetUserPlantId !== callerPlantId) {
        return NextResponse.json({ error: "Forbidden: Target user is in a different plant" }, { status: 403 });
      }
      if (isPlantAdmin !== undefined && isPlantAdmin !== false) {
        return NextResponse.json({ error: "Forbidden: Plant admins cannot grant admin status" }, { status: 403 });
      }
      if (plantId !== undefined && plantId !== callerPlantId) {
        return NextResponse.json({ error: "Forbidden: Plant admins cannot change user plant" }, { status: 403 });
      }
    }

    // Email validation
    let lowerEmail = targetUser.email;
    if (email !== undefined) {
      if (typeof email !== "string" || !email.includes("@")) {
        return NextResponse.json({ error: "Invalid email" }, { status: 400 });
      }
      lowerEmail = email.trim().toLowerCase();
      const emailCheck = await query("SELECT 1 FROM app_user WHERE email = $1 AND user_id <> $2", [lowerEmail, userId]);
      if (emailCheck.rows.length > 0) {
        return NextResponse.json({ error: "Email already exists" }, { status: 409 });
      }
    }

    // Name validation
    let nameVal = targetUser.full_name;
    if (fullName !== undefined) {
      if (typeof fullName !== "string" || fullName.trim() === "") {
        return NextResponse.json({ error: "Invalid full name" }, { status: 400 });
      }
      nameVal = fullName.trim();
    }

    // Active validation
    let activeVal = targetUser.active;
    if (active !== undefined) {
      if (typeof active !== "boolean") {
        return NextResponse.json({ error: "Invalid active status" }, { status: 400 });
      }
      activeVal = active;
    }

    // Role and Plant resolution
    let resolvedIsAdmin = targetUser.is_admin;
    let resolvedAdminPlantId = targetUser.admin_plant_id;
    let resolvedPlantId = plantId !== undefined ? plantId : targetUserPlantId;

    if (isPlantAdmin !== undefined) {
      resolvedIsAdmin = isPlantAdmin;
      resolvedAdminPlantId = isPlantAdmin ? resolvedPlantId : null;
    } else if (plantId !== undefined) {
      if (resolvedIsAdmin) {
        resolvedAdminPlantId = plantId;
      }
    }

    // Area IDs validation
    let areasToAssign = areaIds;
    const isTargetSuperadmin = resolvedIsAdmin && resolvedAdminPlantId === null;
    if (!isTargetSuperadmin) {
      if (areasToAssign !== undefined) {
        if (!Array.isArray(areasToAssign) || areasToAssign.length === 0) {
          return NextResponse.json({ error: "At least one area must be assigned" }, { status: 400 });
        }
        const areaCheck = await query("SELECT area_id FROM area WHERE area_id = ANY($1)", [areasToAssign]);
        if (areaCheck.rows.length !== areasToAssign.length) {
          return NextResponse.json({ error: "Invalid area ID(s)" }, { status: 400 });
        }
      }
    }

    // Validate plant existence
    if (plantId !== undefined) {
      const plantCheck = await query("SELECT 1 FROM plant WHERE plant_id = $1", [plantId]);
      if (plantCheck.rows.length === 0) {
        return NextResponse.json({ error: "Plant not found" }, { status: 400 });
      }
    }

    let temporaryPassword = null;
    let passwordHash = null;

    if (resetPassword) {
      temporaryPassword = generatePassword();
      passwordHash = await argon2.hash(temporaryPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
        hashLength: 32,
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [String(session.user.id)]);

      // Update app_user
      if (passwordHash) {
        await client.query(
          `UPDATE app_user
           SET email = $1, full_name = $2, is_admin = $3, admin_plant_id = $4, active = $5,
               password_hash = $6, must_change_password = TRUE
           WHERE user_id = $7`,
          [lowerEmail, nameVal, resolvedIsAdmin, resolvedAdminPlantId, activeVal, passwordHash, userId]
        );
      } else {
        await client.query(
          `UPDATE app_user
           SET email = $1, full_name = $2, is_admin = $3, admin_plant_id = $4, active = $5
           WHERE user_id = $6`,
          [lowerEmail, nameVal, resolvedIsAdmin, resolvedAdminPlantId, activeVal, userId]
        );
      }

      // Update user_plant_area_access
      const isTargetSuperadmin = resolvedIsAdmin && resolvedAdminPlantId === null;
      if (isTargetSuperadmin) {
        await client.query("DELETE FROM user_plant_area_access WHERE user_id = $1", [userId]);
      } else {
        if (areasToAssign !== undefined || plantId !== undefined) {
          if (areasToAssign === undefined) {
            const currentAreas = await client.query("SELECT area_id FROM user_plant_area_access WHERE user_id = $1", [userId]);
            areasToAssign = currentAreas.rows.map((r) => r.area_id);
          }

          await client.query("DELETE FROM user_plant_area_access WHERE user_id = $1", [userId]);
          
          if (areasToAssign.length > 0) {
            for (const areaId of areasToAssign) {
              await client.query(
                `INSERT INTO user_plant_area_access (user_id, plant_id, area_id, can_edit)
                 VALUES ($1, $2, $3, TRUE)`,
                [userId, resolvedPlantId, areaId]
              );
            }
          }
        }
      }

      await client.query("COMMIT");

      const responsePayload: any = { success: true };
      if (temporaryPassword) {
        responsePayload.temporaryPassword = temporaryPassword;
      }
      return NextResponse.json(responsePayload);
    } catch (txError) {
      await client.query("ROLLBACK");
      throw txError;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error in PUT /api/admin/users:", error);
    return NextResponse.json({ error: error.message || "An unexpected error occurred during user update" }, { status: 500 });
  }
}


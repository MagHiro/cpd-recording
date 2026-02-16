import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/server/admin-auth";
import { findUserByEmail, upsertUserAndVault } from "@/lib/server/db";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { adminManualRegisterSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await requireAdminUser();

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const perIpLimit = assertRateLimit(`admin-manual-register:${ip}`, 30, 15 * 60 * 1000);
    if (!perIpLimit.ok) {
      return NextResponse.json({ error: "Too many registration attempts. Try again later." }, { status: 429 });
    }

    const body = await req.json();
    const parsed = adminManualRegisterSchema.parse(body);

    const perEmailLimit = assertRateLimit(`admin-manual-register:${ip}:${parsed.email}`, 5, 15 * 60 * 1000);
    if (!perEmailLimit.ok) {
      return NextResponse.json({ error: "Too many attempts for this email. Try again later." }, { status: 429 });
    }

    const existing = await findUserByEmail(parsed.email);
    const owner = await upsertUserAndVault(parsed.email);

    return NextResponse.json({
      success: true,
      email: owner.email,
      vaultSlug: owner.slug,
      created: !existing,
      message: existing ? "User already registered." : "User registered successfully.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}

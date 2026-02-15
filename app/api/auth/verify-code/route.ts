import { NextRequest, NextResponse } from "next/server";

import { attachUserSession } from "@/lib/server/auth";
import { findUserByEmail, pruneExpiredAuthRows, consumeLoginCode } from "@/lib/server/db";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { hashWithSecret } from "@/lib/server/security";
import { loginVerifySchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await pruneExpiredAuthRows();

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const body = await req.json();
    const parsed = loginVerifySchema.parse(body);

    const limit = assertRateLimit(`login-verify:${ip}:${parsed.email}`, 10, 15 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const existing = await findUserByEmail(parsed.email);
    if (!existing) {
      return NextResponse.json({ error: "You are not registered." }, { status: 404 });
    }

    const consumed = await consumeLoginCode(existing.id, hashWithSecret(`${parsed.email}:${parsed.code}`));
    if (!consumed) {
      return NextResponse.json({ error: "Invalid email or code." }, { status: 401 });
    }

    return await attachUserSession(NextResponse.json({ success: true }), existing.id);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}

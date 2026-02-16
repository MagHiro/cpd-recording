import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createLoginCode, findUserByEmail, pruneExpiredAuthRows } from "@/lib/server/db";
import { sendLoginCodeEmail } from "@/lib/server/mailer";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { createNumericCode, hashWithSecret } from "@/lib/server/security";
import { loginRequestSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await pruneExpiredAuthRows();

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const body = await req.json();
    const parsed = loginRequestSchema.parse(body);

    const limit = assertRateLimit(`login-request:${ip}:${parsed.email}`, 5, 15 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    const existing = await findUserByEmail(parsed.email);

    if (!existing) {
      return NextResponse.json({ error: "You are not registered." }, { status: 404 });
    }

    const code = createNumericCode(6);
    const expiresAt = Date.now() + env.LOGIN_CODE_TTL_MINUTES * 60 * 1000;
    await createLoginCode(existing.id, hashWithSecret(`${parsed.email}:${code}`), expiresAt);
    await sendLoginCodeEmail(parsed.email, code);

    return NextResponse.json({
      success: true,
      message: "A login code has been sent.",
    });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}

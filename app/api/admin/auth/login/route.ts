import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { issueAdminSession, verifyAdminCredentials } from "@/lib/server/admin-auth";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { adminLoginSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limit = assertRateLimit(`admin-login:${ip}`, 10, 15 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
    }

    const body = await req.json();
    const parsed = adminLoginSchema.parse(body);

    if (!verifyAdminCredentials(parsed.email, parsed.password)) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const session = await issueAdminSession(parsed.email);
    const response = NextResponse.json({ success: true });
    response.cookies.set(env.ADMIN_SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: session.expiresAt,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { deleteSessionByTokenHash } from "@/lib/server/db";
import { hashWithSecret } from "@/lib/server/security";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(env.SESSION_COOKIE_NAME)?.value;
  if (token) {
    await deleteSessionByTokenHash(hashWithSecret(token));
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(env.SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });

  return response;
}

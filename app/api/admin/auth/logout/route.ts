import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { revokeAdminSession } from "@/lib/server/admin-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(env.ADMIN_SESSION_COOKIE_NAME)?.value;

  if (token) {
    await revokeAdminSession(token);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(env.ADMIN_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(0),
  });
  return response;
}

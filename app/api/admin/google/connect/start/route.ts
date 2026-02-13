import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { buildDriveConnectUrl } from "@/lib/server/google-drive-connect";

export const runtime = "nodejs";

const DRIVE_CONNECT_STATE_COOKIE = "rv_drive_connect_state";

export async function GET() {
  try {
    await requireAdminUser();

    const state = randomBytes(32).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set(DRIVE_CONNECT_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });

    return NextResponse.redirect(buildDriveConnectUrl(state));
  } catch {
    return NextResponse.redirect(new URL("/admin/login", env.APP_URL));
  }
}

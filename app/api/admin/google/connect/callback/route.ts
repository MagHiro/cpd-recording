import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { exchangeDriveConnectCode } from "@/lib/server/google-drive-connect";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { safeEqual } from "@/lib/server/security";
import { upsertDriveConnection } from "@/lib/server/db";

export const runtime = "nodejs";

const DRIVE_CONNECT_STATE_COOKIE = "rv_drive_connect_state";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/admin?drive=error&reason=${encodeURIComponent(error)}`, env.APP_URL));
  }

  try {
    await requireAdminUser();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", env.APP_URL));
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(DRIVE_CONNECT_STATE_COOKIE)?.value;
  cookieStore.delete(DRIVE_CONNECT_STATE_COOKIE);

  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
    return NextResponse.redirect(new URL("/admin?drive=error&reason=invalid_state", env.APP_URL));
  }

  try {
    const tokenResult = await exchangeDriveConnectCode(code);
    if (!tokenResult.refreshToken) {
      return NextResponse.redirect(new URL("/admin?drive=error&reason=no_refresh_token", env.APP_URL));
    }

    await upsertDriveConnection({
      refreshToken: tokenResult.refreshToken,
      email: tokenResult.email,
    });

    return NextResponse.redirect(new URL("/admin?drive=connected", env.APP_URL));
  } catch {
    return NextResponse.redirect(new URL("/admin?drive=error&reason=token_exchange_failed", env.APP_URL));
  }
}

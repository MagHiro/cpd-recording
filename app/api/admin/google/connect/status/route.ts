import { NextResponse } from "next/server";

import { getDriveConnectionInfo } from "@/lib/server/db";
import { requireAdminUser } from "@/lib/server/admin-auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdminUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    drive: await getDriveConnectionInfo(),
  });
}

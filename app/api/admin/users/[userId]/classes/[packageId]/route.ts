import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/server/admin-auth";
import { deleteUserVaultClass, listUserVaultClasses } from "@/lib/server/db";
import { assertRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string; packageId: string }> },
) {
  try {
    await requireAdminUser();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limit = assertRateLimit(`admin-user-class-delete:${ip}`, 80, 15 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many class update attempts. Try again later." }, { status: 429 });
    }

    const { userId, packageId } = await params;
    const deleted = await deleteUserVaultClass({ userId, packageId });
    if (!deleted) {
      return NextResponse.json({ error: "Class assignment not found." }, { status: 404 });
    }

    const classes = await listUserVaultClasses(userId);
    return NextResponse.json({
      success: true,
      classes,
      message: "Class assignment removed.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

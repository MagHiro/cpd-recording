import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/server/admin-auth";
import { deleteRegisteredUser } from "@/lib/server/db";
import { assertRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    await requireAdminUser();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limit = assertRateLimit(`admin-user-delete:${ip}`, 20, 15 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many delete attempts. Try again later." }, { status: 429 });
    }

    const { userId } = await params;
    const deleted = await deleteRegisteredUser(userId);
    if (!deleted) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Participant removed." });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

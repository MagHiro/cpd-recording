import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/server/admin-auth";
import {
  assignCatalogVideosToEmail,
  findUserByEmail,
  getVaultByUserId,
  listUserVaultClasses,
} from "@/lib/server/db";
import { assertRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

function parseCodes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean)));
  }
  if (typeof value === "string") {
    return Array.from(new Set(value.split(/[\n,]/g).map((item) => item.trim()).filter(Boolean)));
  }
  return [];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    await requireAdminUser();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limit = assertRateLimit(`admin-user-classes-list:${ip}`, 120, 5 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    const { userId } = await params;
    const vault = await getVaultByUserId(userId);
    if (!vault) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const classes = await listUserVaultClasses(userId);
    return NextResponse.json({ success: true, classes });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    await requireAdminUser();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limit = assertRateLimit(`admin-user-classes-add:${ip}`, 60, 15 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many class update attempts. Try again later." }, { status: 429 });
    }

    const { userId } = await params;
    const vault = await getVaultByUserId(userId);
    if (!vault) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as { classCodes?: unknown };
    const classCodes = parseCodes(body.classCodes);
    if (classCodes.length === 0) {
      return NextResponse.json({ error: "Provide at least one class code." }, { status: 400 });
    }

    const user = await findUserByEmail(vault.email);
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const assigned = await assignCatalogVideosToEmail({
      email: user.email,
      videoIds: classCodes,
    });
    const classes = await listUserVaultClasses(userId);

    return NextResponse.json({
      success: true,
      classes,
      pendingVideoIds: assigned.pendingVideoIds,
      addedCount: assigned.packages.length,
      message: "Class assignments updated.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

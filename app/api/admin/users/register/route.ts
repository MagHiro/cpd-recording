import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireAdminUser } from "@/lib/server/admin-auth";
import { assignCatalogVideosToEmail, findUserByEmail, listRegisteredUsers, upsertUserAndVault } from "@/lib/server/db";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { adminManualRegisterSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAdminUser();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limit = assertRateLimit(`admin-users-list:${ip}`, 60, 5 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    const users = await listRegisteredUsers(500);
    return NextResponse.json({ success: true, users });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminUser();

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const perIpLimit = assertRateLimit(`admin-manual-register:${ip}`, 30, 15 * 60 * 1000);
    if (!perIpLimit.ok) {
      return NextResponse.json({ error: "Too many registration attempts. Try again later." }, { status: 429 });
    }

    const body = await req.json();
    const parsed = adminManualRegisterSchema.parse(body);

    const perEmailLimit = assertRateLimit(`admin-manual-register:${ip}:${parsed.email}`, 5, 15 * 60 * 1000);
    if (!perEmailLimit.ok) {
      return NextResponse.json({ error: "Too many attempts for this email. Try again later." }, { status: 429 });
    }

    const existing = await findUserByEmail(parsed.email);
    const owner = await upsertUserAndVault(parsed.email);
    const requestedVideoIds = Array.from(
      new Set([...parsed.classCodes, ...parsed.videoIds].map((v) => v.trim()).filter(Boolean)),
    );

    let packages:
      | Array<{
          videoId: string;
          packageId: string;
          totalAssets: number;
          classCode: string;
          classTitle: string;
          unavailable: boolean;
        }>
      | undefined;
    let pendingVideoIds: string[] | undefined;

    if (requestedVideoIds.length > 0) {
      const assigned = await assignCatalogVideosToEmail({
        email: owner.email,
        requestId: parsed.requestId,
        videoIds: requestedVideoIds,
      });
      packages = assigned.packages.map((pkg) => ({
        ...pkg,
        unavailable: Boolean(pkg.unavailable),
      }));
      pendingVideoIds = assigned.pendingVideoIds;
    }

    return NextResponse.json({
      success: true,
      email: owner.email,
      vaultSlug: owner.slug,
      created: !existing,
      requestedVideoIds,
      pendingVideoIds: pendingVideoIds ?? [],
      packages: packages ?? [],
      message:
        requestedVideoIds.length > 0
          ? "User registered and class codes processed."
          : existing
            ? "User already registered."
            : "User registered successfully.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request payload.",
          details: error.issues.map((issue) => ({
            path: issue.path.join(".") || "(root)",
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request." },
      { status: 400 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/server/auth";
import { findAssetForUser } from "@/lib/server/db";
import { issueStreamToken } from "@/lib/server/stream-token";

export const runtime = "nodejs";

export async function GET(req: NextRequest, context: { params: Promise<{ assetId: string }> }) {
  try {
    const user = await requireSessionUser();
    const { assetId } = await context.params;
    const asset = await findAssetForUser(user.userId, assetId);
    if (!asset || asset.type !== "VIDEO") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const userAgent = req.headers.get("user-agent") ?? "";
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const token = issueStreamToken({
      assetId,
      userId: user.userId,
      userAgent,
      ip,
      ttlSeconds: 60 * 60,
    });

    return NextResponse.json({
      success: true,
      streamUrl: `/api/stream/${assetId}?token=${encodeURIComponent(token)}`,
      expiresInSeconds: 60 * 60,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

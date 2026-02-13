import { NextRequest, NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/server/auth";
import { findAssetForUser } from "@/lib/server/db";
import { fetchDriveMedia } from "@/lib/server/google-drive";
import { verifyStreamToken } from "@/lib/server/stream-token";

export const runtime = "nodejs";

function toSafeAsciiFilename(input: string): string {
  const collapsed = input
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/["\\\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return collapsed || "video";
}

export async function GET(req: NextRequest, context: { params: Promise<{ assetId: string }> }) {
  try {
    const user = await requireSessionUser();
    const { assetId } = await context.params;
    const token = req.nextUrl.searchParams.get("token") ?? "";
    const userAgent = req.headers.get("user-agent") ?? "";
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const validToken = verifyStreamToken({
      token,
      assetId,
      userId: user.userId,
      userAgent,
      ip,
    });
    if (!validToken) {
      return NextResponse.json({ error: "Forbidden stream token." }, { status: 403 });
    }

    const asset = await findAssetForUser(user.userId, assetId);

    if (!asset || asset.type !== "VIDEO") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const upstream = await fetchDriveMedia(asset.googleDriveFileId, req.headers.get("range"));

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json({ error: "Failed to stream media." }, { status: upstream.status || 502 });
    }

    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("content-type") ?? asset.mimeType ?? "video/mp4");
    headers.set("Accept-Ranges", upstream.headers.get("accept-ranges") ?? "bytes");
    headers.set("Cache-Control", "private, no-store, max-age=0");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Content-Disposition", `inline; filename="${toSafeAsciiFilename(asset.title)}"`);

    const passthroughHeaders = ["content-length", "content-range"];
    for (const key of passthroughHeaders) {
      const value = upstream.headers.get(key);
      if (value) {
        headers.set(key, value);
      }
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

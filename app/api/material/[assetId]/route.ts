import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/server/auth";
import { findAssetForUser } from "@/lib/server/db";
import { fetchDriveMedia } from "@/lib/server/google-drive";

export const runtime = "nodejs";

function toSafeAsciiFilename(input: string): string {
  const collapsed = input
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/["\\\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return collapsed || "material";
}

export async function GET(req: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const user = await requireSessionUser();
    const { assetId } = await context.params;
    const asset = await findAssetForUser(user.userId, assetId);

    if (!asset || asset.type === "VIDEO") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const upstream = await fetchDriveMedia(asset.googleDriveFileId);
    if (!upstream.ok) {
      return NextResponse.json({ error: "Failed to fetch material." }, { status: upstream.status || 502 });
    }

    const isPdf = asset.type === "PDF";
    const extension = isPdf ? "pdf" : "zip";

    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("content-type") ?? asset.mimeType ?? (isPdf ? "application/pdf" : "application/zip"));
    headers.set("Cache-Control", "private, no-store, max-age=0");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set(
      "Content-Disposition",
      `${isPdf ? "inline" : "attachment"}; filename="${toSafeAsciiFilename(asset.title)}.${extension}"`,
    );

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) {
      headers.set("content-length", contentLength);
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

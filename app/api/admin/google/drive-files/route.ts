import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/server/admin-auth";
import { listDriveFiles } from "@/lib/server/google-drive";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAdminUser();
    const query = req.nextUrl.searchParams.get("query") ?? "";
    const pageToken = req.nextUrl.searchParams.get("pageToken") ?? "";
    const pageSize = Number(req.nextUrl.searchParams.get("pageSize") ?? "20");

    const result = await listDriveFiles({
      query,
      pageToken: pageToken || undefined,
      pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    });

    return NextResponse.json({
      success: true,
      files: result.files,
      nextPageToken: result.nextPageToken,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to list Google Drive files." }, { status: 400 });
  }
}

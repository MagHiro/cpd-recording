import { NextRequest, NextResponse } from "next/server";

import { extractGoogleDriveFileId } from "@/lib/drive-file-id";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { fetchDriveFileMetadata } from "@/lib/server/google-drive";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAdminUser();
    const input = req.nextUrl.searchParams.get("input")?.trim() ?? "";
    const fileId = extractGoogleDriveFileId(input);

    if (!fileId) {
      return NextResponse.json({ error: "Provide a valid Google Drive file ID or link." }, { status: 400 });
    }

    const metadata = await fetchDriveFileMetadata(fileId);
    return NextResponse.json({ success: true, ...metadata });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to fetch Google Drive file metadata." }, { status: 400 });
  }
}

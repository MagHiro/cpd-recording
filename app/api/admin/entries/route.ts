import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/server/admin-auth";
import { listCatalogVideoEntries, syncCatalogEntryToExistingPackages, upsertCatalogVideoEntry } from "@/lib/server/db";
import { adminCreateEntrySchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdminUser();
    return NextResponse.json({ success: true, items: await listCatalogVideoEntries(100) });
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
    const body = await req.json();
    const parsed = adminCreateEntrySchema.parse(body);

    const materials = parsed.materials.map((asset) => ({
      assetId: asset.assetId,
      title: asset.title,
      kind: asset.kind,
      googleDriveFileId: asset.googleDriveFileId,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
    }));

    const result = await upsertCatalogVideoEntry({
      videoId: parsed.videoId,
      classCode: parsed.classCode,
      classTitle: parsed.classTitle,
      classDate: parsed.classDate ?? undefined,
      classPrice: parsed.classPrice,
      googleDriveFileId: parsed.recording.googleDriveFileId,
      mimeType: parsed.recording.mimeType,
      materials: materials.map((asset) => ({
        ...asset,
        kind: asset.kind as "PDF" | "ZIP",
      })),
    });
    const sync = await syncCatalogEntryToExistingPackages(result.videoId);

    return NextResponse.json({
      success: true,
      videoId: result.videoId,
      classCode: result.classCode,
      classTitle: result.classTitle,
      updatedExistingPackages: sync.updatedPackages,
      message: "Catalog entry saved.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
}

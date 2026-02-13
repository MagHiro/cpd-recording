import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { env } from "@/lib/env";
import { assignCatalogVideosToEmail, ingestPackage } from "@/lib/server/db";
import { verifyN8nSignature } from "@/lib/server/n8n";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { n8nBookedClassIngestSchema, n8nCatalogAssignSchema, n8nIngestSchema } from "@/lib/validators";

export const runtime = "nodejs";

function formatZodError(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limit = assertRateLimit(`n8n:${ip}`, 120, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
    }

    const signature = req.headers.get("x-n8n-signature") ?? "";
    const timestamp = req.headers.get("x-n8n-timestamp") ?? "";
    const rawBody = await req.text();

    if (!verifyN8nSignature(timestamp, signature)) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const catalogAssignParsed = n8nCatalogAssignSchema.safeParse(json);
    if (catalogAssignParsed.success) {
      const videoIds = [
        ...(catalogAssignParsed.data.videoIds ?? []),
        ...(catalogAssignParsed.data.video_ids ?? []),
        ...(catalogAssignParsed.data.videoId ? [catalogAssignParsed.data.videoId] : []),
      ];

      const result = await assignCatalogVideosToEmail({
        email: catalogAssignParsed.data.email,
        requestId: catalogAssignParsed.data.requestId,
        videoIds,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: "Some videoIds are not found in catalog.", missingVideoIds: result.missingVideoIds },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        email: catalogAssignParsed.data.email,
        vaultLink: `${env.APP_URL}/vault`,
        vaultSlug: result.owner.slug,
        totalPackages: result.packages.length,
        packages: result.packages,
        message: "Catalog videos assigned successfully.",
      });
    }

    const modernParsed = n8nIngestSchema.safeParse(json);
    if (modernParsed.success) {
      const assets = [...modernParsed.data.recordings, ...modernParsed.data.materials].map((asset) => ({
        externalAssetId: asset.assetId,
        title: asset.title,
        type: asset.kind,
        googleDriveFileId: asset.googleDriveFileId,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
      }));

      const result = await ingestPackage({
        email: modernParsed.data.email,
        requestId: modernParsed.data.requestId,
        packageTitle: modernParsed.data.packageTitle,
        assets,
      });

      return NextResponse.json({
        success: true,
        email: modernParsed.data.email,
        vaultLink: `${env.APP_URL}/vault`,
        vaultSlug: result.owner.slug,
        packageId: result.packageId,
        totalAssets: result.totalAssets,
        message: "Vault provisioned/updated successfully.",
      });
    }

    const bookedClassParsed = n8nBookedClassIngestSchema.safeParse(json);
    if (!bookedClassParsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload.",
          details: {
            acceptedFormats: [
              "catalog_assign: { email, requestId?, videoIds[] | videoId | video_ids[] }",
              "direct_assets: { email, requestId?, packageTitle, recordings[], materials[] }",
              "booked_class: { email, requestId?, booked_class[] }",
            ],
            catalogAssignErrors: formatZodError(catalogAssignParsed.error),
            directAssetErrors: formatZodError(modernParsed.error),
            bookedClassErrors: formatZodError(bookedClassParsed.error),
          },
        },
        { status: 400 },
      );
    }

    const createdPackages = [];

    for (const item of bookedClassParsed.data.booked_class) {
      const assets = [...item.recordings, ...item.materials].map((asset) => ({
        externalAssetId: asset.assetId,
        title: asset.title,
        type: asset.kind,
        googleDriveFileId: asset.googleDriveFileId,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
      }));

      if (assets.length === 0) {
        return NextResponse.json(
          {
            error:
              "Each booked_class entry must include recordings/materials with googleDriveFileId so media can be streamed.",
            classCode: item.class_information.class_code,
            classTitle: item.title,
          },
          { status: 400 },
        );
      }

      const requestId =
        item.requestId ??
        `${bookedClassParsed.data.requestId ?? "booking"}:${item.class_information.class_code}:${item.class_information.id ?? "na"}`;

      const packageTitle = `${item.class_information.class_code} - ${item.title}`;
      const result = await ingestPackage({
        email: bookedClassParsed.data.email,
        requestId,
        packageTitle,
        classCode: item.class_information.class_code,
        classDate: item.class_date,
        classPrice: item.class_information.price,
        assets,
      });

      createdPackages.push({
        classCode: item.class_information.class_code,
        classTitle: item.title,
        classDate: item.class_date,
        packageId: result.packageId,
        totalAssets: result.totalAssets,
      });
    }

    return NextResponse.json({
      success: true,
      email: bookedClassParsed.data.email,
      vaultLink: `${env.APP_URL}/vault`,
      packages: createdPackages,
      totalPackages: createdPackages.length,
      message: "Vault provisioned/updated successfully from booked_class payload.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid request payload.",
        message: error instanceof Error ? error.message : "Unexpected error",
      },
      { status: 400 },
    );
  }
}

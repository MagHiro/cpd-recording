import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/server/admin-auth";
import { assignCatalogVideosToEmail, upsertUserAndVault } from "@/lib/server/db";
import { parseCsv } from "@/lib/server/csv";

export const runtime = "nodejs";

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function safe(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalizeHeader(value: string): string {
  return value.replace(/^\ufeff/, "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function getByAliases(row: Record<string, string>, aliases: string[]): string {
  const aliasSet = new Set(aliases.map(normalizeHeader));
  for (const [key, value] of Object.entries(row)) {
    if (aliasSet.has(normalizeHeader(key))) return value;
  }
  return "";
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminUser();
    const body = (await req.json()) as { csv?: string };
    const sourceCsv = body.csv ?? "";

    if (!sourceCsv.trim()) {
      return NextResponse.json({ error: "CSV content is required." }, { status: 400 });
    }

    const rows = parseCsv(sourceCsv);
    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV has no data rows." }, { status: 400 });
    }

    const grouped = new Map<string, Set<string>>();
    let skippedInvalid = 0;

    for (const row of rows) {
      const email = safe(
        getByAliases(row, ["email", "email_address", "emailaddress", "attendee_email", "user_email"]),
      ).toLowerCase();
      const classCode = safe(
        getByAliases(row, ["class_code", "classcode", "class", "video_id", "videoid"]),
      );
      if (!email || !classCode || !isLikelyEmail(email)) {
        skippedInvalid += 1;
        continue;
      }

      if (!grouped.has(email)) grouped.set(email, new Set());
      grouped.get(email)?.add(classCode);
    }

    let upsertedUsers = 0;
    let provisionedUsers = 0;
    let provisionedClassCodes = 0;
    const errors: Array<{ email: string; message: string }> = [];

    for (const [email, classCodes] of grouped.entries()) {
      try {
        await upsertUserAndVault(email);
        upsertedUsers += 1;

        const videoIds = Array.from(classCodes);
        if (videoIds.length > 0) {
          await assignCatalogVideosToEmail({
            email,
            videoIds,
          });
          provisionedUsers += 1;
          provisionedClassCodes += videoIds.length;
        }
      } catch (error) {
        errors.push({
          email,
          message: error instanceof Error ? error.message : "Unexpected error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalRows: rows.length,
      validRows: Array.from(grouped.values()).reduce((sum, set) => sum + set.size, 0),
      uniqueEmails: grouped.size,
      upsertedUsers,
      provisionedUsers,
      provisionedClassCodes,
      skippedInvalid,
      failedUsers: errors.length,
      errors: errors.slice(0, 20),
      message: "CSV import completed.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

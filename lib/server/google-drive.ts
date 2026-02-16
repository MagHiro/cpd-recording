import { OAuth2Client } from "google-auth-library";

import { env } from "@/lib/env";
import { getAppSetting } from "@/lib/server/db";

function assertOAuthConfig(): void {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error("Google OAuth client credentials are not configured.");
  }
}

const oauthClient = new OAuth2Client({
  clientId: env.GOOGLE_OAUTH_CLIENT_ID,
  clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
});

async function getDriveAccessToken(): Promise<string> {
  assertOAuthConfig();
  const refreshToken = (await getAppSetting("drive_refresh_token")) ?? env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error("Google Drive OAuth refresh token is not configured. Connect Drive from /admin.");
  }

  oauthClient.setCredentials({
    refresh_token: refreshToken,
  });

  const accessToken = await oauthClient.getAccessToken();

  if (!accessToken.token) {
    throw new Error("Google Drive token acquisition failed.");
  }

  return accessToken.token;
}

export async function fetchDriveMedia(fileId: string, range?: string | null): Promise<Response> {
  const accessToken = await getDriveAccessToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };

  if (range) {
    headers.Range = range;
  }

  return fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
}

export async function fetchDriveFileMetadata(fileId: string): Promise<{
  id: string;
  title: string;
  mimeType: string;
  sizeBytes?: number;
  webViewLink?: string;
}> {
  const accessToken = await getDriveAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,webViewLink`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Unable to fetch Google Drive file metadata.");
  }

  const data = (await response.json()) as { id: string; name?: string; mimeType?: string; size?: string; webViewLink?: string };
  return {
    id: data.id,
    title: data.name?.trim() || fileId,
    mimeType: data.mimeType?.trim() || "application/octet-stream",
    sizeBytes: data.size ? Number(data.size) : undefined,
    webViewLink: data.webViewLink,
  };
}

export async function listDriveFiles(params?: {
  query?: string;
  pageToken?: string;
  pageSize?: number;
}): Promise<{
  files: Array<{ id: string; title: string; mimeType: string; sizeBytes?: number; webViewLink?: string }>;
  nextPageToken: string | null;
}> {
  const accessToken = await getDriveAccessToken();
  const pageSize = Math.min(Math.max(params?.pageSize ?? 20, 1), 100);
  const search = (params?.query ?? "").trim();

  const queryParts = ["trashed = false"];
  if (search) {
    const escaped = search.replace(/'/g, "\\'");
    queryParts.push(`name contains '${escaped}'`);
  }

  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,size,webViewLink)");
  url.searchParams.set("orderBy", "modifiedTime desc");
  url.searchParams.set("q", queryParts.join(" and "));
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");
  if (params?.pageToken) {
    url.searchParams.set("pageToken", params.pageToken);
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to list Google Drive files.");
  }

  const data = (await response.json()) as {
    nextPageToken?: string;
    files?: Array<{ id: string; name?: string; mimeType?: string; size?: string; webViewLink?: string }>;
  };

  return {
    files: (data.files ?? []).map((file) => ({
      id: file.id,
      title: file.name?.trim() || file.id,
      mimeType: file.mimeType?.trim() || "application/octet-stream",
      sizeBytes: file.size ? Number(file.size) : undefined,
      webViewLink: file.webViewLink,
    })),
    nextPageToken: data.nextPageToken ?? null,
  };
}

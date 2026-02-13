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

export async function fetchDriveMedia(fileId: string, range?: string | null): Promise<Response> {
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

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken.token}`,
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

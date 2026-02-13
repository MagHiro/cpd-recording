import { OAuth2Client } from "google-auth-library";

import { env } from "@/lib/env";

function assertOAuthConfig(): void {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error("Google OAuth client credentials are not configured.");
  }
}

const oauthClient = new OAuth2Client({
  clientId: env.GOOGLE_OAUTH_CLIENT_ID,
  clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
  redirectUri: env.GOOGLE_DRIVE_CONNECT_REDIRECT_URI,
});

export function buildDriveConnectUrl(state: string): string {
  assertOAuthConfig();
  return oauthClient.generateAuthUrl({
    access_type: "offline",
    include_granted_scopes: true,
    prompt: "consent",
    scope: env.GOOGLE_DRIVE_SCOPES.split(",")
      .map((scope) => scope.trim())
      .filter(Boolean),
    state,
  });
}

export async function exchangeDriveConnectCode(code: string): Promise<{ refreshToken: string | null; email: string | null }> {
  assertOAuthConfig();
  const { tokens } = await oauthClient.getToken(code);

  let email: string | null = null;
  if (tokens.access_token) {
    try {
      const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
        cache: "no-store",
      });
      if (profileResponse.ok) {
        const profile = (await profileResponse.json()) as { email?: string };
        if (profile.email) {
          email = profile.email.trim().toLowerCase();
        }
      }
    } catch {
      email = null;
    }
  }

  return {
    refreshToken: tokens.refresh_token ?? null,
    email,
  };
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import {
  createSession,
  deleteSessionByTokenHash,
  findUserByEmail,
  getSessionByTokenHash,
  getVaultByUserId,
  touchSession,
} from "@/lib/server/db";
import { createSessionToken, hashWithSecret } from "@/lib/server/security";

export type SessionUser = {
  userId: string;
  email: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  const tokenHash = hashWithSecret(rawToken);
  const session = await getSessionByTokenHash(tokenHash);

  if (!session) {
    return null;
  }

  if (Number(session.expires_at) <= Date.now()) {
    await deleteSessionByTokenHash(tokenHash);
    return null;
  }

  await touchSession(session.id);

  const vault = await getVaultByUserId(session.user_id);
  if (!vault) {
    return null;
  }

  return {
    userId: vault.userId,
    email: vault.email,
  };
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function hasProvisionedAccount(email: string): Promise<boolean> {
  return Boolean(await findUserByEmail(email));
}

export async function attachUserSession(response: NextResponse, userId: string): Promise<NextResponse> {
  const sessionToken = createSessionToken();
  const sessionHash = hashWithSecret(sessionToken);
  const expiresAtMs = Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

  await createSession(userId, sessionHash, expiresAtMs);
  response.cookies.set(env.SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAtMs),
  });

  return response;
}

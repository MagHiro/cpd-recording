import { cookies } from "next/headers";

import { env } from "@/lib/env";
import {
  createAdminSession,
  deleteAdminSessionByTokenHash,
  getAdminSessionByTokenHash,
  pruneExpiredAuthRows,
  touchAdminSession,
} from "@/lib/server/db";
import { createSessionToken, hashWithSecret, safeEqual } from "@/lib/server/security";

export type AdminUser = {
  email: string;
};

export async function getAdminUser(): Promise<AdminUser | null> {
  await pruneExpiredAuthRows();
  const cookieStore = await cookies();
  const token = cookieStore.get(env.ADMIN_SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await getAdminSessionByTokenHash(hashWithSecret(token));
  if (!session) {
    return null;
  }

  if (Number(session.expires_at) <= Date.now()) {
    await deleteAdminSessionByTokenHash(hashWithSecret(token));
    return null;
  }

  await touchAdminSession(session.id);
  return { email: session.admin_email };
}

export async function requireAdminUser(): Promise<AdminUser> {
  const admin = await getAdminUser();
  if (!admin) {
    throw new Error("ADMIN_UNAUTHORIZED");
  }
  return admin;
}

export function verifyAdminCredentials(email: string, password: string): boolean {
  return safeEqual(email.trim().toLowerCase(), env.ADMIN_EMAIL.trim().toLowerCase()) && safeEqual(password, env.ADMIN_PASSWORD);
}

export async function issueAdminSession(email: string): Promise<{ token: string; expiresAt: Date }> {
  const token = createSessionToken();
  const expiresAtMs = Date.now() + env.ADMIN_SESSION_TTL_HOURS * 60 * 60 * 1000;
  await createAdminSession(email.trim().toLowerCase(), hashWithSecret(token), expiresAtMs);
  return { token, expiresAt: new Date(expiresAtMs) };
}

export async function revokeAdminSession(token: string): Promise<void> {
  await deleteAdminSessionByTokenHash(hashWithSecret(token));
}

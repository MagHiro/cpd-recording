import { createHmac, randomBytes } from "crypto";

import { env } from "@/lib/env";

type StreamTokenPayload = {
  a: string;
  u: string;
  e: number;
  n: string;
  h: string;
};

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(payloadB64: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(`stream:${payloadB64}`).digest("base64url");
}

function fingerprint(userAgent: string, ip: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(`${userAgent}|${ip}`).digest("hex");
}

export function issueStreamToken(params: {
  assetId: string;
  userId: string;
  userAgent: string;
  ip: string;
  ttlSeconds?: number;
}): string {
  const payload: StreamTokenPayload = {
    a: params.assetId,
    u: params.userId,
    e: Date.now() + (params.ttlSeconds ?? 60 * 60) * 1000,
    n: randomBytes(10).toString("hex"),
    h: fingerprint(params.userAgent, params.ip),
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifyStreamToken(params: {
  token: string;
  assetId: string;
  userId: string;
  userAgent: string;
  ip: string;
}): boolean {
  const [payloadB64, tokenSig] = params.token.split(".");
  if (!payloadB64 || !tokenSig) {
    return false;
  }

  const expectedSig = sign(payloadB64);
  if (expectedSig !== tokenSig) {
    return false;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as StreamTokenPayload;
    if (!payload || typeof payload !== "object") {
      return false;
    }
    if (payload.a !== params.assetId || payload.u !== params.userId) {
      return false;
    }
    if (!payload.e || payload.e < Date.now()) {
      return false;
    }
    const expectedFp = fingerprint(params.userAgent, params.ip);
    if (payload.h !== expectedFp) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

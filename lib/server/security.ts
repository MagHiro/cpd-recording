import { createHash, randomBytes, timingSafeEqual } from "crypto";

import { env } from "@/lib/env";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hashWithSecret(input: string): string {
  return sha256(`${env.SESSION_SECRET}:${input}`);
}

export function createNumericCode(length = 6): string {
  const digits = "0123456789";
  let code = "";
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i += 1) {
    code += digits[bytes[i] % 10];
  }
  return code;
}

export function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

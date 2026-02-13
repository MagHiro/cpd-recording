import { createHmac } from "crypto";

import { env } from "@/lib/env";
import { safeEqual } from "@/lib/server/security";

function signTimestamp(timestamp: string): string {
  return createHmac("sha256", env.N8N_WEBHOOK_SECRET).update(timestamp).digest("hex");
}

export function verifyN8nSignature(timestamp: string, signature: string): boolean {
  const now = Math.floor(Date.now() / 1000);
  const ts = Number(timestamp);

  if (!Number.isFinite(ts)) {
    return false;
  }

  const delta = Math.abs(now - ts);
  if (delta > env.N8N_TIMESTAMP_TOLERANCE_SECONDS) {
    return false;
  }

  const expected = signTimestamp(timestamp);
  return safeEqual(expected, signature);
}

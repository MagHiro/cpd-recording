type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function assertRateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const next = { count: 1, resetAt: now + windowMs };
    buckets.set(key, next);
    return { ok: true, remaining: limit - 1, resetAt: next.resetAt };
  }

  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  buckets.set(key, bucket);
  return { ok: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

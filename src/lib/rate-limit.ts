// Server-only sliding-window limiter, per user and bucket. Protects AI endpoints from abuse and runaway cost.
// ponytail: in-memory, so it resets on restart and is per server process; use a shared store (Redis/Supabase) if you scale to several instances.
const hits = new Map<string, number[]>();

/** Returns true if the call is allowed. */
export function allow(userId: string, bucket: string, max: number, windowMs = 60_000): boolean {
  const key = `${bucket}:${userId}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export const TOO_MANY = "Too many requests, please wait a minute.";

// Simple in-memory cache (per server instance) for upstream API responses.
// Fresh entries serve directly; expired entries stay available for a longer
// "stale" window so the UI can fall back to them if upstream rate-limits us.

interface Entry {
  value: unknown;
  freshUntil: number;
  staleUntil: number;
}

const store = new Map<string, Entry>();

export interface CacheHit<T> {
  value: T;
  stale: boolean;
}

export function cacheGet<T>(key: string): CacheHit<T> | null {
  const hit = store.get(key);
  if (!hit) return null;
  const now = Date.now();
  if (now > hit.staleUntil) {
    store.delete(key);
    return null;
  }
  return { value: hit.value as T, stale: now > hit.freshUntil };
}

export function cacheSet(key: string, value: unknown, freshTtlMs: number, staleTtlMs?: number): void {
  // prevent unbounded growth: drop the oldest entry when large
  if (store.size > 200) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, {
    value,
    freshUntil: Date.now() + freshTtlMs,
    staleUntil: Date.now() + (staleTtlMs ?? freshTtlMs * 12),
  });
}

/** Fetch an upstream URL, retrying on 429 / network errors with exponential backoff. */
export async function fetchUpstream(url: string, tries = 5): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.status === 429 && attempt < tries - 1) {
        const backoff = 600 * 2 ** attempt + Math.random() * 300;
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err as Error;
      if (attempt < tries - 1) {
        await new Promise((r) => setTimeout(r, 600 * 2 ** attempt));
      }
    }
  }
  throw lastError ?? new Error('Upstream request failed');
}

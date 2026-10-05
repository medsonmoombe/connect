/**
 * API response cache — cache-aside for hot read endpoints.
 *
 * Backend (mirrors rate-limit.ts):
 *   1. ioredis (self-hosted / REDIS_URL)  — shared across instances
 *   2. Upstash REST                        — if UPSTASH_REDIS_REST_URL set
 *   3. In-memory                           — dev / single-instance fallback
 *
 * Invalidation uses a version counter per key family (`bumpFamily`), so
 * writes never need to know exact cache keys: readers embed the family
 * version in the key, and a bump instantly orphans every old entry.
 *
 * Design rules:
 *  - Only cache GET-shaped, auth-scoped-in-key, lean list views.
 *  - TTLs are short (30–90s): correctness floor even if a write path
 *    forgets to invalidate.
 *  - Never cache errors: on any backend failure we fall through to a
 *    plain fetch, so caching can only ever be a perf win.
 */

import { getRedis as getRateLimitRedis } from './rate-limit';

// ── In-memory fallback ──────────────────────────────────────────────
const memStore = new Map<string, { value: string; expiresAt: number }>();
let lastMemSweep = 0;

function memGet(key: string): string | null {
  sweepMem();
  const hit = memStore.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    memStore.delete(key);
    return null;
  }
  return hit.value;
}

function memSet(key: string, value: string, ttlMs: number): void {
  sweepMem();
  memStore.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function sweepMem(): void {
  const now = Date.now();
  if (now - lastMemSweep < 60_000) return;
  lastMemSweep = now;
  for (const [k, v] of memStore) {
    if (v.expiresAt <= now) memStore.delete(k);
  }
}

// ── Redis (shared connection from rate-limit) ──────────────────────
async function getRedis(): Promise<any | null> {
  try {
    return await getRateLimitRedis();
  } catch {
    return null;
  }
}

function redisConfigured(): boolean {
  return !!(
    process.env.REDIS_URL ||
    process.env.UPSTASH_REDIS_REST_URL
  );
}

// ── Public API ──────────────────────────────────────────────────────

export const TTL = {
  SHORT: 30_000,   // fast-moving lists
  MED: 60_000,     // marketplace / dashboard views
  LONG: 90_000,    // slow-moving reference data
} as const;

/** Read a cached JSON value; null on miss or any backend error. */
export async function cacheGetJSON<T = unknown>(key: string): Promise<T | null> {
  try {
    if (redisConfigured()) {
      const redis = await getRedis();
      if (redis) {
        const raw = await redis.get(`api-cache:${key}`);
        if (raw) return JSON.parse(raw) as T;
        return null;
      }
    }
  } catch (e) {
    console.warn('[api-cache] redis get failed, falling back:', (e as Error)?.message);
  }
  const raw = memGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Write a JSON value with TTL; silently no-ops on backend failure. */
export async function cacheSetJSON(key: string, value: unknown, ttlMs: number): Promise<void> {
  let raw: string;
  try {
    raw = JSON.stringify(value);
  } catch {
    return; // non-serializable — skip caching, never break the response
  }
  try {
    if (redisConfigured()) {
      const redis = await getRedis();
      if (redis) {
        await redis.set(`api-cache:${key}`, raw, 'PX', ttlMs);
        return;
      }
    }
  } catch (e) {
    console.warn('[api-cache] redis set failed:', (e as Error)?.message);
  }
  memSet(key, raw, ttlMs);
}

/**
 * Cache-aside wrapper. `fetcher` only runs on a miss; its non-null result
 * is stored for `ttlMs`. Returning null from the fetcher means "don't
 * cache this response" (e.g. error states or user-specific empty data).
 */
export async function withCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGetJSON<T>(key);
  if (cached !== null) return cached;
  const fresh = await fetcher();
  await cacheSetJSON(key, fresh, ttlMs);
  return fresh;
}

// ── Version-counter invalidation ────────────────────────────────────

const memVersions = new Map<string, number>();

/**
 * Bump the version of a cache family (e.g. 'projects'). All cached keys
 * that embed the family version become unreachable immediately.
 * Fire-and-forget safe: failures only cost a cache hit, never correctness
 * beyond the TTL floor.
 */
export async function bumpFamily(family: string): Promise<void> {
  try {
    if (redisConfigured()) {
      const redis = await getRedis();
      if (redis) {
        await redis.incr(`api-cache:ver:${family}`);
        return;
      }
    }
  } catch (e) {
    console.warn('[api-cache] bumpFamily redis failed:', (e as Error)?.message);
  }
  memVersions.set(family, (memVersions.get(family) ?? 0) + 1);
}

/** Current version of a family (for embedding into keys). */
export async function familyVersion(family: string): Promise<number> {
  try {
    if (redisConfigured()) {
      const redis = await getRedis();
      if (redis) {
        const v = await redis.get(`api-cache:ver:${family}`);
        return v ? parseInt(v, 10) || 0 : 0;
      }
    }
  } catch {
    // fall through to memory
  }
  return memVersions.get(family) ?? 0;
}

/** Convenience: build a versioned key like `projects:marketplace:v3:zambia`. */
export async function versionedKey(family: string, rest: string): Promise<string> {
  const v = await familyVersion(family);
  return `${family}:v${v}:${rest}`;
}

/**
 * Sliding-window rate limiter with three backends (auto-selected):
 *   1. ioredis (Docker / self-hosted Redis) — if REDIS_URL is set (Node.js only)
 *   2. Upstash Redis (cloud) — if UPSTASH_REDIS_REST_URL is set (Node.js only)
 *   3. In-memory (dev/edge fallback) — single-instance only
 */

export interface RateLimitConfig {
  prefix: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// ── In-memory backend (dev/edge fallback) ─────────────────────
// WARNING: Single-instance only. In production with multiple replicas,
// configure REDIS_URL or UPSTASH_REDIS_REST_URL for shared state.

interface MemEntry {
  timestamps: number[];
}

const memStore = new Map<string, MemEntry>();

// Periodic cleanup every 5 minutes to prevent unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memStore) {
    entry.timestamps = entry.timestamps.filter(t => t > now - 3_600_000); // keep 1hr max
    if (entry.timestamps.length === 0) memStore.delete(key);
  }
}, 5 * 60_000);

function memLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
  const key = `${config.prefix}:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const entry = memStore.get(key) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter(t => t > windowStart);

  const allowed = entry.timestamps.length < config.limit;
  if (allowed) {
    entry.timestamps.push(now);
    memStore.set(key, entry);
  }

  const resetAt = entry.timestamps.length > 0
    ? entry.timestamps[0] + config.windowMs
    : now + config.windowMs;

  return {
    allowed,
    remaining: Math.max(0, config.limit - entry.timestamps.length),
    resetAt,
  };
}

// ── ioredis backend (Docker / self-hosted, Node.js only) ──────

let _redis: any = null;

export async function getRedis(): Promise<any> {
  if (_redis) return _redis;
  const { default: RedisImpl } = await import('ioredis');
  _redis = new RedisImpl(process.env.REDIS_URL!, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
  });
  await _redis.connect();
  return _redis;
}

async function ioredisLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const redis = await getRedis();
  const key = `rl:${config.prefix}:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const lua = `
    local key = KEYS[1]
    local window_start = tonumber(ARGV[1])
    local window_ms = tonumber(ARGV[2])
    local limit = tonumber(ARGV[3])
    local now = tonumber(ARGV[4])

    redis.call('ZREMRANGEBYSCORE', key, 0, window_start)

    local count = redis.call('ZCARD', key)

    if count < limit then
      redis.call('ZADD', key, now, now .. '-' .. math.random(100000))
      redis.call('PEXPIRE', key, window_ms)
      return {1, limit - count - 1, now + window_ms}
    else
      local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
      local reset = #oldest >= 2 and (tonumber(oldest[2]) + window_ms) or (now + window_ms)
      return {0, 0, reset}
    end
  `;

  const result = await redis.eval(
    lua,
    1,
    key,
    String(windowStart),
    String(config.windowMs),
    String(config.limit),
    String(now),
  ) as number[];

  return {
    allowed: result[0] === 1,
    remaining: Math.max(0, result[1]),
    resetAt: result[2],
  };
}

// ── Upstash Redis backend (cloud) ─────────────────────────────

async function upstashLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const { Ratelimit } = await import('@upstash/ratelimit');
  const { Redis } = await import('@upstash/redis');

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.limit, `${config.windowMs} ms`),
    analytics: false,
    prefix: `rl:${config.prefix}`,
  });

  const { success, remaining, reset } = await limiter.limit(identifier);

  return {
    allowed: success,
    remaining: Math.max(0, remaining),
    resetAt: reset,
  };
}

// ── Unified entry point ────────────────────────────────────────
// Backend is resolved per-call to avoid module-level side effects
// in edge runtime (which evaluates all top-level code).

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  // Edge runtime: always use in-memory (Node.js-only backends unavailable)
  if (typeof process !== 'undefined' && process.env?.NEXT_RUNTIME === 'edge') {
    return memLimit(identifier, config);
  }

  if (process.env.REDIS_URL) {
    return ioredisLimit(identifier, config);
  }

  if (process.env.UPSTASH_REDIS_REST_URL) {
    return upstashLimit(identifier, config);
  }

  // In-memory fallback — warn in production
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      `[RateLimit] Using in-memory backend in production. ` +
      `Configure REDIS_URL or UPSTASH_REDIS_REST_URL for multi-instance support.`
    );
  }
  return memLimit(identifier, config);
}

// ── Pre-defined limit profiles ────────────────────────────────

export const RATE_LIMIT_API: RateLimitConfig = {
  prefix: 'api',
  limit: 200,
  windowMs: 60_000,
};

/**
 * Read-only API limit (GET). Dashboard pages legitimately fire many parallel
 * fetches (KPI strips, stat tabs, session polls), so reads get a much larger
 * budget than mutations. Identified per-user when authenticated.
 */
export const RATE_LIMIT_API_READ: RateLimitConfig = {
  prefix: 'api-read',
  limit: 1_800,
  windowMs: 60_000,
};

export const RATE_LIMIT_AI_ANALYSIS: RateLimitConfig = {
  prefix: 'ai-analysis',
  limit: 5,
  windowMs: 60 * 60_000,
};

export const RATE_LIMIT_AUTH: RateLimitConfig = {
  prefix: 'auth',
  limit: 20,
  windowMs: 10 * 60_000,
};

export const RATE_LIMIT_UPLOAD: RateLimitConfig = {
  prefix: 'upload',
  limit: 20,
  windowMs: 60 * 60_000,
};

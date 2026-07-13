/**
 * Sliding-window in-memory rate limiter.
 * Suitable for single-instance Next.js (dev + Vercel serverless per-instance).
 * For multi-instance production, swap the store for Redis (Upstash).
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Clean up stale keys every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.timestamps.length === 0 || now - entry.timestamps[entry.timestamps.length - 1] > 3_600_000) {
        store.delete(key);
      }
    }
  }, 5 * 60_000);
}

export interface RateLimitConfig {
  /** Unique key prefix, e.g. 'api' or 'ai-analysis' */
  prefix: string;
  /** Max requests allowed within the window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix ms timestamp when the oldest request expires
}

export function checkRateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
  const key = `${config.prefix}:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const entry = store.get(key) ?? { timestamps: [] };

  // Slide the window — drop timestamps older than windowStart
  entry.timestamps = entry.timestamps.filter(t => t > windowStart);

  const allowed = entry.timestamps.length < config.limit;

  if (allowed) {
    entry.timestamps.push(now);
    store.set(key, entry);
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

// ── Pre-defined limit profiles ────────────────────────────────

/** 200 requests per minute — general API routes */
export const RATE_LIMIT_API: RateLimitConfig = {
  prefix: 'api',
  limit: 200,
  windowMs: 60_000,
};

/** 5 AI analysis requests per hour per user */
export const RATE_LIMIT_AI_ANALYSIS: RateLimitConfig = {
  prefix: 'ai-analysis',
  limit: 5,
  windowMs: 60 * 60_000,
};

/** 20 auth attempts per 10 minutes per IP */
export const RATE_LIMIT_AUTH: RateLimitConfig = {
  prefix: 'auth',
  limit: 20,
  windowMs: 10 * 60_000,
};

/** 20 file uploads per hour per user */
export const RATE_LIMIT_UPLOAD: RateLimitConfig = {
  prefix: 'upload',
  limit: 20,
  windowMs: 60 * 60_000,
};

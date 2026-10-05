import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { checkRateLimit, RATE_LIMIT_API, RATE_LIMIT_AI_ANALYSIS, RATE_LIMIT_AUTH, RATE_LIMIT_UPLOAD } from '../rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests within the limit', async () => {
    const result = await checkRateLimit('user-1', RATE_LIMIT_API);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(199);
  });

  it('blocks requests exceeding the limit', async () => {
    for (let i = 0; i < 200; i++) {
      await checkRateLimit('user-2', { prefix: 'test', limit: 200, windowMs: 60_000 });
    }
    const result = await checkRateLimit('user-2', { prefix: 'test', limit: 200, windowMs: 60_000 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('allows requests after window expires', async () => {
    const config = { prefix: 'window-test', limit: 3, windowMs: 60_000 };
    await checkRateLimit('user-3', config);
    await checkRateLimit('user-3', config);
    await checkRateLimit('user-3', config);
    expect((await checkRateLimit('user-3', config)).allowed).toBe(false);

    vi.advanceTimersByTime(60_001);
    expect((await checkRateLimit('user-3', config)).allowed).toBe(true);
  });

  it('tracks remaining count correctly', async () => {
    const config = { prefix: 'remaining', limit: 5, windowMs: 60_000 };
    const results: number[] = [];
    for (let i = 0; i < 7; i++) {
      results.push((await checkRateLimit('user-4', config)).remaining);
    }
    expect(results).toEqual([4, 3, 2, 1, 0, 0, 0]);
  });

  it('maintains separate counters for different identifiers', async () => {
    const config = { prefix: 'separate', limit: 3, windowMs: 60_000 };
    await checkRateLimit('user-A', config);
    await checkRateLimit('user-A', config);
    await checkRateLimit('user-A', config);
    expect((await checkRateLimit('user-A', config)).allowed).toBe(false);
    const result = await checkRateLimit('user-B', config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('maintains separate counters for different prefixes', async () => {
    await checkRateLimit('shared-key', RATE_LIMIT_API);
    const result = await checkRateLimit('shared-key', RATE_LIMIT_AI_ANALYSIS);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('returns resetAt as a future timestamp', async () => {
    const now = Date.now();
    const result = await checkRateLimit('reset-test', RATE_LIMIT_API);
    expect(result.resetAt).toBeGreaterThan(now);
    expect(result.resetAt).toBeLessThanOrEqual(now + 60_000);
  });

  it('handles rapid successive requests within the window', async () => {
    const config = { prefix: 'rapid', limit: 100, windowMs: 60_000 };
    for (let i = 0; i < 100; i++) {
      expect((await checkRateLimit('rapid-user', config)).allowed).toBe(true);
    }
    expect((await checkRateLimit('rapid-user', config)).allowed).toBe(false);
  });
});

describe('Pre-defined limit profiles', () => {
  it('RATE_LIMIT_API: 200 req/min', () => {
    expect(RATE_LIMIT_API.limit).toBe(200);
    expect(RATE_LIMIT_API.windowMs).toBe(60_000);
    expect(RATE_LIMIT_API.prefix).toBe('api');
  });

  it('RATE_LIMIT_AI_ANALYSIS: 5 req/hr', () => {
    expect(RATE_LIMIT_AI_ANALYSIS.limit).toBe(5);
    expect(RATE_LIMIT_AI_ANALYSIS.windowMs).toBe(3_600_000);
    expect(RATE_LIMIT_AI_ANALYSIS.prefix).toBe('ai-analysis');
  });

  it('RATE_LIMIT_AUTH: 20 req/10min', () => {
    expect(RATE_LIMIT_AUTH.limit).toBe(20);
    expect(RATE_LIMIT_AUTH.windowMs).toBe(600_000);
    expect(RATE_LIMIT_AUTH.prefix).toBe('auth');
  });

  it('RATE_LIMIT_UPLOAD: 20 req/hr', () => {
    expect(RATE_LIMIT_UPLOAD.limit).toBe(20);
    expect(RATE_LIMIT_UPLOAD.windowMs).toBe(3_600_000);
    expect(RATE_LIMIT_UPLOAD.prefix).toBe('upload');
  });
});

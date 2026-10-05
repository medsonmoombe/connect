/**
 * Network-failure detection for outbound calls to Supabase (and similar
 * third-party services) inside API routes.
 *
 * Node's undici surfaces DNS/connect failures as `TypeError: fetch failed`
 * with a `cause` carrying codes like:
 *   EAI_AGAIN   — temporary DNS resolution failure
 *   ENOTFOUND   — hostname unknown
 *   ETIMEDOUT / ECONNREFUSED / ECONNRESET — connectivity problems
 *
 * These are *service* failures, not user errors: routes must respond 503 and
 * must not count them against user-facing mechanisms (e.g. login lockout).
 */

const NETWORK_CODES = new Set([
  'EAI_AGAIN',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
  'UND_ERR_HEADERS_TIMEOUT',
]);

const NETWORK_MESSAGES = [
  'fetch failed',
  'network error',
  'socket hang up',
  'getaddrinfo',
];

/** True when the thrown error looks like an outbound network/DNS failure. */
export function isNetworkError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { message?: unknown; code?: unknown; cause?: unknown };

  const code = (err.code ?? (err.cause as { code?: unknown } | null)?.code) as string | undefined;
  if (code && NETWORK_CODES.has(String(code).toUpperCase())) return true;

  const msg = String(err.message ?? '').toLowerCase();
  if (NETWORK_MESSAGES.some(m => msg.includes(m))) return true;

  // Recurse into the cause chain (undici nests the real error in `cause`).
  if (err.cause && err.cause !== e) return isNetworkError(err.cause);

  return false;
}

/** Consistent 503 payload for auth/service outages. */
export function serviceUnavailable(detail?: string) {
  return Response.json(
    {
      error: detail ?? 'Authentication service is temporarily unreachable. Please try again in a moment.',
      code: 'SERVICE_UNAVAILABLE',
    },
    { status: 503 }
  );
}

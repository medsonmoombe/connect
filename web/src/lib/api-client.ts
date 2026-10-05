// api-client.ts — pure fetch wrapper, no auth token management needed.
// All API routes use Supabase cookie-based auth (set automatically by the browser).

/**
 * Structured API error thrown by the client.
 * `message` is the user-facing error string (backward compat).
 * `code` and `traceId` are from the transitional envelope (PRD §13).
 */
export class ApiError extends Error {
  code: string | null;
  traceId: string | null;
  status: number;
  details: Record<string, unknown> | null;

  constructor(
    message: string,
    code: string | null,
    traceId: string | null,
    status: number,
    details: Record<string, unknown> | null = null
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.traceId = traceId;
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include', // ensures cookies are sent cross-origin if needed
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // Session expired — redirect to login
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  const json = await res.json();
  if (!res.ok) {
    // Supports both legacy { error: "message" } and transitional { error, code } formats
    const apiError = new ApiError(
      json.error || json.message || 'Request failed',
      json.code ?? null,
      json.trace_id ?? null,
      res.status,
      json,
    );
    throw apiError;
  }
  return json;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

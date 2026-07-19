import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer, getSupabaseAdmin, fetchProfileWithMemberships } from './supabase-server';

// ── PRD §13 standard response envelope ────────────────────────────────────────
// Success: { success: true, data, meta }
// Failure: { success: false, error: { code, message, trace_id } }

/** Generate a per-request trace id (used in the envelope + audit). */
export function makeTraceId(): string {
  return 'req-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** Standard success envelope (PRD §13). */
export function apiSuccess<T>(data: T, init?: ResponseInit, meta?: Record<string, unknown>): NextResponse {
  return NextResponse.json(
    { success: true, data, meta: meta ?? {} },
    init
  );
}

/** Standard failure envelope (PRD §13). */
export function apiError(
  code: string,
  message: string,
  status: number,
  traceId?: string,
  init?: ResponseInit
): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message, trace_id: traceId ?? null } },
    { status, ...(init ?? {}) }
  );
}

// Error code constants used across routes.
export const ERR = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  ORG_DEACTIVATED: 'ORG_DEACTIVATED',
  MFA_REQUIRED: 'MFA_REQUIRED',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  PRECONDITION_FAILED: 'PRECONDITION_FAILED',
  INTERNAL: 'INTERNAL',
} as const;

/**
 * Idempotency helper (PRD §14). Looks up a cached response by
 * `(userId, route, Idempotency-Key)`; if found AND not older than TTL, returns
 * the cached envelope. Otherwise returns null — the caller performs the work,
 * then calls `saveIdempotencyResponse(...)` to cache it.
 *
 *Returns the cached NextResponse on a replay, or null on a miss.
 */
export async function getIdempotencyResponse(
  req: NextRequest,
  userId: string,
  route: string
): Promise<NextResponse | null> {
  const key = req.headers.get('idempotency-key') || req.headers.get('Idempotency-Key');
  if (!key) return null;
  if (key.length > 256) return null; // guard against absurd keys

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('idempotency_keys')
    .select('response_body, status_code, created_at')
    .eq('user_id', userId)
    .eq('route', route)
    .eq('key', key)
    .maybeSingle();

  if (!data) return null;
  // TTL guard (24h). On expiry, treat as a miss.
  const ageH = (Date.now() - new Date(data.created_at).getTime()) / 3600_000;
  if (ageH > 24) return null;

  return NextResponse.json(data.response_body, { status: data.status_code });
}

/** Cache a response for idempotent replay. No-op if there's no Idempotency-Key. */
export async function saveIdempotencyResponse(
  req: NextRequest,
  userId: string,
  route: string,
  responseBody: unknown,
  statusCode: number
): Promise<void> {
  const key = req.headers.get('idempotency-key') || req.headers.get('Idempotency-Key');
  if (!key) return;
  try {
    const admin = getSupabaseAdmin();
    await admin.from('idempotency_keys').upsert(
      {
        user_id: userId,
        route,
        key,
        response_body: responseBody,
        status_code: statusCode,
      },
      { onConflict: 'user_id,route,key' }
    );
  } catch (err) {
    // Idempotency caching is best-effort — never fail the request over it.
    console.error('[Idempotency] save error:', (err as any)?.message);
  }
}

export async function getAuthenticatedUser(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) throw new Error('Unauthorized');

  const admin = getSupabaseAdmin();
  const profile = await fetchProfileWithMemberships(admin, user.id);

  if (!profile) throw new Error('User profile not found');

  if (profile.suspended_at) throw new Error('Account Suspended');

  // Block users whose organisation has been deactivated
  const membership = (profile.company_members as any[])?.[0];
  const company = membership?.companies;
  if (company?.status === 'deactivated') throw new Error('OrgDeactivated');

  // Derive role from company membership (same logic as buildUser in useAuth)
  const isPlatformAdmin = membership?.role === 'ADMIN' && company?.is_platform_org === true;
  const isOrgAdmin = !isPlatformAdmin && (membership?.role === 'OWNER' || membership?.role === 'ADMIN');

  const role = isPlatformAdmin
    ? 'ADMIN'
    : isOrgAdmin
      ? (company?.primary_role ?? 'DEVELOPER')
      : membership?.role === 'ADMIN'
        ? 'ADMIN'
        : company?.primary_role ?? 'DEVELOPER';

  return { ...profile, role, is_platform_admin: isPlatformAdmin, is_org_admin: isOrgAdmin, company_id: membership?.company_id, auth_id: user.id, email: user.email };
}

// Require a specific company role — throws if not met
export async function requireOrgRole(
  req: NextRequest,
  allowedRoles: string[]
) {
  const user = await getAuthenticatedUser(req);
  const membership = (user.company_members as any[])?.[0];
  if (!membership || !allowedRoles.includes(membership.role)) {
    throw new Error('Forbidden');
  }
  return { user, membership };
}

export async function writeAuditLog({
  userId,
  action,
  entityType,
  entityId,
  before,
  after,
  req,
}: {
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: object;
  after?: object;
  req?: NextRequest;
}) {
  try {
    const admin = getSupabaseAdmin();
    await admin.from('audit_logs').insert({
      user_id: userId,
      action_type: action,
      entity_type: entityType,
      entity_id: entityId,
      before_state: before ?? null,
      after_state: after ?? null,
      ip_address: req?.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
      user_agent: req?.headers.get('user-agent') ?? null,
    });
  } catch (err) {
    console.error('[AuditLog] Failed to write audit log:', err);
  }
}

export function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

export function forbidden() {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}

export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export function serverError(message?: string) {
  // Never leak internal error details to clients
  return Response.json({ error: message || 'Internal server error' }, { status: 500 });
}

export function accountSuspended() {
  return Response.json({ error: 'This account has been deactivated. Please contact support.' }, { status: 403 });
}

export function orgDeactivated() {
  return Response.json({ error: 'This organisation has been deactivated. Please contact support.' }, { status: 403 });
}

/**
 * Standard error handler for catch blocks in API route handlers.
 * Maps thrown errors to the correct HTTP response.
 */
export function handleRouteError(e: any) {
  if (e.message === 'Unauthorized') return unauthorized();
  if (e.message === 'Account Suspended') return accountSuspended();
  if (e.message === 'AccountSuspended') return accountSuspended();
  if (e.message === 'OrgDeactivated') return orgDeactivated();
  if (e.message === 'Forbidden') return forbidden();
  if (e.message === 'MfaRequired') return mfaRequired();
  return serverError();
}

/**
 * Pick only allowed fields from an object (prevents mass assignment).
 */
export function pickFields(
  obj: Record<string, unknown>,
  allowed: string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in obj) out[key] = obj[key];
  }
  return out;
}

/**
 * Verify the requesting user owns the project (or is platform admin).
 */
export async function verifyProjectOwnership(
  projectId: string,
  companyId: string | undefined,
  isAdmin: boolean
): Promise<boolean> {
  if (isAdmin) return true;
  if (!companyId) return false;
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('projects')
    .select('developer_id')
    .eq('id', projectId)
    .single();
  return data?.developer_id === companyId;
}

/** Only the user who created the project or a platform admin can proceed. */
export async function verifyProjectCreator(
  projectId: string,
  userId: string | undefined,
  isAdmin: boolean
): Promise<boolean> {
  if (isAdmin) return true;
  if (!userId) return false;
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('projects')
    .select('created_by')
    .eq('id', projectId)
    .single();
  return data?.created_by === userId;
}

/**
 * Verify the requesting user is a party to the engagement (or is platform admin).
 */
export async function verifyEngagementAccess(
  engagementId: string,
  companyId: string | undefined,
  isAdmin: boolean
): Promise<boolean> {
  if (isAdmin) return true;
  if (!companyId) return false;
  const admin = getSupabaseAdmin();

  // Get the engagement and the project's developer_id in one query
  const { data: engagement } = await admin
    .from('engagements')
    .select('counterparty_id, project:projects(developer_id)')
    .eq('id', engagementId)
    .single();
  if (!engagement) return false;

  // Check if user belongs to the developer org
  if ((engagement.project as any)?.developer_id === companyId) return true;

  // Check if user belongs to the counterparty org via capital_partners or technical_partners
  const { data: cpPartner } = await admin
    .from('capital_partners')
    .select('company_id')
    .eq('id', engagement.counterparty_id)
    .maybeSingle();
  if (cpPartner?.company_id === companyId) return true;

  const { data: tpPartner } = await admin
    .from('technical_partners')
    .select('company_id')
    .eq('id', engagement.counterparty_id)
    .maybeSingle();
  if (tpPartner?.company_id === companyId) return true;

  return false;
}

/**
 * Sanitize a filename by stripping dangerous characters.
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '.').slice(0, 200);
}

/**
 * Allowed MIME types for file uploads.
 */
export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
]);

/**
 * Max file upload size: 50MB (PRD §E).
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Verify the requesting user has completed MFA for this session.
 * MFA is required for platform admins, org admins, and org owners.
 * Reads the `mfa_verified` cookie. Throws if missing.
 */
export async function requireMfa(req: NextRequest) {
  const user = await getAuthenticatedUser(req);

  const needsMfa = user.is_platform_admin
    || (user as any).org_member_role === 'OWNER'
    || (user as any).org_member_role === 'ADMIN'
    || user.role === 'ADMIN';

  if (!needsMfa) return user;

  const mfaCookie = req.cookies.get('mfa_verified')?.value;
  if (mfaCookie !== '1') {
    throw new Error('MfaRequired');
  }
  return user;
}

export function mfaRequired() {
  return Response.json(
    { error: 'MFA verification required. Please verify your identity.' },
    { status: 403 }
  );
}

/**
 * Find the creator of a project.
 * First tries projects.created_by, then falls back to the first OWNER/ADMIN of the developer company.
 * Returns { id, full_name, email } or null.
 */
export async function findProjectCreator(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  developerId: string,
  createdById?: string | null,
): Promise<{ id: string; full_name?: string; email?: string } | null> {
  // Prefer the stored created_by user ID
  if (createdById) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .eq('id', createdById)
      .single();

    if (profile) return profile;
  }

  // Fallback: first OWNER/ADMIN of the company
  const { data: member } = await supabase
    .from('company_members')
    .select('user_id')
    .eq('company_id', developerId)
    .in('role', ['OWNER', 'ADMIN'])
    .is('deleted_at', null)
    .order('role', { ascending: true }) // OWNER first
    .limit(1)
    .single();

  if (!member?.user_id) return null;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, full_name, email')
    .eq('id', member.user_id)
    .single();

  return profile;
}

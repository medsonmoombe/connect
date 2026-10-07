import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer, getSupabaseAdmin, fetchProfileWithMemberships } from './supabase-server';
import { verifyMfaCookie } from './mfa-cookie';

// â”€â”€ PRD Â§13 standard response envelope â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Success: { success: true, data, meta }
// Failure: { success: false, error: { code, message, trace_id } }

/** Generate a per-request trace id (used in the envelope + audit). */
export function makeTraceId(): string {
  return 'req-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** Standard success envelope (PRD Â§13). */
export function apiSuccess<T>(data: T, init?: ResponseInit, meta?: Record<string, unknown>): NextResponse {
  return NextResponse.json(
    { success: true, data, meta: meta ?? {} },
    init
  );
}

/** Standard failure envelope (PRD Â§13). */
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
 * Idempotency helper (PRD Â§14). Looks up a cached response by
 * `(userId, route, Idempotency-Key)`; if found AND not older than TTL, returns
 * the cached envelope. Otherwise returns null â€” the caller performs the work,
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
    // Idempotency caching is best-effort â€” never fail the request over it.
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

  // Derive management role from company membership (same logic as buildUser in useAuth).
  const isPlatformAdmin = membership?.role === 'ADMIN' && company?.is_platform_org === true;
  const isAuthorityOrg = company?.is_authority_org === true || company?.primary_role === 'AUTHORITY';
  const isAuthorityAdmin = !isPlatformAdmin && isAuthorityOrg && (membership?.role === 'OWNER' || membership?.role === 'ADMIN');
  const isAuthorityReviewer = !isPlatformAdmin && isAuthorityOrg && membership?.role === 'MEMBER';
  const isAuthorityUser = isAuthorityAdmin || isAuthorityReviewer;
  // Administering your OWN organisation (invite/manage team, edit profile).
  // True for authority admins too — org-level team management is not a
  // platform-admin power. System-wide actions stay gated by is_platform_admin.
  const isOrgAdmin = membership?.role === 'OWNER' || membership?.role === 'ADMIN';

  const role = isPlatformAdmin
    ? 'ADMIN'
    : isAuthorityAdmin
      ? 'AUTHORITY_ADMIN'
      : isAuthorityReviewer
        ? 'AUTHORITY_REVIEWER'
        : isOrgAdmin
          ? (company?.primary_role ?? 'DEVELOPER')
          : membership?.role === 'ADMIN'
            ? 'ADMIN'
            : company?.primary_role ?? 'DEVELOPER';

  return {
    ...profile,
    role,
    is_platform_admin: isPlatformAdmin,
    is_authority_org: isAuthorityOrg,
    is_authority_user: isAuthorityUser,
    is_authority_admin: isAuthorityAdmin,
    is_authority_reviewer: isAuthorityReviewer,
    is_management_user: isPlatformAdmin || isAuthorityUser,
    is_org_admin: isOrgAdmin,
    company_id: membership?.company_id,
    auth_id: user.id,
    email: user.email,
  };
}

// Require a specific company role â€” throws if not met
export async function requireOrgRole(
  req: NextRequest,
  allowedRoles: string[]
) {
  const user = await getAuthenticatedUser(req);
  const membership = (user.company_members as any[])?.[0];
  if (!membership || !allowedRoles.includes(membership.role)) {
    const roleStr = allowedRoles.join(' or ');
    throw new Error(`This action requires the ${roleStr} role. Contact your organisation admin to request access.`);
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
  blocking = false,
}: {
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: object;
  after?: object;
  req?: NextRequest;
  /** When true, failures propagate as exceptions instead of being silently logged.
   *  Use for critical operations (engagement transitions, MFA, role changes, etc.)
   *  where audit failure must halt the operation. */
  blocking?: boolean;
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
    if (blocking) throw err;
  }
}

/** Generate a per-request trace id (used in the envelope + audit). */
function trace(): string {
  return 'req-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// â”€â”€ Transitional response format â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Error responses include BOTH the legacy `{ error: "message" }` (backward compat)
// AND new standardized fields `{ code, trace_id, success }` so frontend can
// migrate gradually. See PRD Â§13 for the target envelope.
//
// Target (future): { success: false, error: { code, message, trace_id } }
// Transitional (now): { success: false, error: "message", code: "...", trace_id: "..." }

function errorBody(code: string, message: string): Record<string, unknown> {
  return { success: false, error: message, code, trace_id: trace() };
}

export function unauthorized(message?: string) {
  return Response.json(
    errorBody(ERR.UNAUTHORIZED, message || 'Please sign in to access this feature. Your session may have expired.'),
    { status: 401 }
  );
}

export function forbidden(message?: string) {
  return Response.json(
    errorBody(ERR.FORBIDDEN, message || 'You do not have permission to perform this action. Contact your organisation admin if you need access.'),
    { status: 403 }
  );
}

export function badRequest(message: string) {
  return Response.json(errorBody(ERR.VALIDATION, message), { status: 400 });
}

export function serverError(message?: string) {
  return Response.json(
    errorBody(ERR.INTERNAL, message || 'Something went wrong on our end. Please try again or contact support if the issue persists.'),
    { status: 500 }
  );
}

export function accountSuspended() {
  return Response.json(
    errorBody(ERR.ACCOUNT_SUSPENDED, 'This account has been deactivated. Please contact your organisation admin or platform support to restore access.'),
    { status: 403 }
  );
}

export function orgDeactivated() {
  return Response.json(
    errorBody(ERR.ORG_DEACTIVATED, 'Your organisation has been deactivated. Please contact your organisation admin or platform support for more information.'),
    { status: 403 }
  );
}

/**
 * Standard error handler for catch blocks in API route handlers.
 * Maps thrown errors to the correct HTTP response.
 *
 * Route handlers can throw user-friendly errors that get surfaced directly:
 *   throw new Error('You need to be an org admin to manage team members.');
 *
 * ONLY errors with no colons (::) and that don't look like internal codes
 * or security strings are surfaced to the client to avoid leaking internals.
 */
export function handleRouteError(e: any) {
  if (e.message === 'Unauthorized') return unauthorized();
  if (e.message === 'Account Suspended') return accountSuspended();
  if (e.message === 'AccountSuspended') return accountSuspended();
  if (e.message === 'OrgDeactivated') return orgDeactivated();
  if (e.message === 'Forbidden') {
    return forbidden('You do not have permission to perform this action. Contact your organisation admin if you need access.');
  }
  if (e.message === 'MfaRequired') return mfaRequired();
  // Surface user-friendly errors that route handlers intentionally throw.
  // Safe heuristic: messages that are lowercase-starting, readable sentences
  // are user-facing. Internal errors contain codes, JSON, or technical terms.
  if (
    e.message &&
    e.message.length > 10 &&
    e.message.length < 300 &&
    !e.message.includes('::') &&
    !e.message.includes('{') &&
    !e.message.includes('\n') &&
    !e.message.startsWith('req-')
  ) {
    return badRequest(e.message);
  }
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
 * Always queries the DB first so callers get a definitive answer;
 * admin short-circuit runs only after confirming the project exists.
 */
export async function verifyProjectOwnership(
  projectId: string,
  companyId: string | undefined,
  isAdmin: boolean
): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('projects')
    .select('developer_id')
    .eq('id', projectId)
    .single();
  if (!data) return false;
  if (isAdmin) return true;
  return data.developer_id === companyId;
}

/** Only the user who created the project or a platform admin can proceed. */
export async function verifyProjectCreator(
  projectId: string,
  userId: string | undefined,
  isAdmin: boolean
): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('projects')
    .select('created_by')
    .eq('id', projectId)
    .single();
  if (!data) return false;
  if (isAdmin) return true;
  return data.created_by === userId;
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

  // Check if user belongs to the counterparty org across all partner tables
  const partnerTables = ['capital_partners', 'technical_partners', 'consultants', 'grant_providers', 'power_traders'] as const;
  for (const table of partnerTables) {
    const { data: partner } = await admin
      .from(table)
      .select('company_id')
      .eq('id', engagement.counterparty_id)
      .maybeSingle();
    if (partner?.company_id === companyId) return true;
  }

  return false;
}

/**
 * Validate password meets complexity requirements.
 * Returns null if valid, or an error message if invalid.
 * Requirements: min length (default 8), uppercase, lowercase, digit, special char.
 */
export function validatePasswordComplexity(
  password: string,
  minLength: number = 8
): string | null {
  if (password.length < minLength) {
    return `Password must be at least ${minLength} characters`;
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  if (!/[!@#$%^&*(),.?":{}|<>_\-\\\[\]\/]/.test(password)) {
    return 'Password must contain at least one special character (e.g. !@#$%^&*)';
  }
  return null;
}

/**
 * Sanitize a filename by stripping dangerous characters.
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '.').slice(0, 200);
}

/**
 * Allowed MIME types for file uploads â€” delegated to shared constants.
 */
export { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/upload-constants';

/**
 * Verify the requesting user has completed MFA for this session.
 * MFA is required for platform admins, org admins, and org owners.
 * Reads the `mfa_verified` cookie. Throws if missing.
 */
export async function requireMfa(req: NextRequest) {
  const user = await getAuthenticatedUser(req);

  // When MFA is disabled platform-wide every user bypasses step-up, matching
  // isMfaRequired() and the session endpoint's mfa_verified value.
  if (process.env.DISABLE_MFA === 'true') return user;

  const needsMfa = user.is_platform_admin
    || (user as any).is_authority_user
    || (user as any).org_member_role === 'OWNER'
    || (user as any).org_member_role === 'ADMIN'
    || user.role === 'ADMIN'
    || (user as any).mfa_enabled === true
    || (user as any).org_mfa_enforced === true;

  if (!needsMfa) return user;

  const mfaCookie = req.cookies.get('mfa_verified')?.value;
  if (!mfaCookie || !await verifyMfaCookie(mfaCookie, user.id)) {
    throw new Error('MfaRequired');
  }
  return user;
}

export function mfaRequired() {
  return Response.json(
    errorBody(ERR.MFA_REQUIRED, 'MFA verification required. Please verify your identity.'),
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

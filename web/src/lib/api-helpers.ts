import { NextRequest } from 'next/server';
import { getSupabaseServer, getSupabaseAdmin, fetchProfileWithMemberships } from './supabase-server';

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

  return { ...profile, role, is_platform_admin: isPlatformAdmin, company_id: membership?.company_id, auth_id: user.id, email: user.email };
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
  const { data } = await admin
    .from('engagements')
    .select('developer_org_id, partner_org_id')
    .eq('id', engagementId)
    .single();
  if (!data) return false;
  return data.developer_org_id === companyId || data.partner_org_id === companyId;
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
 * Max file upload size: 20MB.
 */
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

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

import { NextRequest } from 'next/server';
import { getSupabaseServer, getSupabaseAdmin, fetchProfileWithMemberships } from './supabase-server';

export async function getAuthenticatedUser(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) throw new Error('Unauthorized');

  const admin = getSupabaseAdmin();
  const profile = await fetchProfileWithMemberships(admin, user.id);

  if (!profile) throw new Error('User profile not found');

  if (profile.suspended_at) throw new Error('AccountSuspended');

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
  if (e.message === 'AccountSuspended') return accountSuspended();
  if (e.message === 'OrgDeactivated') return orgDeactivated();
  return serverError();
}

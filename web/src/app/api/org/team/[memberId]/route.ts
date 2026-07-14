import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden, badRequest, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendInviteEmail } from '@/lib/email';

type Params = { params: Promise<{ memberId: string }> };

// ── Shared helper: verify the target is a member of the same org ────────────
async function requireMember(admin: any, memberId: string, companyId: string) {
  const { data, error } = await admin
    .from('company_members')
    .select('role, user_id, company_id')
    .is('deleted_at', null)
    .eq('user_id', memberId)
    .eq('company_id', companyId)
    .single();
  if (error || !data) return null;
  return data;
}

// ── PATCH /api/org/team/[memberId] ──────────────────────────────────────────
// Supports multiple actions via the `action` field:
//   { action: 'role',            role: 'MEMBER' | 'ADMIN' }
//   { action: 'update_profile',  full_name: string }
//   { action: 'suspend',         reason?: string }
//   { action: 'reactivate' }
// Backwards-compatible: { role: 'MEMBER' | 'ADMIN' } (treated as role action)
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const membership = (user.company_members as any[])?.[0];
    const isOrgAdmin = membership?.role === 'OWNER' || membership?.role === 'ADMIN';
    if (!isOrgAdmin || !membership?.company_id) return forbidden();

    const { memberId } = await params;
    const body = await req.json();

    // Normalise legacy { role } shape into { action: 'role', role }
    const action: string = body.action ?? (body.role ? 'role' : undefined);
    if (!action) return badRequest('Missing action');

    const admin = getSupabaseAdmin();
    const companyId = membership.company_id;
    const target = await requireMember(admin, memberId, companyId);
    if (!target) return badRequest('Member not found in your organisation');

    // ── Role change ────────────────────────────────────────────────────────
    if (action === 'role') {
      const newRole: string = body.role;
      if (!['MEMBER', 'ADMIN'].includes(newRole)) return badRequest('role must be MEMBER or ADMIN');
      if (target.role === 'OWNER') return forbidden();
      if (target.user_id === user.id) return badRequest('You cannot change your own role');

      const { error } = await admin
        .from('company_members')
        .update({ role: newRole })
        .eq('user_id', memberId)
        .eq('company_id', companyId);
      if (error) {
        console.error('[Org/Team] Role update error:', error.message);
        return serverError();
      }

      await writeAuditLog({
        userId: user.id,
        action: 'ORG_MEMBER_ROLE_CHANGED',
        entityType: 'company_members',
        entityId: memberId,
        before: { role: target.role },
        after: { role: newRole },
        req,
      });

      return Response.json({ data: { user_id: memberId, role: newRole } });
    }

    // ── Update profile ─────────────────────────────────────────────────────
    if (action === 'update_profile') {
      const { full_name, phone, job_title, email_verified } = body;
      if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
        return badRequest('full_name is required');
      }

      const updates: Record<string, any> = {
        full_name: full_name.trim(),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(job_title !== undefined && { job_title: job_title?.trim() || null }),
        ...(email_verified !== undefined && {
          email_verified_at: email_verified ? new Date().toISOString() : null,
        }),
      };

      const { error } = await admin
        .from('user_profiles')
        .update(updates)
        .eq('id', memberId);
      if (error) {
        console.error('[Org/Team] Profile update error:', error.message);
        return serverError();
      }

      await writeAuditLog({
        userId: user.id,
        action: 'ORG_MEMBER_PROFILE_UPDATED',
        entityType: 'user_profiles',
        entityId: memberId,
        after: updates,
        req,
      });

      return Response.json({ data: { user_id: memberId, ...updates } });
    }

    // ── Suspend (deactivate) ───────────────────────────────────────────────
    if (action === 'suspend') {
      if (target.role === 'OWNER') return forbidden();
      if (target.user_id === user.id) return badRequest('You cannot deactivate yourself');

      // Check if already suspended
      const { data: profile } = await admin
        .from('user_profiles')
        .select('suspended_at')
        .eq('id', memberId)
        .single();
      if (profile?.suspended_at) return badRequest('Member is already deactivated');

      const reason: string | null = body.reason ?? null;
      const { error } = await admin
        .from('user_profiles')
        .update({
          suspended_at: new Date().toISOString(),
          suspended_by: user.id,
          suspension_reason: reason,
        })
        .eq('id', memberId);
      if (error) {
        console.error('[Org/Team] Suspend error:', error.message);
        return serverError();
      }

      await writeAuditLog({
        userId: user.id,
        action: 'ORG_MEMBER_DEACTIVATED',
        entityType: 'user_profiles',
        entityId: memberId,
        after: { suspended_at: new Date().toISOString(), reason },
        req,
      });

      return Response.json({ data: { user_id: memberId, suspended: true } });
    }

    // ── Reactivate ─────────────────────────────────────────────────────────
    if (action === 'reactivate') {
      const { error } = await admin
        .from('user_profiles')
        .update({
          suspended_at: null,
          suspended_by: null,
          suspension_reason: null,
        })
        .eq('id', memberId);
      if (error) {
        console.error('[Org/Team] Reactivate error:', error.message);
        return serverError();
      }

      await writeAuditLog({
        userId: user.id,
        action: 'ORG_MEMBER_REACTIVATED',
        entityType: 'user_profiles',
        entityId: memberId,
        req,
      });

      return Response.json({ data: { user_id: memberId, suspended: false } });
    }

    return badRequest(`Unknown action: ${action}`);
  } catch (e: any) {
    return handleRouteError(e);
  }
}

// ── DELETE /api/org/team/[memberId] — remove a member from the company ───────
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const membership = (user.company_members as any[])?.[0];
    const isOrgAdmin = membership?.role === 'OWNER' || membership?.role === 'ADMIN';
    if (!isOrgAdmin || !membership?.company_id) return forbidden();

    const { memberId } = await params;

    const admin = getSupabaseAdmin();

    const { data: target, error: fetchErr } = await admin
      .from('company_members')
      .select('role, user_id, company_id')
      .is('deleted_at', null)
      .eq('user_id', memberId)
      .eq('company_id', membership.company_id)
      .single();

    if (fetchErr || !target) return badRequest('Member not found in your organisation');

    // Cannot remove the OWNER
    if (target.role === 'OWNER') return forbidden();

    // Cannot remove yourself
    if (target.user_id === user.id) return badRequest('You cannot remove yourself');

    const { error } = await admin
      .from('company_members')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', memberId)
      .eq('company_id', membership.company_id);

    if (error) {
      console.error('[Org/Team] Remove member error:', error.message);
      return serverError();
    }

    await writeAuditLog({
      userId: user.id,
      action: 'ORG_MEMBER_REMOVED',
      entityType: 'company_members',
      entityId: memberId,
      before: { role: target.role, company_id: membership.company_id },
      req,
    });

    return Response.json({ success: true });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

// ── POST /api/org/team/[memberId] — resend an invite ────────────────────────
// memberId is the setup_invites.id
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const membership = (user.company_members as any[])?.[0];
    const isOrgAdmin = membership?.role === 'OWNER' || membership?.role === 'ADMIN';
    if (!isOrgAdmin || !membership?.company_id) return forbidden();

    const { memberId: inviteId } = await params;
    const admin = getSupabaseAdmin();

    // Fetch the pending invite
    const { data: invite, error: fetchErr } = await admin
      .from('setup_invites')
      .select('id, email, company_id, expires_at')
      .is('deleted_at', null)
      .eq('id', inviteId)
      .eq('company_id', membership.company_id)
      .is('used_at', null)
      .single();

    if (fetchErr || !invite) return badRequest('Invite not found or already accepted');

    // Extend expiry by 7 days from now
    const newExpiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const { error: updateErr } = await admin
      .from('setup_invites')
      .update({ expires_at: newExpiresAt })
      .eq('id', inviteId);

    if (updateErr) {
      console.error('[Org/Team] Resend invite error:', updateErr.message);
      return serverError();
    }

    await writeAuditLog({
      userId: user.id,
      action: 'ORG_INVITE_RESENT',
      entityType: 'setup_invites',
      entityId: inviteId,
      after: { email: invite.email, expires_at: newExpiresAt },
      req,
    });

    // Fetch company name for email
    const { data: company } = await admin
      .from('companies')
      .select('name')
      .is('deleted_at', null)
      .eq('id', membership.company_id)
      .single();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const { data: tokenRow } = await admin
      .from('setup_invites')
      .select('token')
      .is('deleted_at', null)
      .eq('id', inviteId)
      .single();

    const inviteLink = `${appUrl}/signup?token=${tokenRow?.token}`;
    console.log(`[Org/Team] Resent invite link generated for ${invite.email}`);

    if (invite.email) {
      await sendInviteEmail({
        to: invite.email,
        token: tokenRow?.token ?? '',
        expiresAt: newExpiresAt,
        companyName: company?.name ?? undefined,
      });
    }

    return Response.json({ success: true, expires_at: newExpiresAt });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

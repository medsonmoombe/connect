import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

// GET /api/org/settings — fetch org settings (any org member can read submission mode; admin-only for full settings)
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.company_id) return forbidden();

    const admin = getSupabaseAdmin();

    // All members can read basic settings
    const { data: company, error } = await admin
      .from('companies')
      .select('mfa_enforced, password_expiry_days, min_password_length')
      .eq('id', user.company_id)
      .single();

    if (error) {
      console.error('[OrgSettings] Fetch error:', error.message);
      return serverError();
    }

    // Full settings only for admins
    const membership = (user.company_members as any[])?.[0];
    const isAdmin = membership && ['OWNER', 'ADMIN'].includes(membership.role);

    if (!isAdmin) {
      return Response.json({ settings: {}, stats: null, members: null });
    }

    // Count org members + MFA stats
    const { count: totalMembers } = await admin
      .from('company_members')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', user.company_id)
      .is('deleted_at', null);

    const { count: mfaEnabled } = await admin
      .from('company_members')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', user.company_id)
      .is('deleted_at', null);

    // Get user IDs for this org
    const { data: memberIds } = await admin
      .from('company_members')
      .select('user_id')
      .eq('company_id', user.company_id)
      .is('deleted_at', null);

    const userIds = (memberIds ?? []).map(m => m.user_id);
    let orgMfaEnabled = 0;
    if (userIds.length > 0) {
      const { count } = await admin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .in('id', userIds)
        .eq('mfa_enabled', true);
      orgMfaEnabled = count ?? 0;
    }

    // Fetch org members for reviewer dropdown
    const { data: orgMembers } = await admin
      .from('company_members')
      .select('user_id, role')
      .eq('company_id', user.company_id)
      .is('deleted_at', null);

    const memberUserIds = (orgMembers ?? []).map(m => m.user_id);
    let memberProfiles: Array<{ id: string; email: string; full_name: string }> = [];
    if (memberUserIds.length > 0) {
      const { data: profiles } = await admin
        .from('user_profiles')
        .select('id, email, full_name')
        .in('id', memberUserIds);
      memberProfiles = profiles ?? [];
    }

    // Merge role info into profiles
    const membersWithRoles = (orgMembers ?? []).map(m => {
      const profile = memberProfiles.find(p => p.id === m.user_id);
      return {
        user_id: m.user_id,
        role: m.role,
        email: profile?.email ?? '',
        full_name: profile?.full_name ?? '',
      };
    });

    return Response.json({
      settings: company,
      stats: { totalMembers: totalMembers ?? 0, mfaEnabled: orgMfaEnabled },
      members: membersWithRoles,
    });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

// PATCH /api/org/settings — update org settings (org admin only)
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.company_id) return forbidden();

    const membership = (user.company_members as any[])?.[0];
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) return forbidden();

    const body = await req.json();
    const { mfa_enforced, password_expiry_days, min_password_length } = body;

    const admin = getSupabaseAdmin();
    const updates: Record<string, any> = {};
    if (mfa_enforced !== undefined) updates.mfa_enforced = !!mfa_enforced;
    if (password_expiry_days !== undefined) updates.password_expiry_days = Math.max(0, Math.min(365, Number(password_expiry_days)));
    if (min_password_length !== undefined) updates.min_password_length = Math.max(8, Math.min(128, Number(min_password_length)));

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { error } = await admin
      .from('companies')
      .update(updates)
      .eq('id', user.company_id);

    if (error) {
      console.error('[OrgSettings] Update error:', error.message);
      return serverError();
    }

    // If MFA was toggled, enable or disable MFA for all org members
    if (updates.mfa_enforced !== undefined) {
      const { data: members } = await admin
        .from('company_members')
        .select('user_id')
        .eq('company_id', user.company_id)
        .is('deleted_at', null);

      const memberUserIds = (members ?? []).map(m => m.user_id);
      if (memberUserIds.length > 0) {
        await admin
          .from('user_profiles')
          .update({ mfa_enabled: updates.mfa_enforced })
          .in('id', memberUserIds);
      }
    }

    await writeAuditLog({
      userId: user.id,
      action: 'ORG_SETTINGS_UPDATED',
      entityType: 'companies',
      entityId: user.company_id,
      after: updates,
      req,
    });

    return Response.json({ success: true, settings: updates });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

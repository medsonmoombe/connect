import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

// POST /api/admin/settings/bulk-mfa
// Body: { enabled: boolean, org_id?: string }
// - If org_id is provided: enforce MFA for that org (sets mfa_enforced + enables mfa_enabled for all members)
// - If org_id is not provided: enforce MFA for ALL users platform-wide
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const body = await req.json();
    const { enabled, org_id } = body;

    if (typeof enabled !== 'boolean') {
      return Response.json({ error: 'enabled must be a boolean' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    if (org_id) {
      // Per-org: set mfa_enforced on the company + enable mfa_enabled for all org members
      await admin
        .from('companies')
        .update({ mfa_enforced: enabled })
        .eq('id', org_id);

      const { data: members } = await admin
        .from('company_members')
        .select('user_id')
        .eq('company_id', org_id)
        .is('deleted_at', null);

      const memberUserIds = (members ?? []).map(m => m.user_id);
      let affected = 0;
      if (memberUserIds.length > 0) {
        await admin
          .from('user_profiles')
          .update({ mfa_enabled: enabled })
          .in('id', memberUserIds);
        affected = memberUserIds.length;
      }

      await writeAuditLog({
        userId: user.id,
        action: enabled ? 'ORG_MFA_ENFORCED' : 'ORG_MFA_UNENFORCED',
        entityType: 'companies',
        entityId: org_id,
        after: { mfa_enforced: enabled, affected_members: affected },
        req,
      });

      return Response.json({ success: true, affected, scope: 'org', org_id });
    }

    // Platform-wide: enable mfa_enabled for all users
    const { count: beforeCount } = await admin
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .neq('id', user.id);

    await admin
      .from('user_profiles')
      .update({ mfa_enabled: enabled })
      .neq('id', user.id);

    await writeAuditLog({
      userId: user.id,
      action: enabled ? 'BULK_MFA_ENABLED' : 'BULK_MFA_DISABLED',
      entityType: 'user_profiles',
      entityId: user.id,
      after: { mfa_enabled: enabled, affected_count: beforeCount ?? 0 },
      req,
    });

    return Response.json({ success: true, affected: beforeCount ?? 0, scope: 'platform' });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

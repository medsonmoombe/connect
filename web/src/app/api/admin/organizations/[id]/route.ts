import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, badRequest, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendOrgStatusEmail } from '@/lib/email';
import { createNotification, notificationBuilders } from '@/lib/notify';

const ALLOWED_STATUSES = ['verified', 'rejected', 'needs_update', 'pending_verification', 'deactivated'] as const;
type OrgStatus = typeof ALLOWED_STATUSES[number];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const { id } = await params;
    const admin = getSupabaseAdmin();

    const { data: company, error } = await admin
      .from('companies')
      .select('*')
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (error || !company) return badRequest('Company not found');

    // Members + profiles
    const { data: memberships } = await admin
      .from('company_members')
      .select('role, user_id')
      .is('deleted_at', null)
      .eq('company_id', id);

    const userIds = [...new Set((memberships ?? []).map(m => m.user_id))];
    const { data: profiles } = userIds.length > 0
      ? await admin.from('user_profiles').select('id, full_name, email, avatar_url, phone, job_title, created_at').in('id', userIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));
    const company_members = (memberships ?? []).map(m => ({
      role: m.role,
      user_id: m.user_id,
      user_profiles: profileMap.get(m.user_id) ?? null,
    }));

    // Role-specific preferences
    let preferences: Record<string, any> | null = null;
    if (company.primary_role === 'CAPITAL_PARTNER') {
      const { data } = await admin.from('capital_partners').select('*').eq('company_id', id).maybeSingle();
      preferences = data;
    } else if (company.primary_role === 'TECHNICAL_PARTNER') {
      const { data } = await admin.from('technical_partners').select('*').eq('company_id', id).maybeSingle();
      preferences = data;
    } else if (company.primary_role === 'POWER_TRADER') {
      const { data } = await admin.from('power_traders').select('*').eq('company_id', id).maybeSingle();
      preferences = data;
    }

    // Projects
    const { data: projects } = await admin
      .from('projects')
      .select('id, title, sector, status, country, created_at')
      .is('deleted_at', null)
      .eq('company_id', id)
      .order('created_at', { ascending: false });

    return Response.json({ data: { ...company, company_members, preferences, projects: projects ?? [] } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const { id } = await params;
    const body = await req.json();
    const action = body.action as string;

    const admin = getSupabaseAdmin();

    // Fetch the company
    const { data: company, error: fetchErr } = await admin
      .from('companies')
      .select('id, name, status, primary_role, description, website, location, size')
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (fetchErr || !company) return badRequest('Company not found');

    const before = { status: company.status, name: company.name, description: company.description };

    if (action === 'update_status') {
      // Status change
      const { status, note } = body as { status: OrgStatus; note?: string };
      if (!ALLOWED_STATUSES.includes(status)) {
        return badRequest(`status must be one of: ${ALLOWED_STATUSES.join(', ')}`);
      }

      const { error: updateErr } = await admin
        .from('companies')
        .update({ status, admin_note: note ?? null, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', id);

      if (updateErr) return serverError();

      await writeAuditLog({
        userId: user.id,
        action: `ORG_${status.toUpperCase()}`,
        entityType: 'companies',
        entityId: id,
        before,
        after: { status, note },
        req,
      });

      // Notify owner
      const { data: members } = await admin
        .from('company_members')
        .select('role, user_id')
        .is('deleted_at', null)
        .eq('company_id', id)
        .eq('role', 'OWNER')
        .limit(1);

      const ownerMember = members?.[0];
      if (ownerMember) {
        const { data: profile } = await admin
          .from('user_profiles')
          .select('email')
          .eq('id', ownerMember.user_id)
          .maybeSingle();

        if (profile?.email && ['verified', 'rejected', 'needs_update'].includes(status)) {
          await sendOrgStatusEmail({ to: profile.email, orgName: company.name, status: status as 'verified' | 'rejected' | 'needs_update', note });
        }
        await createNotification({
          userId: ownerMember.user_id,
          payload: notificationBuilders.orgStatusChange({ orgName: company.name, status }),
        });
      }

      return Response.json({ data: { id, status } });

    } else if (action === 'update_details') {
      // Update company details
      const { name, description, website, location, size } = body;
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (website !== undefined) updates.website = website;
      if (location !== undefined) updates.location = location;
      if (size !== undefined) updates.size = size;

      if (Object.keys(updates).length === 0) return badRequest('No fields to update');

      const { error: updateErr } = await admin
        .from('companies')
        .update(updates)
        .eq('id', id);

      if (updateErr) return serverError();

      await writeAuditLog({
        userId: user.id,
        action: 'ORG_UPDATED',
        entityType: 'companies',
        entityId: id,
        before,
        after: updates,
        req,
      });

      return Response.json({ data: { id, ...updates } });

    } else if (action === 'deactivate') {
      // Deactivate org — blocks all users from accessing site
      const { error: updateErr } = await admin
        .from('companies')
        .update({ status: 'deactivated', admin_note: body.reason ?? 'Deactivated by platform admin', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', id);

      if (updateErr) return serverError();

      await writeAuditLog({
        userId: user.id,
        action: 'ORG_DEACTIVATED',
        entityType: 'companies',
        entityId: id,
        before,
        after: { status: 'deactivated' },
        req,
      });

      // Notify all members
      const { data: members } = await admin
        .from('company_members')
        .select('user_id')
        .is('deleted_at', null)
        .eq('company_id', id);

      for (const m of members ?? []) {
        await createNotification({
          userId: m.user_id,
          payload: {
            type: 'system_announcement',
            title: 'Organisation Deactivated',
            body: `Your organisation "${company.name}" has been deactivated by the platform. Please contact support for more information.`,
            action_url: '/login?notice=org-deactivated',
          },
        });
      }

      return Response.json({ data: { id, status: 'deactivated' } });

    } else if (action === 'reactivate') {
      // Reactivate org
      const newStatus = (body.status as OrgStatus) || 'verified';
      const { error: updateErr } = await admin
        .from('companies')
        .update({ status: newStatus, admin_note: body.note ?? 'Reactivated by platform admin', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', id);

      if (updateErr) return serverError();

      await writeAuditLog({
        userId: user.id,
        action: 'ORG_REACTIVATED',
        entityType: 'companies',
        entityId: id,
        before,
        after: { status: newStatus },
        req,
      });

      // Notify all members
      const { data: members } = await admin
        .from('company_members')
        .select('user_id')
        .is('deleted_at', null)
        .eq('company_id', id);

      for (const m of members ?? []) {
        await createNotification({
          userId: m.user_id,
          payload: {
            type: 'system_announcement',
            title: 'Organisation Reactivated',
            body: `Your organisation "${company.name}" has been reactivated and is now accessible.`,
            action_url: '/dashboard',
          },
        });
      }

      return Response.json({ data: { id, status: newStatus } });

    } else {
      return badRequest('Invalid action');
    }
  } catch (e: any) {
    return handleRouteError(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const { id } = await params;
    const admin = getSupabaseAdmin();

    // Fetch the company
    const { data: company, error: fetchErr } = await admin
      .from('companies')
      .select('id, name')
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (fetchErr || !company) return badRequest('Company not found');

    // Soft-delete the company
    const { error: delErr } = await admin
      .from('companies')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (delErr) return serverError();

    // Soft-delete all company members
    await admin
      .from('company_members')
      .update({ deleted_at: new Date().toISOString() })
      .eq('company_id', id)
      .is('deleted_at', null);

    // Soft-delete all setup invites
    await admin
      .from('setup_invites')
      .update({ deleted_at: new Date().toISOString() })
      .eq('company_id', id)
      .is('deleted_at', null);

    // Soft-delete all projects + their documents
    const { data: projects } = await admin
      .from('projects')
      .select('id')
      .is('deleted_at', null)
      .eq('company_id', id);

    for (const p of projects ?? []) {
      await admin.from('project_documents').update({ deleted_at: new Date().toISOString() }).eq('project_id', p.id).is('deleted_at', null);
      await admin.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', p.id);
    }

    // Audit log
    await writeAuditLog({
      userId: user.id,
      action: 'ORG_DELETED',
      entityType: 'companies',
      entityId: id,
      before: { name: company.name },
      after: { deleted_at: new Date().toISOString() },
      req,
    });

    // Notify all members
    const { data: members } = await admin
      .from('company_members')
      .select('user_id')
      .eq('company_id', id);

    for (const m of members ?? []) {
      await createNotification({
        userId: m.user_id,
        payload: {
          type: 'system_announcement',
          title: 'Organisation Deleted',
          body: `Your organisation "${company.name}" has been removed from the platform.`,
          action_url: '/login',
        },
      });
    }

    return Response.json({ data: { id, deleted: true } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

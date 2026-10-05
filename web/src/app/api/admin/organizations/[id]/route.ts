import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, badRequest, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendOrgStatusEmail, sendEmail } from '@/lib/email';
import { createNotification, notificationBuilders, notifyUsers } from '@/lib/notify';
import { notifyOrgAdmins } from '@/lib/notify-helpers';
import { triggerMatchingRuns } from '@/lib/matching-trigger';

/**
 * Fire-and-forget partner-scoped matching trigger.
 * When a CAPITAL_PARTNER or TECHNICAL_PARTNER org is verified, we recalculate
 * matches for all live projects against that specific partner (PRD Ã‚Â§5.2).
 */
async function triggerMatchingForPartner(partnerId: string, partnerType: string, baseUrl: string) {
  try {
    const tableMap: Record<string, string> = {
      CAPITAL_PARTNER: 'capital_partners',
      TECHNICAL_PARTNER: 'technical_partners',
      CONSULTANT: 'consultants',
      GRANT_PROVIDER: 'grant_providers',
    };
    const table = tableMap[partnerType];
    if (!table) return;
    const admin = getSupabaseAdmin();
    const { data: partner } = await admin
      .from(table)
      .select('id')
      .eq('company_id', partnerId)
      .maybeSingle();

    if (!partner?.id) return;

    // Centralised trigger (lib/matching-trigger).
    await triggerMatchingRuns({ partnerId: partner.id, partnerType: table });
  } catch {
    // Fire-and-forget Ã¢â‚¬â€ never block the verification flow over matching
  }
}

const ALLOWED_STATUSES = ['verified', 'rejected', 'needs_update', 'pending_verification', 'deactivated'] as const;
type OrgStatus = typeof ALLOWED_STATUSES[number];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden('Only platform administrators can manage this organisation. Contact your platform support team if you need to make changes.');

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
    } else if (company.primary_role === 'CONSULTANT') {
      const { data } = await admin.from('consultants').select('*').eq('company_id', id).maybeSingle();
      preferences = data;
    } else if (company.primary_role === 'GRANT_PROVIDER') {
      const { data } = await admin.from('grant_providers').select('*').eq('company_id', id).maybeSingle();
      preferences = data;
    }

    // Projects
    const { data: projects } = await admin
      .from('projects')
      .select('id, name, technology_type, status, location_country, created_at')
      .is('deleted_at', null)
      .eq('developer_id', id)
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
    if (!user.is_platform_admin) return forbidden('Only platform administrators can update organisations. Contact your platform support team if changes are needed.');

    const { id } = await params;
    const body = await req.json();
    const action = body.action as string;

    const admin = getSupabaseAdmin();

    // Fetch the company
    const { data: company, error: fetchErr } = await admin
      .from('companies')
      .select('id, name, status, primary_role, description, website, country, team_size, is_authority_org')
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
        blocking: true,
      });

      // Fire matching engine when a partner org is verified (PRD Ã‚Â§5.2)
      if (status === 'verified' && ['CAPITAL_PARTNER', 'TECHNICAL_PARTNER', 'CONSULTANT', 'GRANT_PROVIDER'].includes(company.primary_role)) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        triggerMatchingForPartner(id, company.primary_role, baseUrl);
      }

      // Notify owner + all org admins
      const { data: members } = await admin
        .from('company_members')
        .select('role, user_id')
        .is('deleted_at', null)
        .eq('company_id', id)
        .in('role', ['OWNER', 'ADMIN']);

      const userIds = (members ?? []).map(m => m.user_id);
      if (userIds.length > 0) {
        // Fetch emails
        const { data: profiles } = await admin
          .from('user_profiles')
          .select('id, email, full_name')
          .in('id', userIds);

        const emailMap: Record<string, string> = {};
        for (const p of profiles ?? []) {
          if (p.email) emailMap[p.id] = p.email;
        }

        const orgPayload = notificationBuilders.orgStatusChange({ orgName: company.name, status });

        // Send email for all status changes
        if (['verified', 'rejected', 'needs_update'].includes(status)) {
          await notifyUsers({
            userIds,
            payload: orgPayload,
            channel: 'both',
            emailMap,
            emailTemplate: { subject: `Organisation ${status}: ${company.name}`, html: '' },
            emailLogType: 'org_status',
            emailEntityId: id,
          });
          // Send proper formatted emails in parallel
          await Promise.all(
            (profiles ?? []).filter(p => p.email).map(p =>
              sendOrgStatusEmail({ to: p.email!, orgName: company.name, status: status as 'verified' | 'rejected' | 'needs_update', note })
            )
          );
        } else {
          // For deactivated, pending_verification Ã¢â‚¬â€ in-app + email
          await Promise.all([
            ...userIds.map(uid =>
              createNotification({ userId: uid, payload: orgPayload })
            ),
            ...(profiles ?? []).filter(p => p.email).map(p =>
              sendEmail({
                to: p.email!,
                subject: `Organisation status changed: ${company.name} Ã¢â‚¬â€ ${status.replace(/_/g, ' ')}`,
                html: `<p>Your organisation "${company.name}" has been moved to <strong>${status.replace(/_/g, ' ')}</strong> by a platform admin.${note ? ` Reason: ${note}` : ''}</p>`,
                logType: 'org_status',
                logEntityId: id,
              })
            ),
          ]);
        }
      }

      return Response.json({ data: { id, status } });

    } else if (action === 'set_authority_org') {
      const enabled = body.enabled === true;

      if (company.primary_role !== 'DEVELOPER' && enabled) {
        return badRequest('Only developer/management organisations can be designated as authority organisations.');
      }

      const { error: updateErr } = await admin
        .from('companies')
        .update({ is_authority_org: enabled })
        .eq('id', id);

      if (updateErr) return serverError();

      await writeAuditLog({
        userId: user.id,
        action: enabled ? 'ORG_AUTHORITY_ENABLED' : 'ORG_AUTHORITY_DISABLED',
        entityType: 'companies',
        entityId: id,
        before: { is_authority_org: (company as any).is_authority_org ?? false },
        after: { is_authority_org: enabled },
        req,
        blocking: true,
      });

      return Response.json({ data: { id, is_authority_org: enabled } });
    } else if (action === 'update_details') {
      // Update company details
      const { name, description, website, country, team_size } = body;
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (website !== undefined) updates.website = website;
      if (country !== undefined) updates.country = country;
      if (team_size !== undefined) updates.team_size = team_size;

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
      // Deactivate org Ã¢â‚¬â€ blocks all users from accessing site
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
        blocking: true,
      });

      // Notify all members (in-app + email)
      const { data: members } = await admin
        .from('company_members')
        .select('user_id')
        .is('deleted_at', null)
        .eq('company_id', id);

      const memberUserIds = (members ?? []).map(m => m.user_id);
      if (memberUserIds.length > 0) {
        const { data: profiles } = await admin
          .from('user_profiles')
          .select('id, email')
          .in('id', memberUserIds);

        const emailMap: Record<string, string> = {};
        for (const p of profiles ?? []) {
          if (p.email) emailMap[p.id] = p.email;
        }

        const payload = {
          type: 'system_announcement' as const,
          title: 'Organisation Deactivated',
          body: `Your organisation "${company.name}" has been deactivated by the platform. Please contact support for more information.`,
          action_url: '/login?notice=org-deactivated',
        };

        await notifyUsers({
          userIds: memberUserIds,
          payload,
          channel: 'both',
          emailMap,
          emailTemplate: {
            subject: `Organisation deactivated: ${company.name}`,
            html: `<p>Your organisation "<strong>${company.name}</strong>" has been deactivated by the platform.</p><p>Please contact support for more information.</p>`,
          },
          emailLogType: 'org_deactivated',
          emailEntityId: id,
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
        blocking: true,
      });

      // Notify all members (in-app + email)
      const { data: members } = await admin
        .from('company_members')
        .select('user_id')
        .is('deleted_at', null)
        .eq('company_id', id);

      const memberUserIds = (members ?? []).map(m => m.user_id);
      if (memberUserIds.length > 0) {
        const { data: profiles } = await admin
          .from('user_profiles')
          .select('id, email')
          .in('id', memberUserIds);

        const emailMap: Record<string, string> = {};
        for (const p of profiles ?? []) {
          if (p.email) emailMap[p.id] = p.email;
        }

        const payload = {
          type: 'system_announcement' as const,
          title: 'Organisation Reactivated',
          body: `Your organisation "${company.name}" has been reactivated and is now accessible.`,
          action_url: '/dashboard',
        };

        await notifyUsers({
          userIds: memberUserIds,
          payload,
          channel: 'both',
          emailMap,
          emailTemplate: {
            subject: `Organisation reactivated: ${company.name}`,
            html: `<p>Your organisation "<strong>${company.name}</strong>" has been reactivated and is now accessible on the platform.</p>`,
          },
          emailLogType: 'org_reactivated',
          emailEntityId: id,
        });
      }

      return Response.json({ data: { id, status: newStatus } });

    } else if (action === 'update_preferences') {
      const { preferences } = body as { preferences: Record<string, any> };

      const tableMap: Record<string, string> = {
        CAPITAL_PARTNER: 'capital_partners',
        TECHNICAL_PARTNER: 'technical_partners',
        POWER_TRADER: 'power_traders',
        CONSULTANT: 'consultants',
        GRANT_PROVIDER: 'grant_providers',
      };

      const table = tableMap[company.primary_role];
      if (!table) return badRequest('This organisation type does not have preferences');

      const { data, error: prefErr } = await admin
        .from(table)
        .upsert({ company_id: id, ...preferences }, { onConflict: 'company_id' })
        .select()
        .single();

      if (prefErr) {
        console.error('[Admin/Orgs] Preferences upsert error:', prefErr.message);
        return serverError();
      }

      await writeAuditLog({
        userId: user.id,
        action: 'ORG_PREFERENCES_UPDATED',
        entityType: table,
        entityId: id,
        after: preferences,
        req,
      });

      return Response.json({ data });

    } else if (action === 'remove_member') {
      const { userId } = body as { userId: string };
      if (!userId) return badRequest('userId is required');

      // Fetch member state before removal for audit
      const { data: memberBefore } = await admin
        .from('company_members')
        .select('role')
        .eq('company_id', id)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .single();

      const { error } = await admin
        .from('company_members')
        .update({ deleted_at: new Date().toISOString() })
        .eq('company_id', id)
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (error) return serverError();

      await writeAuditLog({
        userId: user.id,
        action: 'ORG_MEMBER_REMOVED',
        entityType: 'company_members',
        entityId: id,
        before: { role: memberBefore?.role ?? null },
        after: { removed_user_id: userId },
        req,
        blocking: true,
      });

      return Response.json({ data: { removed: true } });

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
    if (!user.is_platform_admin) return forbidden('Only platform administrators can manage this organisation. Contact your platform support team if you need to make changes.');

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

    // Soft-delete all projects + their documents (batched, not per-project)
    const { data: projects } = await admin
      .from('projects')
      .select('id')
      .is('deleted_at', null)
      .eq('developer_id', id);

    const projectIds = (projects ?? []).map((p: any) => p.id);
    if (projectIds.length > 0) {
      const now = new Date().toISOString();
      await Promise.all([
        admin.from('project_documents').update({ deleted_at: now }).in('project_id', projectIds).is('deleted_at', null),
        admin.from('projects').update({ deleted_at: now }).in('id', projectIds),
      ]);
    }

    // Delete partner preference rows (cascade)
    await admin.from('capital_partners').delete().eq('company_id', id);
    await admin.from('technical_partners').delete().eq('company_id', id);
    await admin.from('power_traders').delete().eq('company_id', id);
    await admin.from('consultants').delete().eq('company_id', id);
    await admin.from('grant_providers').delete().eq('company_id', id);

    // Audit log
    await writeAuditLog({
      userId: user.id,
      action: 'ORG_DELETED',
      entityType: 'companies',
      entityId: id,
      before: { name: company.name },
      after: { deleted_at: new Date().toISOString() },
      req,
      blocking: true,
    });

    // Notify all members (batched)
    const { data: members } = await admin
      .from('company_members')
      .select('user_id')
      .eq('company_id', id);

    const memberUserIds = (members ?? []).map((m: any) => m.user_id).filter(Boolean);
    if (memberUserIds.length > 0) {
      const notifications = memberUserIds.map((userId: string) => ({
        user_id: userId,
        type: 'system_announcement',
        title: 'Organisation Deleted',
        body: `Your organisation "${company.name}" has been removed from the platform.`,
        action_url: '/login',
      }));
      await admin.from('notifications').insert(notifications);
    }

    return Response.json({ data: { id, deleted: true } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
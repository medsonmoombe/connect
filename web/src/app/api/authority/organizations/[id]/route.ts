import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { badRequest, forbidden, getAuthenticatedUser, handleRouteError, serverError, writeAuditLog } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { canReviewProjects, isManagementUser } from '@/lib/admin-access';
import { sendOrgStatusEmail } from '@/lib/email';
import { createNotification, notificationBuilders } from '@/lib/notify';
import { verifyMfaCookie } from '@/lib/mfa-cookie';
import { triggerMatchingRuns } from '@/lib/matching-trigger';

type Params = { params: Promise<{ id: string }> };

const REGULATOR_ORG_DECISION_STATUSES = ['verified', 'needs_update', 'rejected'] as const;
type RegulatorOrgDecision = typeof REGULATOR_ORG_DECISION_STATUSES[number];

async function requireMfa(userId: string | null | undefined) {
  // When MFA is disabled platform-wide, regulators and platform admins must be
  // able to make review decisions without a step-up cookie — mirrors isMfaRequired().
  if (process.env.DISABLE_MFA === 'true') return true;
  if (!userId) return false;
  const cookieStore = await cookies();
  const value = cookieStore.get('mfa_verified')?.value;
  return !!value && await verifyMfaCookie(value, userId);
}

/** Fire-and-forget: recompute matches when a partner org is verified. */
async function triggerMatchingForPartner(partnerId: string, partnerType: string, req: NextRequest) {
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
    // Fire-and-forget â€” never block the decision over matching
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!isManagementUser(user)) return forbidden('Only platform and regulator management users can view organisation profiles.');

    const { id } = await params;
    const admin = getSupabaseAdmin();

    // Fetch ALL company fields â€” regulators need full registration data for review
    // Use '*' to avoid errors from columns that may not exist in the deployed DB
    const { data: company, error } = await admin
      .from('companies')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('[Authority/Organizations/id] Company fetch error:', error.message);
      return serverError();
    }
    if (!company) return Response.json({ error: 'Organisation not found' }, { status: 404 });

    // Fetch members (two-step: members then profiles, no FK join)
    const { data: memberRows } = await admin
      .from('company_members')
      .select('role, user_id, created_at')
      .eq('company_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    const userIds = (memberRows ?? []).map((m: any) => m.user_id);
    const { data: profiles } = userIds.length
      ? await admin.from('user_profiles').select('id, full_name, email, phone, job_title, suspended_at, created_at').in('id', userIds)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const members = (memberRows ?? []).map((m: any) => ({ ...m, user_profiles: profileMap.get(m.user_id) ?? null }));

    // Fetch projects (two-step: no FK join on scores)
    const { data: projectRows } = await admin
      .from('projects')
      .select('id, name, status, project_stage, project_size_mw, capital_required, technology_type, location_country, location_region, capital_structure_type, target_cod, target_financial_close_date, created_at, updated_at')
      .eq('developer_id', id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(100);

    const projectIds = (projectRows ?? []).map((p: any) => p.id);
    const { data: scoreRows, error: scoreErr } = projectIds.length
      ? await admin.from('project_scores').select('project_id, capital_readiness_score, technical_readiness_score, documentation_score, governance_score, financial_transparency_score, risk_flags, recommendations, summary, determined_stage, stage_rationale').in('project_id', projectIds)
      : { data: [], error: null };
    if (scoreErr) console.error('[Authority/Org/id] Score fetch error:', scoreErr.message);
    const scoreMap = new Map((scoreRows ?? []).map((s: any) => [s.project_id, s]));
    const projects = (projectRows ?? []).map((p: any) => ({ ...p, scores: scoreMap.get(p.id) ?? null }));

    // Fetch audit log for this org â€” try entity_id match, also catch company-level events
    const { data: auditLogs } = await admin
      .from('audit_logs')
      .select('id, action_type, entity_type, entity_id, timestamp, details, user_id')
      .eq('entity_type', 'COMPANY')
      .eq('entity_id', id)
      .order('timestamp', { ascending: false })
      .limit(20);

    // Also fetch member-related audit logs
    const memberUserIds = (memberRows ?? []).map((m: any) => m.user_id);
    const { data: memberAuditLogs } = memberUserIds.length
      ? await admin
          .from('audit_logs')
          .select('id, action_type, entity_type, entity_id, timestamp, details, user_id')
          .in('entity_id', memberUserIds)
          .order('timestamp', { ascending: false })
          .limit(20)
      : { data: [] };

    // Merge and deduplicate
    const allLogs = [...(auditLogs ?? []), ...(memberAuditLogs ?? [])];
    const seen = new Set<string>();
    const mergedLogs = allLogs
      .filter((l: any) => { if (seen.has(l.id)) return false; seen.add(l.id); return true; })
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);

    // Fetch pending invites for this org
    const { data: invites } = await admin
      .from('setup_invites')
      .select('id, email, token, expires_at, created_at, membership_role')
      .eq('company_id', id)
      .is('deleted_at', null)
      .is('used_at', null)
      .order('created_at', { ascending: false });

    const memberSummary = members.reduce((acc: Record<string, number>, m: any) => {
      acc[m.role] = (acc[m.role] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Regulators can make verification decisions on regular market organisations
    // (Admins + Reviewers). Platform/regulator orgs and deactivated orgs are excluded.
    const canDecide = canReviewProjects(user)
      && !!company && !company.is_platform_org && !company.is_authority_org
      && company.status !== 'deactivated';

    return Response.json({
      data: {
        company,
        members,
        memberSummary,
        memberCount: members.length,
        projects: projects ?? [],
        auditLogs: mergedLogs,
        pendingInvites: invites ?? [],
        canDecide,
      }
    });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!canReviewProjects(user)) {
      return forbidden('Only regulator admins and reviewers can make organisation review decisions.');
    }
    if (!await requireMfa(user.id)) {
      return Response.json({ error: 'MFA verification required for organisation review decisions.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const action = body.action as string;
    if (action !== 'update_status') return badRequest('Unsupported action.');

    const status = body.status as RegulatorOrgDecision;
    if (!REGULATOR_ORG_DECISION_STATUSES.includes(status)) {
      return badRequest(`status must be one of: ${REGULATOR_ORG_DECISION_STATUSES.join(', ')}`);
    }
    const note = (body.note as string)?.trim() || null;
    if ((status === 'needs_update' || status === 'rejected') && !note) {
      return badRequest('A reason is required when returning or rejecting an organisation.');
    }

    const admin = getSupabaseAdmin();
    const { data: company, error: fetchErr } = await admin
      .from('companies')
      .select('id, name, status, primary_role, is_platform_org, is_authority_org')
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (fetchErr || !company) return badRequest('Organisation not found');
    if (company.is_platform_org || company.is_authority_org) {
      return forbidden('The platform organisation and regulator organisations cannot be reviewed here.');
    }
    if (company.status === 'deactivated') {
      return badRequest('Deactivated organisations must be reactivated by platform administrators.');
    }

    const before = { status: company.status, name: company.name };
    const { error: updateErr } = await admin
      .from('companies')
      .update({ status, admin_note: note, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
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

    // Recompute matches when a partner org is verified (PRD Â§5.2)
    if (status === 'verified' && ['CAPITAL_PARTNER', 'TECHNICAL_PARTNER', 'CONSULTANT', 'GRANT_PROVIDER'].includes(company.primary_role)) {
      void triggerMatchingForPartner(id, company.primary_role, req);
    }

    // Notify OWNER + ADMIN members of the org (in-app + email)
    const { data: memberRows } = await admin
      .from('company_members')
      .select('role, user_id')
      .is('deleted_at', null)
      .eq('company_id', id)
      .in('role', ['OWNER', 'ADMIN']);

    const memberUserIds = (memberRows ?? []).map((m: any) => m.user_id);
    if (memberUserIds.length > 0) {
      const { data: profiles } = await admin
        .from('user_profiles')
        .select('id, email')
        .in('id', memberUserIds);

      const orgPayload = notificationBuilders.orgStatusChange({ orgName: company.name, status });
      await Promise.all([
        ...memberUserIds.map(uid => createNotification({ userId: uid, payload: orgPayload })),
        ...(profiles ?? []).filter(p => p.email).map(p =>
          sendOrgStatusEmail({ to: p.email!, orgName: company.name, status, note: note ?? undefined })
        ),
      ]);
    }

    return Response.json({ data: { id, status } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
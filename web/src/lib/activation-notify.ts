import { getSupabaseAdmin } from './supabase-server';
import { notifyUsers, notificationBuilders } from './notify';
import * as emailTemplates from './email-templates';

/**
 * Activate a pending_live project: transition to live, notify matched investors
 * and project owner admins. Idempotent — safe to call multiple times.
 */
export async function activateAndNotify(projectId: string): Promise<{ activated: boolean }> {
  const supabase = getSupabaseAdmin();

  // 1. Fetch project
  const { data: project, error: fetchErr } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .is('deleted_at', null)
    .single();

  if (fetchErr || !project) return { activated: false };
  if (project.status !== 'pending_live') return { activated: false };
  if (!project.scores_visible_at || new Date(project.scores_visible_at) > new Date()) return { activated: false };

  // 2. Transition to live
  const { error: updateErr } = await supabase
    .from('projects')
    .update({ status: 'live', is_visible_to_investors: true })
    .eq('id', projectId);

  if (updateErr) {
    console.error('[Activation] Failed to update status:', updateErr.message);
    return { activated: false };
  }

  // 3. Audit log
  await supabase.from('audit_logs').insert({
    user_id: null,
    action_type: 'PROJECT_ACTIVATED',
    entity_type: 'projects',
    entity_id: projectId,
    after_state: { status: 'live', is_visible_to_investors: true, activated_at: new Date().toISOString() },
  });

  // 4. Fire-and-forget: trigger matching engine
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  fetch(`${baseUrl}/api/matching/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId }),
  }).catch(() => {});

  // 5. Find matched investors
  const [capitalMatches, technicalMatches] = await Promise.all([
    supabase.from('capital_match_results')
      .select('capital_partner:capital_partners!inner(company_id)')
      .eq('project_id', projectId),
    supabase.from('technical_match_results')
      .select('technical_partner:technical_partners!inner(company_id)')
      .eq('project_id', projectId),
  ]);

  const partnerCompanyIds = new Set<string>();
  for (const m of capitalMatches.data ?? []) {
    const cid = (m.capital_partner as any)?.company_id;
    if (cid) partnerCompanyIds.add(cid);
  }
  for (const m of technicalMatches.data ?? []) {
    const cid = (m.technical_partner as any)?.company_id;
    if (cid) partnerCompanyIds.add(cid);
  }

  // 6. Notify matched investors (email only, no company details)
  if (partnerCompanyIds.size > 0) {
    const { data: investorMembers } = await supabase
      .from('company_members')
      .select('user_id')
      .in('company_id', [...partnerCompanyIds])
      .in('role', ['OWNER', 'ADMIN']);

    if (investorMembers?.length) {
      const investorIds = investorMembers.map(m => m.user_id);

      // Fetch emails separately (company_members.user_id -> auth.users -> user_profiles)
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, email')
        .in('id', investorIds);

      const investorEmailMap: Record<string, string> = {};
      for (const p of profiles ?? []) {
        if (p.email) investorEmailMap[p.id] = p.email;
      }

      const investorEmail = emailTemplates.projectLiveInvestorEmail({
        projectName: project.name,
        technologyType: project.technology_type,
        country: project.location_country,
        sizeMw: project.project_size_mw,
        capitalRequired: project.capital_required,
        projectStage: project.project_stage,
      });

      await notifyUsers({
        userIds: investorIds,
        payload: {
          type: 'match_found',
          title: `New project available: ${project.name}`,
          body: `A new ${project.technology_type.replace(/_/g, ' ').toLowerCase()} project in ${project.location_country} is now open for engagement.`,
          entity_type: 'projects',
          entity_id: projectId,
          action_url: '/dashboard/investor?tab=matches',
        },
        channel: 'both',
        emailMap: investorEmailMap,
        emailTemplate: investorEmail,
        emailLogType: 'project_live_investor',
        emailEntityId: projectId,
      });
    }
  }

  // 7. Notify project owner org admins (email + in-app)
  const { data: ownerMembers } = await supabase
    .from('company_members')
    .select('user_id')
    .eq('company_id', project.developer_id)
    .in('role', ['OWNER', 'ADMIN']);

  if (ownerMembers?.length) {
    const ownerIds = ownerMembers.map(m => m.user_id);

    const { data: ownerProfiles } = await supabase
      .from('user_profiles')
      .select('id, email')
      .in('id', ownerIds);

    const ownerEmailMap: Record<string, string> = {};
    for (const p of ownerProfiles ?? []) {
      if (p.email) ownerEmailMap[p.id] = p.email;
    }

    const ownerEmail = emailTemplates.projectLiveEmail({ projectName: project.name });
    const ownerNotification = notificationBuilders.projectLive({ projectName: project.name });

    await notifyUsers({
      userIds: ownerIds,
      payload: ownerNotification,
      channel: 'both',
      emailMap: ownerEmailMap,
      emailTemplate: ownerEmail,
      emailLogType: 'project_live_owner',
      emailEntityId: projectId,
    });
  }

  return { activated: true };
}

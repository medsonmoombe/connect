import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, badRequest, serverError, handleRouteError, writeAuditLog } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { calculateCapitalMatchScore, calculateTechnicalMatchScore } from '@/lib/scoring';
import { notifyUsers, notificationBuilders } from '@/lib/notify';
import * as emailTemplates from '@/lib/email-templates';
import type { Project, CapitalPartner, TechnicalPartner } from '@/types';

const BATCH_SIZE = 500;

export async function POST(req: NextRequest) {
  try {
    // Accept either an authenticated user OR an internal call using the service role key
    const authHeader = req.headers.get('authorization');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const isInternalCron = !!serviceKey && authHeader === `Bearer ${serviceKey}`;

    let user: any = null;
    if (!isInternalCron) {
      user = await getAuthenticatedUser(req);
    }

    const body = await req.json();
    const admin = getSupabaseAdmin();

    const { project_id, run_all, run_for_partner, _internal } = body as { project_id?: string; run_all?: boolean; run_for_partner?: boolean; _internal?: boolean };

    if (!project_id && !run_all && !run_for_partner) {
      return badRequest('Provide project_id, run_all: true, or run_for_partner: true');
    }

    if (run_all && !isInternalCron && !user?.is_platform_admin) {
      return forbidden();
    }

    // Capital partners can trigger matching for themselves via run_for_partner
    // run_all is admin/cron only

    // ── 1. Fetch projects ────────────────────────────────────────────────
    let projects: any[];
    let partnerFilter: string | null = null; // capital_partner id to scope matching

    if (run_for_partner) {
      // Capital partner runs matching for themselves against all live projects
      const { data: partnerRow } = await admin
        .from('capital_partners').select('id').eq('company_id', user.company_id).maybeSingle();
      if (!partnerRow) return badRequest('No capital partner profile found. Complete your preferences first.');
      partnerFilter = partnerRow.id;

      const { data, error } = await admin
        .from('projects').select('*').is('deleted_at', null)
        .eq('status', 'live').eq('is_visible_to_investors', true);
      if (error) return serverError();
      projects = data ?? [];
    } else if (run_all) {
      const { data, error } = await admin
        .from('projects')
        .select('*')
        .is('deleted_at', null)
        .eq('status', 'live')
        .eq('is_visible_to_investors', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Matching] Projects fetch error:', error.message);
        return serverError();
      }
      projects = data ?? [];
    } else {
      const { data, error } = await admin
        .from('projects')
        .select('*')
        .is('deleted_at', null)
        .eq('id', project_id)
        .single();

      if (error || !data) return badRequest('Project not found');
      projects = [data];

      if (!isInternalCron && !user?.is_platform_admin) {
        const isOwner = data.developer_id === user?.company_id;
        if (!isOwner) return forbidden();
        if (!data.is_visible_to_investors) {
          return badRequest('Matching can only be run on live visible projects.');
        }
      }
    }

    if (projects.length === 0) {
      return Response.json({ data: { matched: 0, projects: 0, capital_matches: 0, technical_matches: 0 } });
    }

    // ── 2. Fetch all partners (no joins — fetch companies separately) ────
    const [capitalRes, technicalRes, companiesRes] = await Promise.all([
      admin.from('capital_partners').select('*').not('company_id', 'is', null),
      admin.from('technical_partners').select('*').not('company_id', 'is', null),
      admin.from('companies').select('id, name, country, years_operating, is_new_company_with_experienced_team, management_team_experience').is('deleted_at', null),
    ]);

    if (capitalRes.error) {
      console.error('[Matching] Capital partners fetch error:', capitalRes.error.message);
      return serverError();
    }
    if (technicalRes.error) {
      console.error('[Matching] Technical partners fetch error:', technicalRes.error.message);
      return serverError();
    }

    const companyMap = new Map((companiesRes.data ?? []).map((c: any) => [c.id, c]));
    const capitalPartners = (capitalRes.data ?? []).map((p: any) => ({
      ...p,
      company: companyMap.get(p.company_id) ?? null,
    }));
    const technicalPartners = (technicalRes.data ?? []).map((p: any) => ({
      ...p,
      company: companyMap.get(p.company_id) ?? null,
    }));

    console.log(`[Matching] Projects: ${projects.length}, Capital partners: ${capitalPartners.length} (${capitalPartners.filter(p => p.company).length} with company), Technical partners: ${technicalPartners.length} (${technicalPartners.filter(p => p.company).length} with company)`);

    // ── 3. Fetch engagements for EPC bonus check ────────────────────────
    const projectIds = projects.map(p => p.id);
    const { data: engagements } = await admin
      .from('engagements')
      .select('project_id, counterparty_type, status')
      .in('project_id', projectIds);

    const ACCEPTED = ['INTRO_ACCEPTED', 'NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED'];
    const epcMap = new Map<string, boolean>();
    for (const e of engagements ?? []) {
      if (e.counterparty_type === 'TECHNICAL' && ACCEPTED.includes(e.status)) {
        epcMap.set(e.project_id, true);
      }
    }

    // ── 4. Compute matches ──────────────────────────────────────────────
    const capitalInserts: any[] = [];
    const technicalInserts: any[] = [];

    // ── Sector matching helpers ─────────────────────────────────────────
    // Maps any technology_type variant → canonical category used in partner sector_focus
    // This handles both onboarding values (SOLAR, WIND) and project DB values (SOLAR_PV,
    // ONSHORE_WIND, CONCENTRATED_SOLAR, etc.) by normalising both sides to the same set.
    const TECH_TO_CATEGORY: Record<string, string> = {
      // Solar variants
      SOLAR: 'SOLAR',
      SOLAR_PV: 'SOLAR',
      CONCENTRATED_SOLAR: 'SOLAR',
      CSP: 'SOLAR',
      // Wind variants
      WIND: 'WIND',
      ONSHORE_WIND: 'WIND',
      OFFSHORE_WIND: 'WIND',
      // Hydro variants
      HYDRO: 'HYDRO',
      RUN_OF_RIVER: 'HYDRO',
      LARGE_HYDRO: 'HYDRO',
      SMALL_HYDRO: 'HYDRO',
      // Storage variants
      STORAGE: 'STORAGE',
      BATTERY_STORAGE: 'STORAGE',
      PUMPED_HYDRO: 'STORAGE',
      // Other
      BIOMASS: 'BIOMASS',
      GEOTHERMAL: 'GEOTHERMAL',
      GRID_INFRA: 'GRID_INFRA',
    };

    // Adjacent categories (if partner covers one, they likely consider the other)
    const CATEGORY_ADJACENCIES: Record<string, string[]> = {
      SOLAR: ['STORAGE'],
      WIND: ['STORAGE'],
      STORAGE: ['SOLAR', 'WIND'],
      HYDRO: ['GEOTHERMAL', 'BIOMASS'],
      GEOTHERMAL: ['HYDRO'],
      BIOMASS: ['HYDRO'],
    };

    function hasSectorOverlap(projectTech: string, partnerSectors: string[]): boolean {
      if (!partnerSectors || partnerSectors.length === 0) return true; // no filter = match all
      const projectCategory = TECH_TO_CATEGORY[projectTech] ?? projectTech;
      // Normalise partner sectors to categories too
      const partnerCategories = partnerSectors.map(s => TECH_TO_CATEGORY[s] ?? s);
      if (partnerCategories.includes(projectCategory)) return true;
      // Check adjacencies
      const adjacents = CATEGORY_ADJACENCIES[projectCategory] ?? [];
      return adjacents.some(a => partnerCategories.includes(a));
    }

    for (const project of projects) {
      // When run_for_partner, only compute for the requesting partner
      const capitalPartnersToScore = partnerFilter
        ? capitalPartners.filter(p => p.id === partnerFilter)
        : capitalPartners;

      for (const partner of capitalPartnersToScore) {
        if (!partner.company) continue;
        if (!hasSectorOverlap(project.technology_type, partner.sector_focus ?? [])) continue;

        const hasAcceptedEPC = epcMap.get(project.id) ?? false;
        const result = calculateCapitalMatchScore(project as Project, partner as CapitalPartner, hasAcceptedEPC);
        capitalInserts.push({
          project_id: project.id,
          capital_partner_id: partner.id,
          compatibility_score: result.compatibility_score,
          score_breakdown: result.score_breakdown,
          status: 'active',
          calculated_at: new Date().toISOString(),
        });
      }

      // Skip technical matching when run_for_partner (capital partner only cares about capital matches)
      if (partnerFilter) continue;
      for (const partner of technicalPartners) {
        if (!partner.company) continue;
        if (!hasSectorOverlap(project.technology_type, partner.sector_experience ?? [])) continue;

        const result = calculateTechnicalMatchScore(project as Project, partner as TechnicalPartner);
        technicalInserts.push({
          project_id: project.id,
          technical_partner_id: partner.id,
          compatibility_score: result.compatibility_score,
          score_breakdown: result.score_breakdown,
          status: 'active',
          calculated_at: new Date().toISOString(),
        });
      }
    }

    // ── 5. Batch upsert to database ─────────────────────────────────────
    let capitalSaved = 0;
    let technicalSaved = 0;

    const runReason = run_all ? 'run_all' : run_for_partner ? 'run_for_partner' : 'single_project';
    const nowIso = new Date().toISOString();

    // 5a. Snapshot the PREVIOUS active scores for the pairs being recomputed
    // into match_results_history (PRD §5.2 — versioned scores). We only do
    // this for projects actually touched by this run to keep history bounded.
    const touchedProjectIds = Array.from(new Set(projects.map(p => p.id)));
    if (touchedProjectIds.length > 0) {
      const { data: priorCapital } = await admin
        .from('capital_match_results')
        .select('project_id, partner_id:capital_partner_id, compatibility_score, score_breakdown')
        .in('project_id', touchedProjectIds)
        .eq('status', 'active');
      const historyCapitalRows = (priorCapital ?? []).map((r: any) => ({
        project_id: r.project_id,
        partner_type: 'CAPITAL',
        partner_id: r.partner_id,
        compatibility_score: r.compatibility_score,
        score_breakdown: r.score_breakdown ?? {},
        run_reason: `pre-recompute:${runReason}`,
        created_at: nowIso,
      })).filter((r: any) => r.compatibility_score != null);

      const { data: priorTechnical } = !partnerFilter
        ? await admin
            .from('technical_match_results')
            .select('project_id, partner_id:technical_partner_id, compatibility_score, score_breakdown')
            .in('project_id', touchedProjectIds)
            .eq('status', 'active')
        : { data: [] } as any;
      const historyTechnicalRows = (priorTechnical ?? []).map((r: any) => ({
        project_id: r.project_id,
        partner_type: 'TECHNICAL',
        partner_id: r.partner_id,
        compatibility_score: r.compatibility_score,
        score_breakdown: r.score_breakdown ?? {},
        run_reason: `pre-recompute:${runReason}`,
        created_at: nowIso,
      })).filter((r: any) => r.compatibility_score != null);

      const allHistory = [...historyCapitalRows, ...historyTechnicalRows];
      if (allHistory.length > 0) {
        const { error: histErr } = await admin.from('match_results_history').insert(allHistory);
        if (histErr) console.error('[Matching] history snapshot error:', histErr.message);
      }
    }

    for (let i = 0; i < capitalInserts.length; i += BATCH_SIZE) {
      const batch = capitalInserts.slice(i, i + BATCH_SIZE);
      const { error } = await admin
        .from('capital_match_results')
        .upsert(batch, { onConflict: 'project_id,capital_partner_id', ignoreDuplicates: false });
      if (error) {
        console.error('[Matching] Capital batch upsert error:', error.message);
      } else {
        capitalSaved += batch.length;
      }
    }

    for (let i = 0; i < technicalInserts.length; i += BATCH_SIZE) {
      const batch = technicalInserts.slice(i, i + BATCH_SIZE);
      const { error } = await admin
        .from('technical_match_results')
        .upsert(batch, { onConflict: 'project_id,technical_partner_id', ignoreDuplicates: false });
      if (error) {
        console.error('[Matching] Technical batch upsert error:', error.message);
      } else {
        technicalSaved += batch.length;
      }
    }

    // 5b. Mark stale matches `inactive` (PRD §5.2): for the touched projects,
    // any previously-active pair NOT present in this run's (project,partner)
    // set is no longer a match. This is invalidated (set back to active) on the
    // next run that includes it via the upsert above (status:'active' is part
    // of every insert row).
    const computedCapitalPairs = new Set(capitalInserts.map(c => `${c.project_id}:${c.capital_partner_id}`));
    const computedTechnicalPairs = new Set(technicalInserts.map(t => `${t.project_id}:${t.technical_partner_id}`));

    if (touchedProjectIds.length > 0) {
      // Capital: fetch prior active rows for touched projects, then mark the
      // absent ones inactive. (Bulk update per project is simplest.)
      const { data: existingCapital } = await admin
        .from('capital_match_results')
        .select('id, project_id, capital_partner_id')
        .in('project_id', touchedProjectIds)
        .eq('status', 'active');
      const staleCapitalIds = (existingCapital ?? [])
        .filter((r: any) => !computedCapitalPairs.has(`${r.project_id}:${r.capital_partner_id}`))
        .map((r: any) => r.id);
      if (staleCapitalIds.length > 0) {
        const { error } = await admin.from('capital_match_results')
          .update({ status: 'inactive', calculated_at: nowIso })
          .in('id', staleCapitalIds);
        if (error) console.error('[Matching] capital stale-mark error:', error.message);
      }

      if (!partnerFilter) {
        const { data: existingTechnical } = await admin
          .from('technical_match_results')
          .select('id, project_id, technical_partner_id')
          .in('project_id', touchedProjectIds)
          .eq('status', 'active');
        const staleTechnicalIds = (existingTechnical ?? [])
          .filter((r: any) => !computedTechnicalPairs.has(`${r.project_id}:${r.technical_partner_id}`))
          .map((r: any) => r.id);
        if (staleTechnicalIds.length > 0) {
          const { error } = await admin.from('technical_match_results')
            .update({ status: 'inactive', calculated_at: nowIso })
            .in('id', staleTechnicalIds);
          if (error) console.error('[Matching] technical stale-mark error:', error.message);
        }
      }
    }


    // ── 6. Audit log ────────────────────────────────────────────────────
    await writeAuditLog({
      userId: user?.id ?? null,
      action: 'MATCHING_ENGINE_RUN',
      entityType: 'projects',
      entityId: run_all ? 'all' : projects[0].id,
      after: {
        projects: projects.length,
        capital_partners: capitalPartners.length,
        technical_partners: technicalPartners.length,
        capital_matches: capitalSaved,
        technical_matches: technicalSaved,
      },
      req,
    });

    // ── 7. Notify all parties about significant matches (score ≥ 60%) ───
    const SCORE_THRESHOLD = 60;
    const partnerNameMap = new Map<string, string>();
    // Map partner id → company_id for partner org lookup
    const capitalPartnerCompanyMap = new Map<string, string>(); // partner.id → company_id
    const technicalPartnerCompanyMap = new Map<string, string>();
    for (const p of capitalPartners) {
      if (p.company) { partnerNameMap.set(p.id, p.company.name); capitalPartnerCompanyMap.set(p.id, p.company_id); }
    }
    for (const p of technicalPartners) {
      if (p.company) { partnerNameMap.set(p.id, p.company.name); technicalPartnerCompanyMap.set(p.id, p.company_id); }
    }

    // Group high-score matches by project (for developer notifications)
    const highScoreByProject = new Map<string, { partnerName: string; score: number }[]>();
    // Group high-score matches by partner company (for partner notifications)
    // key: company_id, value: { projectName, developerName, score }
    const highScoreByPartnerCompany = new Map<string, { projectName: string; developerName: string; score: number }[]>();

    const projectMap = new Map(projects.map(p => [p.id, p]));
    const developerCompanyIds = [...new Set(projects.map(p => p.developer_id))];
    const { data: developerCompanies } = await admin.from('companies').select('id, name').in('id', developerCompanyIds);
    const developerNameMap = new Map((developerCompanies ?? []).map((c: any) => [c.id, c.name]));

    for (const m of capitalInserts) {
      if (m.compatibility_score < SCORE_THRESHOLD) continue;
      const pname = partnerNameMap.get(m.capital_partner_id) ?? 'A partner';
      const proj = projectMap.get(m.project_id);
      // developer side
      const arr = highScoreByProject.get(m.project_id) ?? [];
      arr.push({ partnerName: pname, score: m.compatibility_score });
      highScoreByProject.set(m.project_id, arr);
      // partner side
      const companyId = capitalPartnerCompanyMap.get(m.capital_partner_id);
      if (companyId && proj) {
        const parr = highScoreByPartnerCompany.get(companyId) ?? [];
        parr.push({ projectName: proj.name, developerName: developerNameMap.get(proj.developer_id) ?? 'A developer', score: m.compatibility_score });
        highScoreByPartnerCompany.set(companyId, parr);
      }
    }
    for (const m of technicalInserts) {
      if (m.compatibility_score < SCORE_THRESHOLD) continue;
      const pname = partnerNameMap.get(m.technical_partner_id) ?? 'A partner';
      const proj = projectMap.get(m.project_id);
      const arr = highScoreByProject.get(m.project_id) ?? [];
      arr.push({ partnerName: pname, score: m.compatibility_score });
      highScoreByProject.set(m.project_id, arr);
      const companyId = technicalPartnerCompanyMap.get(m.technical_partner_id);
      if (companyId && proj) {
        const parr = highScoreByPartnerCompany.get(companyId) ?? [];
        parr.push({ projectName: proj.name, developerName: developerNameMap.get(proj.developer_id) ?? 'A developer', score: m.compatibility_score });
        highScoreByPartnerCompany.set(companyId, parr);
      }
    }

    // Collect all company IDs that need notifications
    const allCompanyIds = [
      ...new Set([
        ...(highScoreByProject.size > 0 ? [...new Set(projects.filter(p => highScoreByProject.has(p.id)).map(p => p.developer_id))] : []),
        ...highScoreByPartnerCompany.keys(),
      ])
    ];

    if (allCompanyIds.length > 0) {
      const { data: memberRows } = await admin
        .from('company_members')
        .select('user_id, company_id')
        .in('company_id', allCompanyIds)
        .in('role', ['OWNER', 'ADMIN'])
        .is('deleted_at', null);

      const memberUserIds = (memberRows ?? []).map((r: any) => r.user_id);
      const { data: memberProfiles } = await admin
        .from('user_profiles')
        .select('id, email')
        .in('id', memberUserIds);
      const profileEmailMap = new Map((memberProfiles ?? []).map((p: any) => [p.id, p.email]));

      // Build email map and group members by company
      const emailMap: Record<string, string> = {};
      const membersByCompany = new Map<string, string[]>(); // company_id → user_ids
      for (const row of memberRows ?? []) {
        const uid = row.user_id;
        const email = profileEmailMap.get(uid);
        if (!uid || !email) continue;
        emailMap[uid] = email;
        const arr = membersByCompany.get(row.company_id) ?? [];
        arr.push(uid);
        membersByCompany.set(row.company_id, arr);
      }

      // Notify developer org admins
      for (const project of projects) {
        const matches = highScoreByProject.get(project.id);
        if (!matches || matches.length === 0) continue;
        const userIds = membersByCompany.get(project.developer_id) ?? [];
        if (userIds.length === 0) continue;
        matches.sort((a, b) => b.score - a.score);
        const top = matches[0];
        const partnerLabel = matches.length === 1
          ? top.partnerName
          : `${top.partnerName} +${matches.length - 1} other${matches.length > 2 ? 's' : ''}`;
        await notifyUsers({
          userIds,
          payload: notificationBuilders.matchFound({ projectName: project.name, partnerName: partnerLabel, score: top.score }),
          channel: 'both',
          emailMap,
          emailTemplate: emailTemplates.matchFoundEmail({ projectName: project.name, partnerName: partnerLabel, score: top.score, role: 'developer' }),
          emailLogType: 'match_found',
          emailEntityId: project.id,
        });
      }

      // Notify partner org admins
      for (const [companyId, matches] of highScoreByPartnerCompany) {
        const userIds = membersByCompany.get(companyId) ?? [];
        if (userIds.length === 0) continue;
        matches.sort((a, b) => b.score - a.score);
        const top = matches[0];
        await notifyUsers({
          userIds,
          payload: notificationBuilders.matchFound({ projectName: top.projectName, partnerName: top.developerName, score: top.score }),
          channel: 'both',
          emailMap,
          emailTemplate: emailTemplates.matchFoundEmail({ projectName: top.projectName, partnerName: top.developerName, score: top.score, role: 'partner' }),
          emailLogType: 'match_found',
          emailEntityId: companyId,
        });
      }
    }

    return Response.json({
      data: {
        matched: projects.length,
        projects: projects.length,
        capital_partners: capitalPartners.length,
        technical_partners: technicalPartners.length,
        capital_matches: capitalSaved,
        technical_matches: technicalSaved,
      },
    });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

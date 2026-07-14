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
    const user = await getAuthenticatedUser(req);
    const body = await req.json();
    const admin = getSupabaseAdmin();

    const { project_id, run_all } = body as { project_id?: string; run_all?: boolean };

    if (!project_id && !run_all) {
      return badRequest('Provide project_id (single project) or run_all: true');
    }

    if (run_all && !user.is_platform_admin) {
      return forbidden();
    }

    // ── 1. Fetch projects ────────────────────────────────────────────────
    let projects: any[];
    if (run_all) {
      const { data, error } = await admin
        .from('projects')
        .select('*')
        .is('deleted_at', null)
        .eq('status', 'submitted')
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

      if (!user.is_platform_admin) {
        const isOwner = data.developer_id === user.company_id;
        if (!isOwner) return forbidden();
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

    for (const project of projects) {
      for (const partner of capitalPartners) {
        if (!partner.company) continue;
        const hasAcceptedEPC = epcMap.get(project.id) ?? false;
        const result = calculateCapitalMatchScore(project as Project, partner as CapitalPartner, hasAcceptedEPC);
        capitalInserts.push({
          project_id: project.id,
          capital_partner_id: partner.id,
          compatibility_score: result.compatibility_score,
          score_breakdown: result.score_breakdown,
        });
      }

      for (const partner of technicalPartners) {
        if (!partner.company) continue;
        const result = calculateTechnicalMatchScore(project as Project, partner as TechnicalPartner);
        technicalInserts.push({
          project_id: project.id,
          technical_partner_id: partner.id,
          compatibility_score: result.compatibility_score,
          score_breakdown: result.score_breakdown,
          status: 'active',
        });
      }
    }

    // ── 5. Batch upsert to database ─────────────────────────────────────
    let capitalSaved = 0;
    let technicalSaved = 0;

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

    // ── 6. Audit log ────────────────────────────────────────────────────
    await writeAuditLog({
      userId: user.id,
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

    // ── 7. Notify project owners about significant matches (score ≥ 70%) ─
    const SCORE_THRESHOLD = 70;
    const partnerNameMap = new Map<string, string>();
    for (const p of capitalPartners) {
      if (p.company) partnerNameMap.set(p.id, p.company.name);
    }
    for (const p of technicalPartners) {
      if (p.company) partnerNameMap.set(p.id, p.company.name);
    }

    // Group high-score matches by project
    const highScoreByProject = new Map<string, { partnerName: string; score: number }[]>();
    for (const m of capitalInserts) {
      if (m.compatibility_score >= SCORE_THRESHOLD) {
        const pname = partnerNameMap.get(m.capital_partner_id) ?? 'A partner';
        const arr = highScoreByProject.get(m.project_id) ?? [];
        arr.push({ partnerName: pname, score: m.compatibility_score });
        highScoreByProject.set(m.project_id, arr);
      }
    }
    for (const m of technicalInserts) {
      if (m.compatibility_score >= SCORE_THRESHOLD) {
        const pname = partnerNameMap.get(m.technical_partner_id) ?? 'A partner';
        const arr = highScoreByProject.get(m.project_id) ?? [];
        arr.push({ partnerName: pname, score: m.compatibility_score });
        highScoreByProject.set(m.project_id, arr);
      }
    }

    if (highScoreByProject.size > 0) {
      // Look up developer org owners + emails
      const devIds = [...new Set(projects.filter(p => highScoreByProject.has(p.id)).map(p => p.developer_id))];
      const { data: ownerRows } = await admin
        .from('company_members')
        .select('user_id, company_id, users!inner(id, email, full_name)')
        .in('company_id', devIds)
        .in('role', ['OWNER', 'ADMIN'])
        .is('deleted_at', null);

      const projectMap = new Map(projects.map(p => [p.id, p]));
      const emailMap: Record<string, string> = {};

      for (const owner of ownerRows ?? []) {
        const u = owner.users as any;
        if (!u?.id || !u?.email) continue;
        emailMap[u.id] = u.email;

        // Find projects owned by this user's company that have high-score matches
        for (const project of projects) {
          if (project.developer_id !== owner.company_id) continue;
          const matches = highScoreByProject.get(project.id);
          if (!matches || matches.length === 0) continue;

          matches.sort((a, b) => b.score - a.score);
          const top = matches[0];
          const partnerLabel = matches.length === 1
            ? top.partnerName
            : `${top.partnerName} +${matches.length - 1} other${matches.length > 2 ? 's' : ''}`;

          const payload = notificationBuilders.matchFound({
            projectName: project.name,
            partnerName: partnerLabel,
            score: top.score,
          });
          const emailT = emailTemplates.matchFoundEmail({
            projectName: project.name,
            partnerName: partnerLabel,
            score: top.score,
            role: 'developer',
          });

          await notifyUsers({
            userIds: [u.id],
            payload,
            channel: 'both',
            emailMap,
            emailTemplate: emailT,
            emailLogType: 'match_found',
            emailEntityId: project.id,
          });
        }
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

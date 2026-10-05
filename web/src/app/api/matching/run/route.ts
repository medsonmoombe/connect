import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, badRequest, handleRouteError, writeAuditLog } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  calculateProfessionalCapitalMatchScore,
  calculateProfessionalTechnicalMatchScore,
  calculateProfessionalConsultantMatchScore,
  calculateProfessionalPowerTraderMatchScore,
} from '@/lib/matching-engine';
import { notifyUsers, notificationBuilders } from '@/lib/notify';
import * as emailTemplates from '@/lib/email-templates';
import { isPartnerAllowedAtStage } from '@/lib/partner-candidates';
import { recordMatchingRun } from '@/lib/matching-trigger';
import { bumpFamily } from '@/lib/api-cache';
import type { Project, CapitalPartner, TechnicalPartner, ConsultantProfile, PowerTrader } from '@/types';

const BATCH_SIZE = 500;
const FETCH_BATCH_SIZE = 1000;

/**
 * Paginated fetch Ã¢â‚¬â€ avoids unbounded Supabase queries that load entire tables
 * into memory. Fetches in chunks of `FETCH_BATCH_SIZE` using range offsets.
 */
async function fetchAllPaginated(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  columns: string,
  filters: Array<{ column: string; op: string; value: any }>,
  opts?: { notNull?: string[] }
): Promise<any[]> {
  const rows: any[] = [];
  let offset = 0;
  for (;;) {
    let query = supabase.from(table).select(columns).range(offset, offset + FETCH_BATCH_SIZE - 1);
    for (const f of filters) {
      if (f.op === 'is') query = query.is(f.column, f.value);
      else if (f.op === 'eq') query = query.eq(f.column, f.value);
      else if (f.op === 'neq') query = query.neq(f.column, f.value);
      else if (f.op === 'not') query = query.not(f.column, 'is', f.value);
    }
    if (opts?.notNull) {
      for (const col of opts.notNull) query = query.not(col, 'is', null);
    }
    const { data, error } = await query;
    if (error) throw new Error(`[Matching] Paginated fetch error on ${table}: ${error.message}`);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < FETCH_BATCH_SIZE) break;
    offset += FETCH_BATCH_SIZE;
  }
  return rows;
}

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

    const { project_id, run_all, run_for_partner, partner_id, partner_type, _internal } = body as {
      project_id?: string;
      run_all?: boolean;
      run_for_partner?: boolean;
      /** Explicit partner id (used by admin/internal callers via service role key). */
      partner_id?: string;
      /** 'capital_partners' | 'technical_partners' Ã¢â‚¬â€ required when partner_id is set. */
      partner_type?: string;
      _internal?: boolean;
    };

    if (!project_id && !run_all && !run_for_partner && !partner_id) {
      return badRequest('Provide project_id, run_all: true, run_for_partner: true, or partner_id + partner_type');
    }

    if (run_all && !isInternalCron && !user?.is_platform_admin) {
      return forbidden('Only platform administrators can run matching for all projects. Contact your platform support team if you need to run global matching.');
    }

    // Capital partners can trigger matching for themselves via run_for_partner
    // run_all is admin/cron only

    // Ã¢â€â‚¬Ã¢â€â‚¬ 1. Fetch projects Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    let projects: any[];
    let partnerFilter: string | null = null; // partner id to scope matching
    let partnerFilterType: string | null = null; // 'capital' | 'technical' | 'consultant' | 'trader'
    let secondaryPartnerId: string | null = null;
    let secondaryPartnerType: string | null = null;

    if (run_for_partner) {
      // Partner runs matching for themselves against all live projects.
      // Check capital_partners, technical_partners, and consultants tables to
      // support all three roles (a company may hold multiple profiles).
      const { data: capRow } = await admin
        .from('capital_partners').select('id').eq('company_id', user.company_id).maybeSingle();
      const { data: techRow } = await admin
        .from('technical_partners').select('id').eq('company_id', user.company_id).maybeSingle();
      const { data: consultantRow } = await admin
        .from('consultants').select('id').eq('company_id', user.company_id).maybeSingle();
      const { data: traderRow } = await admin
        .from('power_traders').select('id').eq('company_id', user.company_id).maybeSingle();

      // Also check grant_providers Ã¢â‚¬â€ grant partners are scored as capital partners
      const { data: grantRow } = !capRow
        ? await admin.from('grant_providers').select('id').eq('company_id', user.company_id).maybeSingle()
        : { data: null };

      // Treat grant_providers as capital partners: find their capital_partners row
      // (created during onboarding) or fall back to running the full capital matrix
      // so their matches get computed even without an explicit capital_partners row.
      const effectiveCapRow = capRow ?? (grantRow ? { id: null, _isGrant: true } : null);

      const capOnly = effectiveCapRow && !techRow;
      if (effectiveCapRow && techRow) {
        if (capRow) {
          partnerFilter = capRow.id;
          partnerFilterType = 'capital';
        }
        // if grant-only (no capRow.id), run full matrix below (partnerFilter stays null)
        secondaryPartnerId = techRow.id;
        secondaryPartnerType = 'technical';
      } else if (effectiveCapRow && consultantRow) {
        if (capRow) {
          partnerFilter = capRow.id;
          partnerFilterType = 'capital';
        }
        secondaryPartnerId = consultantRow.id;
        secondaryPartnerType = 'consultant';
      } else if (techRow && consultantRow) {
        partnerFilter = techRow.id;
        partnerFilterType = 'technical';
        secondaryPartnerId = consultantRow.id;
        secondaryPartnerType = 'consultant';
      } else if (capOnly && capRow) {
        partnerFilter = capRow.id;
        partnerFilterType = 'capital';
      } else if (capOnly && grantRow) {
        // Grant provider with no capital_partners row Ã¢â‚¬â€ run full capital matrix
        // so all capital partners (including this grant company) get scored.
        // partnerFilter stays null Ã¢â€ â€™ full matrix run scoped to live projects.
      } else if (techRow) {
        partnerFilter = techRow.id;
        partnerFilterType = 'technical';
      } else if (consultantRow) {
        partnerFilter = consultantRow.id;
        partnerFilterType = 'consultant';
      } else if (traderRow) {
        partnerFilter = traderRow.id;
        partnerFilterType = 'trader';
      } else {
        return badRequest('No partner profile found. Complete your partner preferences first.');
      }

      projects = await fetchAllPaginated(admin, 'projects', '*', [
        { column: 'deleted_at', op: 'is', value: null },
        { column: 'status', op: 'eq', value: 'live' },
        { column: 'is_visible_to_investors', op: 'eq', value: true },
      ]);
    } else if (partner_id && partner_type) {
      // Explicit partner scope (used by admin/internal callers).
      partnerFilter = partner_id;
      partnerFilterType =
        partner_type === 'technical_partners' ? 'technical'
        : partner_type === 'consultants' ? 'consultant'
        : partner_type === 'power_traders' ? 'trader'
        : 'capital';

      projects = await fetchAllPaginated(admin, 'projects', '*', [
        { column: 'deleted_at', op: 'is', value: null },
        { column: 'status', op: 'eq', value: 'live' },
        { column: 'is_visible_to_investors', op: 'eq', value: true },
      ]);
    } else if (run_all) {
      projects = await fetchAllPaginated(admin, 'projects', '*', [
        { column: 'deleted_at', op: 'is', value: null },
        { column: 'status', op: 'eq', value: 'live' },
        { column: 'is_visible_to_investors', op: 'eq', value: true },
      ]);
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
        if (!isOwner) return forbidden('Only the project owner can run matching for this project.');
        if (!data.is_visible_to_investors) {
          return badRequest('Matching can only be run on live visible projects.');
        }
      }
    }

    if (projects.length === 0) {
      return Response.json({ data: { matched: 0, projects: 0, capital_matches: 0, technical_matches: 0, consultant_matches: 0, trader_matches: 0 } });
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ 2. Fetch all partners (paginated Ã¢â‚¬â€ avoids unbounded queries) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const [capitalPartnersRaw, technicalPartnersRaw, consultantsRaw, powerTradersRaw, grantProvidersRaw, companies] = await Promise.all([
      fetchAllPaginated(admin, 'capital_partners', '*', [], { notNull: ['company_id'] }),
      fetchAllPaginated(admin, 'technical_partners', '*', [], { notNull: ['company_id'] }),
      fetchAllPaginated(admin, 'consultants', '*', [], { notNull: ['company_id'] }),
      fetchAllPaginated(admin, 'power_traders', '*', [], { notNull: ['company_id'] }),
      fetchAllPaginated(admin, 'grant_providers', 'id, company_id, focus_sectors, geographic_focus, min_grant_size, max_grant_size, grant_types', [], { notNull: ['company_id'] }),
      fetchAllPaginated(
        admin, 'companies',
        'id, name, country, status, years_operating, is_new_company_with_experienced_team, management_team_experience',
        [{ column: 'deleted_at', op: 'is', value: null }],
      ),
    ]);

    const companyMap = new Map(companies.map((c: any) => [c.id, c]));

    // Ã¢â€â‚¬Ã¢â€â‚¬ PRD Ã‚Â§5.1: Eligibility Ã¢â‚¬â€ only verified organisations can be matched Ã¢â€â‚¬Ã¢â€â‚¬
    const verifiedCompanyIds = new Set(
      companies
        .filter((c: any) => c.status === 'verified')
        .map((c: any) => c.id)
    );

    // Convert grant_providers into synthetic capital_partners entries so they
    // flow through the existing capital matching algorithm. Grant providers
    // accept GRANT structure, have no strict ticket size, and match all sectors.
    const grantAsCapital = grantProvidersRaw
      .filter((g: any) => verifiedCompanyIds.has(g.company_id))
      .map((g: any) => ({
        id: `grant:${g.id}`,          // synthetic id Ã¢â‚¬â€ prefixed to avoid collisions
        _grant_provider_id: g.id,     // original grant_providers.id
        company_id: g.company_id,
        preferred_capital_structure: ['GRANT'],
        sector_focus: g.focus_sectors ?? [],
        geographic_focus: g.geographic_focus ?? [],
        min_ticket_size: g.min_grant_size ?? 0,
        max_ticket_size: g.max_grant_size ?? 0,
        risk_tolerance: 'HIGH',
        governance_preference: 'PASSIVE',
        preferred_project_stage: null,
        company: companyMap.get(g.company_id) ?? null,
      }));

    // Scope: if run_for_partner was triggered by a grant provider, only score that grant provider
    if (run_for_partner && !partnerFilter) {
      const { data: grantRow } = await admin
        .from('grant_providers').select('id').eq('company_id', user.company_id).maybeSingle();
      if (grantRow) {
        const syntheticId = `grant:${grantRow.id}`;
        partnerFilter = syntheticId;
        partnerFilterType = 'capital';
      }
    }

    const capitalPartners = [
      ...capitalPartnersRaw
        .filter((p: any) => verifiedCompanyIds.has(p.company_id))
        .map((p: any) => ({ ...p, company: companyMap.get(p.company_id) ?? null })),
      ...grantAsCapital,
    ];
    const technicalPartners = technicalPartnersRaw
      .filter((p: any) => verifiedCompanyIds.has(p.company_id))
      .map((p: any) => ({
        ...p,
        company: companyMap.get(p.company_id) ?? null,
      }));
    const consultants = consultantsRaw
      .filter((p: any) => verifiedCompanyIds.has(p.company_id))
      .map((p: any) => ({
        ...p,
        company: companyMap.get(p.company_id) ?? null,
      }));
    const powerTraders = powerTradersRaw
      .filter((p: any) => verifiedCompanyIds.has(p.company_id))
      .map((p: any) => ({
        ...p,
        company: companyMap.get(p.company_id) ?? null,
      }));

    // Also filter projects whose developer org is not verified (PRD Ã‚Â§5.1)
    projects = projects.filter(p => verifiedCompanyIds.has(p.developer_id));

    // console.log(`[Matching] Projects: ${projects.length}, Capital partners: ${capitalPartners.length} (verified), Technical partners: ${technicalPartners.length} (verified), Consultants: ${consultants.length} (verified), Power traders: ${powerTraders.length} (verified)`);

    // Ã¢â€â‚¬Ã¢â€â‚¬ 3. Fetch engagements for EPC bonus check Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

    // Feedback loop: projects repeatedly turned down by partners rank slightly lower
    // for future partners (mild, capped penalty - never a block).
    const DECLINED_STATUSES = ['DROPPED', 'WITHDRAWN', 'REJECTED', 'DECLINED', 'INTRO_DECLINED', 'NDA_REJECTED'];
    const declinePenaltyMap = new Map<string, number>();
    for (const e of engagements ?? []) {
      if (DECLINED_STATUSES.includes(e.status)) {
        declinePenaltyMap.set(e.project_id, Math.min(15, (declinePenaltyMap.get(e.project_id) ?? 0) + 5));
      }
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ 4. Compute matches Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const capitalInserts: any[] = [];
    const technicalInserts: any[] = [];
    const consultantInserts: any[] = [];
    const traderInserts: any[] = [];

    // Ã¢â€â‚¬Ã¢â€â‚¬ Sector matching helpers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    // Maps any technology_type variant Ã¢â€ â€™ canonical category used in partner sector_focus
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

    /**
     * PRD Ã‚Â§5.1: Currency / country match.
     * For MVP (Zambia focus), both parties must operate in the same country.
     * Falls back to allowing the match when either value is missing (legacy data).
     */
    function hasCountryMatch(projectCountry: string, partnerCompanyCountry: string | undefined): boolean {
      if (!partnerCompanyCountry) return true; // legacy Ã¢â‚¬â€ no country set = assume compatible
      // Normalize for MVP: treat 'Zambia' and 'Zambia' the same
      return projectCountry.toLowerCase() === partnerCompanyCountry.toLowerCase();
    }

    for (const project of projects) {
      // When a partner is scoped, only compute matches FOR that partner type
      if (partnerFilter) {
        if (partnerFilterType === 'consultant') {
          // Consultant partner-scoped: compute consultant matches only
          const partner = consultants.find(p => p.id === partnerFilter);
          if (!partner) {
            // // console.log(`[Matching] SKIP scoped consultant ${partnerFilter}: partner not found or not verified`);)
          } else if (!partner.company) {
            // console.log(`[Matching] SKIP scoped consultant ${partner.id?.slice(0,8)} for project ${project.id?.slice(0,8)}: no company`);
          } else if (!hasSectorOverlap(project.technology_type, partner.sector_experience ?? [])) {
            // console.log(`[Matching] SKIP scoped consultant ${partner.id?.slice(0,8)} for project ${project.id?.slice(0,8)}: sector mismatch project=${project.technology_type} consultant=${JSON.stringify(partner.sector_experience)}`);
          } else if (!hasCountryMatch(project.location_country, partner.company.country)) {
            // console.log(`[Matching] SKIP scoped consultant ${partner.id?.slice(0,8)} for project ${project.id?.slice(0,8)}: country mismatch project=${project.location_country} consultant=${partner.company.country}`);
          } else if (!isPartnerAllowedAtStage(project.project_stage, 'CONSULTANT', partner, partner.company?.name)) {
            // console.log(`[Matching] SKIP scoped consultant ${partner.id?.slice(0,8)} for project ${project.id?.slice(0,8)}: not allowed at stage=${project.project_stage}`);
          } else {
            const result = calculateProfessionalConsultantMatchScore(project as Project, partner as ConsultantProfile, { declinePenalty: declinePenaltyMap.get(project.id) ?? 0 });
            // console.log(`[Matching] MATCH scoped consultant ${partner.id?.slice(0,8)} for project ${project.id?.slice(0,8)}: score=${result.compatibility_score}, company=${partner.company?.name}`);
            consultantInserts.push({
              project_id: project.id,
              consultant_id: partner.id,
              compatibility_score: result.compatibility_score,
              score_breakdown: result.score_breakdown,
              status: 'active',
              calculated_at: new Date().toISOString(),
            });
          }
        } else if (partnerFilterType === 'technical') {
          // Technical partner-scoped: compute technical matches only
          const partner = technicalPartners.find(p => p.id === partnerFilter);
          if (partner?.company
            && hasSectorOverlap(project.technology_type, partner.sector_experience ?? [])
            && hasCountryMatch(project.location_country, partner.company.country)
            && isPartnerAllowedAtStage(project.project_stage, 'TECHNICAL', partner, partner.company?.name)) {
            const result = calculateProfessionalTechnicalMatchScore(project as Project, partner as TechnicalPartner, { declinePenalty: declinePenaltyMap.get(project.id) ?? 0 });
            technicalInserts.push({
              project_id: project.id,
              technical_partner_id: partner.id,
              compatibility_score: result.compatibility_score,
              score_breakdown: result.score_breakdown,
              status: 'active',
              calculated_at: new Date().toISOString(),
            });
          }
        } else {
          // Capital partner-scoped: compute capital matches only
          const partner = capitalPartners.find(p => p.id === partnerFilter);
          if (partner?.company
            && hasSectorOverlap(project.technology_type, partner.sector_focus ?? [])
            && hasCountryMatch(project.location_country, partner.company.country)
            && isPartnerAllowedAtStage(project.project_stage, 'CAPITAL', partner, partner.company?.name)) {
            const hasAcceptedEPC = epcMap.get(project.id) ?? false;
            const result = calculateProfessionalCapitalMatchScore(project as Project, partner as CapitalPartner, { hasAcceptedEPC, declinePenalty: declinePenaltyMap.get(project.id) ?? 0 });
            // For grant providers (synthetic id), store under _grant_provider_id
            // in a separate grant_match_results table; for real capital partners
            // use capital_match_results as normal.
            if (partner._grant_provider_id) {
              capitalInserts.push({
                project_id: project.id,
                grant_provider_id: partner._grant_provider_id,
                compatibility_score: result.compatibility_score,
                score_breakdown: result.score_breakdown,
                status: 'active',
                calculated_at: new Date().toISOString(),
                _isGrant: true,
              });
            } else {
              capitalInserts.push({
                project_id: project.id,
                capital_partner_id: partner.id,
                compatibility_score: result.compatibility_score,
                score_breakdown: result.score_breakdown,
                status: 'active',
                calculated_at: new Date().toISOString(),
              });
            }
          }
        }
      } else {
        // No partner scope: compute ALL matches (full matrix)
        for (const partner of capitalPartners) {
          if (!partner.company) continue;
          if (!hasSectorOverlap(project.technology_type, partner.sector_focus ?? [])) continue;
          if (!hasCountryMatch(project.location_country, partner.company.country)) continue;
          if (!isPartnerAllowedAtStage(project.project_stage, 'CAPITAL', partner, partner.company?.name)) continue;

          const hasAcceptedEPC = epcMap.get(project.id) ?? false;
          const result = calculateProfessionalCapitalMatchScore(project as Project, partner as CapitalPartner, { hasAcceptedEPC, declinePenalty: declinePenaltyMap.get(project.id) ?? 0 });
          if (partner._grant_provider_id) {
            capitalInserts.push({
              project_id: project.id,
              grant_provider_id: partner._grant_provider_id,
              compatibility_score: result.compatibility_score,
              score_breakdown: result.score_breakdown,
              status: 'active',
              calculated_at: new Date().toISOString(),
              _isGrant: true,
            });
          } else {
            capitalInserts.push({
              project_id: project.id,
              capital_partner_id: partner.id,
              compatibility_score: result.compatibility_score,
              score_breakdown: result.score_breakdown,
              status: 'active',
              calculated_at: new Date().toISOString(),
            });
          }
        }

        for (const partner of technicalPartners) {
          if (!partner.company) continue;
          if (!hasSectorOverlap(project.technology_type, partner.sector_experience ?? [])) continue;
          if (!hasCountryMatch(project.location_country, partner.company.country)) continue;
          if (!isPartnerAllowedAtStage(project.project_stage, 'TECHNICAL', partner, partner.company?.name)) continue;

          const result = calculateProfessionalTechnicalMatchScore(project as Project, partner as TechnicalPartner, { declinePenalty: declinePenaltyMap.get(project.id) ?? 0 });
          // console.log(`[Matching] MATCH tech ${partner.id?.slice(0,8)}: score=${result.compatibility_score}`);
          technicalInserts.push({
            project_id: project.id,
            technical_partner_id: partner.id,
            compatibility_score: result.compatibility_score,
            score_breakdown: result.score_breakdown,
            status: 'active',
            calculated_at: new Date().toISOString(),
          });
        }
      for (const partner of consultants) {
          if (!partner.company) continue;
          if (!hasSectorOverlap(project.technology_type, partner.sector_experience ?? [])) continue;
          if (!hasCountryMatch(project.location_country, partner.company.country)) continue;
          if (!isPartnerAllowedAtStage(project.project_stage, 'CONSULTANT', partner, partner.company?.name)) continue;

          const result = calculateProfessionalConsultantMatchScore(project as Project, partner as ConsultantProfile, { declinePenalty: declinePenaltyMap.get(project.id) ?? 0 });
          // console.log(`[Matching] MATCH consultant ${partner.id?.slice(0,8)} for project ${project.id?.slice(0,8)}: score=${result.compatibility_score}, company=${partner.company?.name}`);
          consultantInserts.push({
            project_id: project.id,
            consultant_id: partner.id,
            compatibility_score: result.compatibility_score,
            score_breakdown: result.score_breakdown,
            status: 'active',
            calculated_at: new Date().toISOString(),
          });
        }

        for (const partner of powerTraders) {
          if (!partner.company) continue;
          if (!hasSectorOverlap(project.technology_type, partner.preferred_technology_types ?? [])) continue;
          if (!hasCountryMatch(project.location_country, partner.company.country)) continue;
          if (!isPartnerAllowedAtStage(project.project_stage, 'POWER_TRADER', partner, partner.company?.name)) continue;
          const result = calculateProfessionalPowerTraderMatchScore(project as Project, partner as PowerTrader, { declinePenalty: declinePenaltyMap.get(project.id) ?? 0 });
          traderInserts.push({
            project_id: project.id,
            power_trader_id: partner.id,
            compatibility_score: result.compatibility_score,
            score_breakdown: result.score_breakdown,
            status: 'active',
            calculated_at: new Date().toISOString(),
          });
        }
      }
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ 4b. Secondary partner matching (dual-profile companies) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    // When a company has both capital and technical profiles, the main loop
    // only computed one type. Now compute matches for the secondary partner.
    if (secondaryPartnerId && secondaryPartnerType === 'technical') {
      const partner = technicalPartners.find(p => p.id === secondaryPartnerId);
      if (partner?.company) {
        for (const project of projects) {
          if (!hasSectorOverlap(project.technology_type, partner.sector_experience ?? [])) continue;
          if (!hasCountryMatch(project.location_country, partner.company.country)) continue;
          if (!isPartnerAllowedAtStage(project.project_stage, 'TECHNICAL', partner, partner.company?.name)) continue;
          const result = calculateProfessionalTechnicalMatchScore(project as Project, partner as TechnicalPartner, { declinePenalty: declinePenaltyMap.get(project.id) ?? 0 });
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
    }

    if (secondaryPartnerId && secondaryPartnerType === 'consultant') {
      const partner = consultants.find(p => p.id === secondaryPartnerId);
      if (partner?.company) {
        for (const project of projects) {
          if (!hasSectorOverlap(project.technology_type, partner.sector_experience ?? [])) continue;
          if (!hasCountryMatch(project.location_country, partner.company.country)) continue;
          if (!isPartnerAllowedAtStage(project.project_stage, 'CONSULTANT', partner, partner.company?.name)) continue;
          const result = calculateProfessionalConsultantMatchScore(project as Project, partner as ConsultantProfile, { declinePenalty: declinePenaltyMap.get(project.id) ?? 0 });
          consultantInserts.push({
            project_id: project.id,
            consultant_id: partner.id,
            compatibility_score: result.compatibility_score,
            score_breakdown: result.score_breakdown,
            status: 'active',
            calculated_at: new Date().toISOString(),
          });
        }
      }
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ 5. Batch upsert to database Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    let capitalSaved = 0;
    let technicalSaved = 0;
    let consultantSaved = 0;
    let traderSaved = 0;

    const runReason = run_all ? 'run_all' : run_for_partner ? 'run_for_partner' : 'single_project';
    const nowIso = new Date().toISOString();

    // 5a. Snapshot the PREVIOUS active scores for the pairs being recomputed
    // into match_results_history (PRD Ã‚Â§5.2 Ã¢â‚¬â€ versioned scores). We only do
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

      const { data: priorConsultant } = !partnerFilter
        ? await admin
            .from('consultant_match_results')
            .select('project_id, partner_id:consultant_id, compatibility_score, score_breakdown')
            .in('project_id', touchedProjectIds)
            .eq('status', 'active')
        : { data: [] } as any;
      const historyConsultantRows = (priorConsultant ?? []).map((r: any) => ({
        project_id: r.project_id,
        partner_type: 'CONSULTANT',
        partner_id: r.partner_id,
        compatibility_score: r.compatibility_score,
        score_breakdown: r.score_breakdown ?? {},
        run_reason: `pre-recompute:${runReason}`,
        created_at: nowIso,
      })).filter((r: any) => r.compatibility_score != null);

      const allHistory = [...historyCapitalRows, ...historyTechnicalRows, ...historyConsultantRows];
      if (allHistory.length > 0) {
        const { error: histErr } = await admin.from('match_results_history').insert(allHistory);
        if (histErr) console.error('[Matching] history snapshot error:', histErr.message);
      }
    }

    // Split capital inserts into real capital partners vs grant providers
    const realCapitalInserts = capitalInserts.filter((c: any) => !c._isGrant).map(({ _isGrant, ...r }: any) => r);
    const grantInserts = capitalInserts.filter((c: any) => c._isGrant).map(({ _isGrant, ...r }: any) => r);

    for (let i = 0; i < realCapitalInserts.length; i += BATCH_SIZE) {
      const batch = realCapitalInserts.slice(i, i + BATCH_SIZE);
      const { error } = await admin
        .from('capital_match_results')
        .upsert(batch, { onConflict: 'project_id,capital_partner_id', ignoreDuplicates: false });
      if (error) {
        console.error('[Matching] Capital batch upsert error:', error.message);
      } else {
        capitalSaved += batch.length;
      }
    }

    for (let i = 0; i < grantInserts.length; i += BATCH_SIZE) {
      const batch = grantInserts.slice(i, i + BATCH_SIZE);
      const { error } = await admin
        .from('grant_match_results')
        .upsert(batch, { onConflict: 'project_id,grant_provider_id', ignoreDuplicates: false });
      if (error) {
        // Table may not exist yet Ã¢â‚¬â€ log but don't fail the whole run
        console.error('[Matching] Grant batch upsert error:', error.message);
      } else {
        capitalSaved += batch.length;
        // // console.log(`[Matching] Saved grant match batch: ${batch.length}`);)
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

    for (let i = 0; i < consultantInserts.length; i += BATCH_SIZE) {
      const batch = consultantInserts.slice(i, i + BATCH_SIZE);
      const { error } = await admin
        .from('consultant_match_results')
        .upsert(batch, { onConflict: 'project_id,consultant_id', ignoreDuplicates: false });
      if (error) {
        console.error('[Matching] Consultant batch upsert error:', error.message);
      } else {
        consultantSaved += batch.length;
        // // console.log(`[Matching] Saved consultant match batch: ${batch.length}`);)
      }
    }

    for (let i = 0; i < traderInserts.length; i += BATCH_SIZE) {
      const batch = traderInserts.slice(i, i + BATCH_SIZE);
      const { error } = await admin
        .from('power_trader_match_results')
        .upsert(batch, { onConflict: 'project_id,power_trader_id', ignoreDuplicates: false });
      if (error) {
        console.error('[Matching] Power Trader batch upsert error:', error.message);
      } else {
        traderSaved += batch.length;
        // // console.log(`[Matching] Saved power trader match batch: ${batch.length}`);)
      }
    }

    // 5b. Mark stale matches `inactive` (PRD Ã‚Â§5.2): for the touched projects,
    // any previously-active pair NOT present in this run's (project,partner)
    // set is no longer a match. This is invalidated (set back to active) on the
    // next run that includes it via the upsert above (status:'active' is part
    // of every insert row).
    const computedCapitalPairs = new Set(realCapitalInserts.map((c: any) => `${c.project_id}:${c.capital_partner_id}`));
    const computedGrantPairs = new Set(grantInserts.map((g: any) => `${g.project_id}:${g.grant_provider_id}`));
    const computedTechnicalPairs = new Set(technicalInserts.map(t => `${t.project_id}:${t.technical_partner_id}`));
    const computedConsultantPairs = new Set(consultantInserts.map(t => `${t.project_id}:${t.consultant_id}`));
    const computedTraderPairs = new Set(traderInserts.map(t => `${t.project_id}:${t.power_trader_id}`));

    if (touchedProjectIds.length > 0) {
      // Capital: only stale-mark when running a capital-scoped or full run.
      // A technical-only run should not touch capital match results.
      if (!partnerFilter || partnerFilterType === 'capital') {
        let capitalStaleQuery = admin
          .from('capital_match_results')
          .select('id, project_id, capital_partner_id')
          .in('project_id', touchedProjectIds)
          .eq('status', 'active');
        if (partnerFilter && partnerFilterType === 'capital' && !partnerFilter.startsWith('grant:')) {
          capitalStaleQuery = capitalStaleQuery.eq('capital_partner_id', partnerFilter);
        }
        const { data: existingCapital } = await capitalStaleQuery;
        const staleCapitalIds = (existingCapital ?? [])
          .filter((r: any) => !computedCapitalPairs.has(`${r.project_id}:${r.capital_partner_id}`))
          .map((r: any) => r.id);
        if (staleCapitalIds.length > 0) {
          const { error } = await admin.from('capital_match_results')
            .update({ status: 'inactive', calculated_at: nowIso })
            .in('id', staleCapitalIds);
          if (error) console.error('[Matching] capital stale-mark error:', error.message);
        }

        // Stale-mark grant matches too
        const grantProviderId = partnerFilter?.startsWith('grant:')
          ? partnerFilter.replace('grant:', '')
          : null;
        let grantStaleQuery = admin
          .from('grant_match_results')
          .select('id, project_id, grant_provider_id')
          .in('project_id', touchedProjectIds)
          .eq('status', 'active');
        if (grantProviderId) grantStaleQuery = grantStaleQuery.eq('grant_provider_id', grantProviderId);
        const { data: existingGrant } = await grantStaleQuery;
        const staleGrantIds = (existingGrant ?? [])
          .filter((r: any) => !computedGrantPairs.has(`${r.project_id}:${r.grant_provider_id}`))
          .map((r: any) => r.id);
        if (staleGrantIds.length > 0) {
          const { error } = await admin.from('grant_match_results')
            .update({ status: 'inactive', calculated_at: nowIso })
            .in('id', staleGrantIds);
          if (error) console.error('[Matching] grant stale-mark error:', error.message);
        }
      }

      if (!partnerFilter || partnerFilterType === 'technical') {
        let technicalStaleQuery = admin
          .from('technical_match_results')
          .select('id, project_id, technical_partner_id')
          .in('project_id', touchedProjectIds)
          .eq('status', 'active');
        if (partnerFilter && partnerFilterType === 'technical') {
          technicalStaleQuery = technicalStaleQuery.eq('technical_partner_id', partnerFilter);
        }
        const { data: existingTechnical } = await technicalStaleQuery;
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

      if (!partnerFilter || partnerFilterType === 'consultant') {
        let consultantStaleQuery = admin
          .from('consultant_match_results')
          .select('id, project_id, consultant_id')
          .in('project_id', touchedProjectIds)
          .eq('status', 'active');
        if (partnerFilter && partnerFilterType === 'consultant') {
          consultantStaleQuery = consultantStaleQuery.eq('consultant_id', partnerFilter);
        }
        const { data: existingConsultant } = await consultantStaleQuery;
        const staleConsultantIds = (existingConsultant ?? [])
          .filter((r: any) => !computedConsultantPairs.has(`${r.project_id}:${r.consultant_id}`))
          .map((r: any) => r.id);
        if (staleConsultantIds.length > 0) {
          const { error } = await admin.from('consultant_match_results')
            .update({ status: 'inactive', calculated_at: nowIso })
            .in('id', staleConsultantIds);
          if (error) console.error('[Matching] consultant stale-mark error:', error.message);
        }
      }

      if (!partnerFilter || partnerFilterType === 'trader') {
        let traderStaleQuery = admin
          .from('power_trader_match_results')
          .select('id, project_id, power_trader_id')
          .in('project_id', touchedProjectIds)
          .eq('status', 'active');
        if (partnerFilter && partnerFilterType === 'trader') {
          traderStaleQuery = traderStaleQuery.eq('power_trader_id', partnerFilter);
        }
        const { data: existingTrader } = await traderStaleQuery;
        const staleTraderIds = (existingTrader ?? [])
          .filter((r: any) => !computedTraderPairs.has(`${r.project_id}:${r.power_trader_id}`))
          .map((r: any) => r.id);
        if (staleTraderIds.length > 0) {
          const { error } = await admin.from('power_trader_match_results')
            .update({ status: 'inactive', calculated_at: nowIso })
            .in('id', staleTraderIds);
          if (error) console.error('[Matching] power trader stale-mark error:', error.message);
        }
      }
    }


    // Invalidate cached marketplace/dashboard list responses - the scores and
    // active-match sets they embed just changed.
    await bumpFamily('projects');

    // Ã¢â€â‚¬Ã¢â€â‚¬ 6. Audit log Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    await writeAuditLog({
      userId: user?.id ?? null,
      action: 'MATCHING_ENGINE_RUN',
      entityType: 'projects',
      entityId: run_all ? 'all' : projects[0].id,
      after: {
        projects: projects.length,
        capital_partners: capitalPartners.length,
        technical_partners: technicalPartners.length,
        consultants: consultants.length,
        power_traders: powerTraders.length,
        capital_matches: capitalSaved,
        technical_matches: technicalSaved,
        consultant_matches: consultantSaved,
        trader_matches: traderSaved,
      },
      req,
    });

    // Ã¢â€â‚¬Ã¢â€â‚¬ 7. Notify all parties about significant matches (score Ã¢â€°Â¥ 60%) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const SCORE_THRESHOLD = 60;
    const partnerNameMap = new Map<string, string>();
    // Map partner id Ã¢â€ â€™ company_id for partner org lookup
    const capitalPartnerCompanyMap = new Map<string, string>(); // partner.id Ã¢â€ â€™ company_id
    const technicalPartnerCompanyMap = new Map<string, string>();
    const consultantCompanyMap = new Map<string, string>();
    const traderCompanyMap = new Map<string, string>();
    for (const p of capitalPartners) {
      if (p.company) { partnerNameMap.set(p.id, p.company.name); capitalPartnerCompanyMap.set(p.id, p.company_id); }
    }
    for (const p of technicalPartners) {
      if (p.company) { partnerNameMap.set(p.id, p.company.name); technicalPartnerCompanyMap.set(p.id, p.company_id); }
    }
    for (const p of consultants) {
      if (p.company) { partnerNameMap.set(p.id, p.company.name); consultantCompanyMap.set(p.id, p.company_id); }
    }
    for (const p of powerTraders) {
      if (p.company) { partnerNameMap.set(p.id, p.company.name); traderCompanyMap.set(p.id, p.company_id); }
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

    for (const m of realCapitalInserts) {
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
    for (const m of consultantInserts) {
      if (m.compatibility_score < SCORE_THRESHOLD) continue;
      const pname = partnerNameMap.get(m.consultant_id) ?? 'A consultant';
      const proj = projectMap.get(m.project_id);
      const arr = highScoreByProject.get(m.project_id) ?? [];
      arr.push({ partnerName: pname, score: m.compatibility_score });
      highScoreByProject.set(m.project_id, arr);
      const companyId = consultantCompanyMap.get(m.consultant_id);
      if (companyId && proj) {
        const parr = highScoreByPartnerCompany.get(companyId) ?? [];
        parr.push({ projectName: proj.name, developerName: developerNameMap.get(proj.developer_id) ?? 'A developer', score: m.compatibility_score });
        highScoreByPartnerCompany.set(companyId, parr);
      }
    }
    for (const m of traderInserts) {
      if (m.compatibility_score < SCORE_THRESHOLD) continue;
      const pname = partnerNameMap.get(m.power_trader_id) ?? 'A power trader';
      const proj = projectMap.get(m.project_id);
      const arr = highScoreByProject.get(m.project_id) ?? [];
      arr.push({ partnerName: pname, score: m.compatibility_score });
      highScoreByProject.set(m.project_id, arr);
      const companyId = traderCompanyMap.get(m.power_trader_id);
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
      const membersByCompany = new Map<string, string[]>(); // company_id Ã¢â€ â€™ user_ids
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

    // Observability: record the run outcome (scope + counts + trigger source).
    await recordMatchingRun(admin, {
      scope: partnerFilter ? 'partner' : run_all ? 'all' : 'project',
      status: 'success',
      projectId: (run_all || partnerFilter) ? null : (capitalInserts[0]?.project_id ?? projects[0]?.id ?? null),
      scopeRef: partnerFilter ?? null,
      triggeredBy: user?.id ?? null,
      matchedProjects: projects.length,
      capitalMatches: capitalSaved,
      technicalMatches: technicalSaved,
      consultantMatches: consultantSaved,
      traderMatches: traderSaved,
    });

    return Response.json({
      data: {
        matched: projects.length,
        projects: projects.length,
        capital_partners: capitalPartners.length,
        technical_partners: technicalPartners.length,
        consultants: consultants.length,
        power_traders: powerTraders.length,
        capital_matches: capitalSaved,
        technical_matches: technicalSaved,
        consultant_matches: consultantSaved,
        trader_matches: traderSaved,
      },
    });
  } catch (e: any) {
    try {
      await recordMatchingRun(getSupabaseAdmin(), {
        scope: 'all',
        status: 'error',
        error: e?.message ?? String(e),
      });
    } catch { /* best-effort logging */ }
    return handleRouteError(e);
  }
}




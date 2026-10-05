/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * matching-preview.ts â€” Computes live capital/technical/consultant match
 * candidates for a project WITHOUT persisting anything. Used by the
 * project-creation readiness preview so a developer can see (and contact)
 * recommended partner profiles before the project is submitted. Mirrors the
 * eligibility and scoring rules in /api/matching/run so preview matches agree
 * with real matches.
 */

import {
  calculateProfessionalCapitalMatchScore,
  calculateProfessionalTechnicalMatchScore,
  calculateProfessionalConsultantMatchScore,
  calculateProfessionalPowerTraderMatchScore,
} from '@/lib/matching-engine';
import type { Project, CapitalPartner, TechnicalPartner, ConsultantProfile, PowerTrader } from '@/types';

/** Normalise any technology_type variant â†’ canonical category used in partner sector_focus. */
const TECH_TO_CATEGORY: Record<string, string> = {
  SOLAR: 'SOLAR', SOLAR_PV: 'SOLAR', CONCENTRATED_SOLAR: 'SOLAR', CSP: 'SOLAR', PHOTOVOLTAIC: 'SOLAR',
  WIND: 'WIND', ONSHORE_WIND: 'WIND', OFFSHORE_WIND: 'WIND',
  HYDRO: 'HYDRO', RUN_OF_RIVER: 'HYDRO', LARGE_HYDRO: 'HYDRO', SMALL_HYDRO: 'HYDRO',
  STORAGE: 'STORAGE', BATTERY_STORAGE: 'STORAGE', PUMPED_HYDRO: 'STORAGE', LITHIUM_ION: 'STORAGE', VANADIUM_FLOW: 'STORAGE',
  BIOMASS: 'BIOMASS', GEOTHERMAL: 'GEOTHERMAL', GRID_INFRA: 'GRID_INFRA',
};

const CATEGORY_ADJACENCIES: Record<string, string[]> = {
  SOLAR: ['STORAGE'], WIND: ['STORAGE'], STORAGE: ['SOLAR', 'WIND'],
  HYDRO: ['GEOTHERMAL', 'BIOMASS'], GEOTHERMAL: ['HYDRO'], BIOMASS: ['HYDRO'],
};

export function hasSectorOverlap(projectTech: string, partnerSectors: string[]): boolean {
  if (!partnerSectors || partnerSectors.length === 0) return true;
  const projectCategory = TECH_TO_CATEGORY[projectTech] ?? projectTech;
  const partnerCategories = partnerSectors.map(s => TECH_TO_CATEGORY[s] ?? s);
  if (partnerCategories.includes(projectCategory)) return true;
  const adjacents = CATEGORY_ADJACENCIES[projectCategory] ?? [];
  return adjacents.some(a => partnerCategories.includes(a));
}

export function hasCountryMatch(projectCountry: string, partnerCompanyCountry: string | undefined): boolean {
  if (!partnerCompanyCountry) return true;
  return projectCountry.toLowerCase() === partnerCompanyCountry.toLowerCase();
}

/**
 * Compute preview match candidates for a single project (no persistence).
 * Only verified partner companies are eligible (PRD Â§5.1).
 */
export async function computePreviewMatches(
  supabase: any,
  project: Project
): Promise<{ capital: any[]; technical: any[]; consultant: any[]; trader: any[] }> {
  const [companies, capitalPartnersRaw, technicalPartnersRaw, consultantsRaw, powerTradersRaw] = await Promise.all([
    supabase
      .from('companies')
      .select('id, name, country, status')
      .is('deleted_at', null),
    supabase
      .from('capital_partners')
      .select('*')
      .not('company_id', 'is', null),
    supabase
      .from('technical_partners')
      .select('*')
      .not('company_id', 'is', null),
    supabase
      .from('consultants')
      .select('*')
      .not('company_id', 'is', null),
    supabase
      .from('power_traders')
      .select('*')
      .not('company_id', 'is', null),
  ]);

  const companyMap = new Map((companies?.data ?? []).map((c: any) => [c.id, c]));
  const verifiedCompanyIds = new Set(
    (companies?.data ?? []).filter((c: any) => c.status === 'verified').map((c: any) => c.id)
  );

  const capitalPartners = (capitalPartnersRaw?.data ?? [])
    .filter((p: any) => verifiedCompanyIds.has(p.company_id))
    .map((p: any) => ({ ...p, company: companyMap.get(p.company_id) ?? null }));

  const technicalPartners = (technicalPartnersRaw?.data ?? [])
    .filter((p: any) => verifiedCompanyIds.has(p.company_id))
    .map((p: any) => ({ ...p, company: companyMap.get(p.company_id) ?? null }));

  const consultants = (consultantsRaw?.data ?? [])
    .filter((p: any) => verifiedCompanyIds.has(p.company_id))
    .map((p: any) => ({ ...p, company: companyMap.get(p.company_id) ?? null }));

  const powerTraders = (powerTradersRaw?.data ?? [])
    .filter((p: any) => verifiedCompanyIds.has(p.company_id))
    .map((p: any) => ({ ...p, company: companyMap.get(p.company_id) ?? null }));

  const capital: any[] = [];
  const technical: any[] = [];
  const consultant: any[] = [];
  const trader: any[] = [];

  for (const partner of capitalPartners) {
    if (!partner.company) continue;
    if (!hasSectorOverlap(project.technology_type, partner.sector_focus ?? [])) continue;
    if (!hasCountryMatch(project.location_country, partner.company.country)) continue;
    const result = calculateProfessionalCapitalMatchScore(project as Project, partner as CapitalPartner, { hasAcceptedEPC: false });
    capital.push({
      capital_partner_id: partner.id,
      compatibility_score: result.compatibility_score,
      score_breakdown: result.score_breakdown,
      capital_partner: partner,
    });
  }

  for (const partner of technicalPartners) {
    if (!partner.company) continue;
    if (!hasSectorOverlap(project.technology_type, partner.sector_experience ?? [])) continue;
    if (!hasCountryMatch(project.location_country, partner.company.country)) continue;
    const result = calculateProfessionalTechnicalMatchScore(project as Project, partner as TechnicalPartner);
    technical.push({
      technical_partner_id: partner.id,
      compatibility_score: result.compatibility_score,
      score_breakdown: result.score_breakdown,
      technical_partner: partner,
    });
  }

  for (const partner of consultants) {
    if (!partner.company) continue;
    if (!hasSectorOverlap(project.technology_type, partner.sector_experience ?? [])) continue;
    if (!hasCountryMatch(project.location_country, partner.company.country)) continue;
    const result = calculateProfessionalConsultantMatchScore(project as Project, partner as ConsultantProfile);
    consultant.push({
      consultant_id: partner.id,
      compatibility_score: result.compatibility_score,
      score_breakdown: result.score_breakdown,
      consultant: partner,
    });
  }


  for (const partner of powerTraders) {
    if (!partner.company) continue;
    if (!hasSectorOverlap(project.technology_type, partner.preferred_technology_types ?? [])) continue;
    if (!hasCountryMatch(project.location_country, partner.company.country)) continue;
    const result = calculateProfessionalPowerTraderMatchScore(project as Project, partner as PowerTrader);
    trader.push({
      power_trader_id: partner.id,
      compatibility_score: result.compatibility_score,
      score_breakdown: result.score_breakdown,
      power_trader: partner,
    });
  }
  return { capital, technical, consultant, trader };
}




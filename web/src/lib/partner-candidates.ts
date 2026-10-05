/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * partner-candidates.ts â€” Shared helpers for converting matching-engine results
 * into display candidates and matching them to gap recommendations.
 *
 * Used by both the Find Partners page (FindPartnersEngine) and the Gaps page
 * (GapResolutionTracker) so the "profile recommended on the gap" logic is
 * identical everywhere.
 */

import { isPartnerTypeAllowedAtStage } from './project-stages';

export type MatchType = 'CAPITAL' | 'TECHNICAL' | 'CONSULTANT' | 'POWER_TRADER';

export interface PartnerCandidate {
  id: string;
  type: MatchType;
  score: number;
  companyName: string;
  capabilityLine: string;
  regionLine: string;
  raw: any;
  reasons: string[];
}

/** Map a gap recommendation's partnerType label to a general partner category. */
const GAP_PARTNER_CATEGORY: Record<string, string> = {
  'Technical Consultant': 'Consultant',
  'Financial Consultant': 'Consultant',
  'Environmental Consultant': 'Consultant',
  'Engineering Consultant': 'Consultant',
  'Legal Advisor': 'Consultant',
  'Investment Advisor': 'Consultant',
  'Carbon Finance Specialist': 'Consultant',
  'EPC Contractor': 'EPC',
  'Commercial Bank / DFI': 'Financial',
  'Infrastructure Fund': 'Financial',
  'Development Partner': 'Grant Provider',
  'Power Trader': 'Power Trader',
  'Offtaker': 'Power Trader',
};

function extractReasons(breakdown: any, fallback?: string): string[] {
  const details = Object.values(breakdown || {})
    .map((value: any) => (typeof value?.detail === 'string' ? value.detail : null))
    .filter(Boolean) as string[];
  return details.length ? details : fallback ? [fallback] : [];
}

export function toCapitalCandidate(match: any): PartnerCandidate | null {
  const partner = match.capital_partner;
  const company = partner?.company;
  const id = match.capital_partner_id || partner?.id;
  if (!id) return null;
  return {
    id,
    type: 'CAPITAL',
    score: match.compatibility_score ?? 0,
    companyName: company?.name || 'Capital Partner',
    capabilityLine:
      [
        partner?.preferred_capital_structure?.slice?.(0, 2)?.join(', '),
        partner?.risk_tolerance && `${partner.risk_tolerance} risk`,
      ]
        .filter(Boolean)
        .join(' | ') || 'Capital provider',
    regionLine:
      partner?.geographic_focus?.slice?.(0, 2)?.join(', ') ||
      company?.country ||
      'Geography not set',
    raw: match,
    reasons: extractReasons(match.score_breakdown, match.match_reason),
  };
}

export function toTechnicalCandidate(match: any): PartnerCandidate | null {
  const partner = match.technical_partner;
  const company = partner?.company;
  const id = match.technical_partner_id || partner?.id;
  if (!id) return null;
  return {
    id,
    type: 'TECHNICAL',
    score: match.compatibility_score ?? 0,
    companyName: company?.name || 'Technical Partner',
    capabilityLine:
      partner?.service_categories?.slice?.(0, 3)?.join(', ')?.replace(/_/g, ' ') ||
      'Technical services',
    regionLine:
      partner?.regions_operated?.slice?.(0, 2)?.join(', ') ||
      company?.country ||
      'Geography not set',
    raw: match,
    reasons: extractReasons(match.score_breakdown, match.match_reason),
  };
}

export function toConsultantCandidate(match: any): PartnerCandidate | null {
  const partner = match.consultant;
  const company = partner?.company;
  const id = match.consultant_id || partner?.id;
  if (!id) return null;
  return {
    id,
    type: 'CONSULTANT',
    score: match.compatibility_score ?? 0,
    companyName: company?.name || 'Consultant',
    capabilityLine:
      partner?.service_categories?.slice?.(0, 3)?.join(', ')?.replace(/_/g, ' ') ||
      'Consulting services',
    regionLine:
      partner?.regions_operated?.slice?.(0, 2)?.join(', ') ||
      company?.country ||
      'Geography not set',
    raw: match,
    reasons: extractReasons(match.score_breakdown, match.match_reason),
  };
}


export function toPowerTraderCandidate(match: any): PartnerCandidate | null {
  const partner = match.power_trader;
  const company = partner?.company;
  const id = match.power_trader_id || partner?.id;
  if (!id) return null;
  return {
    id,
    type: 'POWER_TRADER',
    score: match.compatibility_score ?? 0,
    companyName: company?.name || 'Power Trader',
    capabilityLine:
      [
        partner?.license_type,
        partner?.max_offtake_capacity_mw && `${partner.max_offtake_capacity_mw} MW offtake`,
      ]
        .filter(Boolean)
        .join(' | ') || 'Offtake partner',
    regionLine:
      partner?.regions_of_interest?.slice?.(0, 2)?.join(', ') ||
      company?.country ||
      'Geography not set',
    raw: match,
    reasons: extractReasons(match.score_breakdown, match.match_reason),
  };
}
/** Whether a candidate fits a general partner type label (e.g. 'Consultant', 'Financial'). */
export function candidateMatchesPartnerType(
  candidate: PartnerCandidate,
  counterpartyType: string,
  partnerTypeLabel: string
): boolean {
  const partner =
    candidate.type === 'CAPITAL'
      ? candidate.raw?.capital_partner
      : candidate.type === 'CONSULTANT'
        ? candidate.raw?.consultant
        : candidate.type === 'POWER_TRADER'
          ? candidate.raw?.power_trader
          : candidate.raw?.technical_partner;
  const services = partner?.service_categories ?? [];
  const structures = partner?.preferred_capital_structure ?? [];
  const haystack = [candidate.companyName, ...services, ...structures]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

  if (counterpartyType === 'CAPITAL') {
    if (partnerTypeLabel === 'Grant Provider') return haystack.includes('GRANT');
    if (partnerTypeLabel === 'Financial') return !haystack.includes('GRANT');
    return true;
  }

  if (counterpartyType === 'CONSULTANT') return true;
  if (counterpartyType === 'POWER_TRADER') return partnerTypeLabel === 'Power Trader' || partnerTypeLabel === 'Offtaker';

  if (partnerTypeLabel === 'Consultant') {
    return !/(EPC|O&M|O_AND_M|OPERATOR|CONSTRUCTION)/.test(haystack);
  }
  if (partnerTypeLabel === 'EPC') {
    return /(EPC|CONSTRUCTION)/.test(haystack) && !/(O&M|O_AND_M)/.test(haystack);
  }
  if (partnerTypeLabel === 'OAM') {
    return /(O&M|O_AND_M|OPERATOR)/.test(haystack);
  }
  return true;
}

/**
 * Classify a raw partner row into the coarse partner category used by
 * stage gating (Consultant / EPC / O&M / Financial / Grant Provider).
 */
export function classifyPartnerCategory(
  counterpartyType: MatchType,
  partner: any,
  companyName?: string | null,
): string {
  const label = companyName ?? '';
  if (counterpartyType === 'CAPITAL') {
    const structures = partner?.preferred_capital_structure ?? [];
    const haystack = [label, ...structures].join(' ').toUpperCase();
    if (haystack.includes('GRANT')) return 'Grant Provider';
    return 'Infrastructure Fund';
  }
  if (counterpartyType === 'CONSULTANT') return 'Consultant';
  if (counterpartyType === 'POWER_TRADER') return 'Power Trader';
  const services = partner?.service_categories ?? [];
  const haystack = [label, ...services].join(' ').toUpperCase();
  if (haystack.includes('O&M') || haystack.includes('O_AND_M') || haystack.includes('OPERATOR'))
    return 'O&M';
  if (haystack.includes('EPC') || haystack.includes('CONSTRUCTION')) return 'EPC Contractor';
  if (haystack.includes('GRANT')) return 'Development Partner';
  return 'Technical Consultant';
}

/**
 * Whether a raw partner row (capital or technical) is allowed to be matched
 * to a project at the given stage. This is the single source of truth used by
 * both the matching engine and the display helpers.
 */
export function isPartnerAllowedAtStage(
  stage: string | null | undefined,
  counterpartyType: MatchType,
  partner: any,
  companyName?: string | null,
): boolean {
  if (!stage) return true;
  const category = classifyPartnerCategory(counterpartyType, partner, companyName);
  return isPartnerTypeAllowedAtStage(stage, category);
}

/** Whether a candidate of the given counterparty type is allowed at the stage. */
export function isCandidateAllowedAtStage(
  stage: string | null | undefined,
  candidate: PartnerCandidate,
  counterpartyType: string
) {
  if (!stage) return true;
  const partner = candidate.raw?.capital_partner ?? candidate.raw?.technical_partner ?? candidate.raw?.consultant ?? candidate.raw?.power_trader;
  return isPartnerAllowedAtStage(stage, counterpartyType as MatchType, partner, candidate.companyName);
}

/**
 * Return the top candidate profiles recommended to fill a specific gap.
 * The gap's `recommendation` (partnerType + counterpartyType) drives the pool
 * and the partner-type filter; the project's stage gates the candidates.
 */
export function matchCandidatesForGap(
  gap: any,
  capitalMatches: any[],
  technicalMatches: any[],
  stage?: string | null,
  limit = 3,
  consultantMatches: any[] = [],
  traderMatches: any[] = []
): PartnerCandidate[] {
  const counterpartyType = gap?.recommendation?.counterpartyType;
  const convert =
    counterpartyType === 'CAPITAL'
      ? toCapitalCandidate
      : counterpartyType === 'CONSULTANT'
        ? toConsultantCandidate
        : counterpartyType === 'POWER_TRADER'
          ? toPowerTraderCandidate
          : toTechnicalCandidate;
  const pool =
    counterpartyType === 'CAPITAL'
      ? capitalMatches
      : counterpartyType === 'CONSULTANT'
        ? consultantMatches
        : counterpartyType === 'POWER_TRADER'
          ? traderMatches
          : technicalMatches;
  const candidates = (pool ?? []).map(convert).filter(Boolean) as PartnerCandidate[];

  const rawType = String(gap?.recommendation?.partnerType || '');
  const category = GAP_PARTNER_CATEGORY[rawType] ?? (rawType || '');

  return candidates
    .filter((c) => candidateMatchesPartnerType(c, counterpartyType, category))
    .filter((c) => isCandidateAllowedAtStage(stage, c, counterpartyType))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}




/**
 * Count EVERY candidate that would be recommended for a gap at the current
 * stage (no limit), so the UI can show "N consultants found" on the collapsed
 * card before the developer opens the list to engage.
 */
export function countCandidatesForGap(
  gap: any,
  capitalMatches: any[],
  technicalMatches: any[],
  stage?: string | null,
  consultantMatches: any[] = [],
  traderMatches: any[] = []
): number {
  return matchCandidatesForGap(
    gap,
    capitalMatches,
    technicalMatches,
    stage,
    Number.MAX_SAFE_INTEGER,
    consultantMatches,
    traderMatches,
  ).length;
}
/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  CapitalMatchResult,
  CapitalPartner,
  ConsultantMatchResult,
  ConsultantProfile,
  Project,
  TechnicalMatchResult,
  TechnicalPartner,
  PowerTrader,
} from '@/types';
import { isPartnerTypeAllowedAtStage, STAGE_BY_VALUE } from './project-stages';
import { stageBand } from './scoring/engine';

/**
 * Normalise a sub-score onto 0â€“100 **relative to its own maximum**.
 *
 * project_scores columns hold values from two scoring models: the evidence
 * engine (regulatory pillar max 20) and the legacy LLM model (max 40). Comparing
 * a 0â€“20 value against a 75 threshold silently classified every
 * evidence-scored project as high-risk â€” match quality depended on which
 * engine produced the row. Always scale by the max the row was measured with.
 */
function normalizedPercent(value: number | null | undefined, max: number): number {
  if (value == null || !Number.isFinite(value) || max <= 0) return 0;
  return clamp((value / max) * 100);
}

/** Pillar maxima of the evidence model, for scaling pillar-backed columns. */
const EVIDENCE_MAX = { regulatory: 20, financial: 20 } as const;

interface ReadinessView {
  /** The headline readiness score, 0â€“100. */
  overall: number | null;
  /** Regulatory strength on a 0â€“100 scale. */
  regulatory: number | null;
  /** True when the row was produced by the evidence engine (SCORING_V2+). */
  evidenced: boolean;
  /** Documented max attainable at the project's stage (null when unknown). */
  bandMax: number | null;
}

/**
 * Read a project's scores into a model-aware, like-for-like view.
 *
 * Evidence-scored rows publish their pillars in breakdown.pillars; legacy rows
 * carry the 40/35/25 dimensions. For legacy rows the headline score is used as
 * the regulatory proxy it always was. The stage band ceiling contextualises
 * the overall score: a 40 at Concept is near its ceiling, a 40 at PPA Ready is
 * not â€” partners are scored on progress within the achievable range, not raw
 * absolute, so early-stage projects are not structurally penalised against
 * later-stage ones.
 */
function readinessView(project: Project): ReadinessView {
  const scores = project.scores;
  if (!scores) {
    return { overall: null, regulatory: null, evidenced: false, bandMax: null };
  }

  let evidenced = false;
  let regulatory: number | null = null;

  const breakdown = (scores as any).breakdown;
  const pillars = (breakdown as any)?.pillars;
  if (Array.isArray(pillars) && pillars.length > 0) {
    evidenced = true;
    const regulatoryPillar = pillars.find((p: any) => p?.key === 'regulatory');
    const max = Number(regulatoryPillar?.max ?? EVIDENCE_MAX.regulatory);
    regulatory = normalizedPercent(regulatoryPillar?.earned ?? scores.regulatory_score, max);
  } else {
    const max = Number((breakdown as any)?.regulatory?.max) || 40;
    regulatory = normalizedPercent(scores.regulatory_score, max);
  }

  const stageValue = typeof project.project_stage === 'string' ? project.project_stage : null;
  const band = stageValue ? stageBand(STAGE_BY_VALUE[stageValue]?.number ?? 0) : null;

  return {
    overall: typeof scores.capital_readiness_score === 'number' ? scores.capital_readiness_score : null,
    regulatory,
    evidenced,
    bandMax: band?.max ?? null,
  };
}

/**
 * A project's readiness relative to what its stage can achieve, 0â€“100.
 * Falls back to the raw score when no band is known.
 */
function stageRelativeReadiness(view: ReadinessView): number {
  if (view.overall == null) return 45; // unchanged neutral for projects with no scores
  if (view.bandMax == null || view.bandMax <= 0) return clamp(view.overall);
  return clamp((view.overall / view.bandMax) * 100);
}

type MatchKind = 'CAPITAL' | 'TECHNICAL' | 'CONSULTANT' | 'POWER_TRADER';

interface Dimension {
  key: string;
  label: string;
  raw: number;
  weight: number;
  detail: string;
}

interface EngineOptions {
  hasAcceptedEPC?: boolean;
  gapServices?: string[];
  /** Penalty (points) from this project's declined/withdrawn engagement history (feedback loop). */
  declinePenalty?: number;
}

const TECH_TO_CATEGORY: Record<string, string> = {
  SOLAR: 'SOLAR',
  SOLAR_PV: 'SOLAR',
  PHOTOVOLTAIC: 'SOLAR',
  CONCENTRATED_SOLAR: 'SOLAR',
  CSP: 'SOLAR',
  WIND: 'WIND',
  ONSHORE_WIND: 'WIND',
  OFFSHORE_WIND: 'WIND',
  HYDRO: 'HYDRO',
  RUN_OF_RIVER: 'HYDRO',
  LARGE_HYDRO: 'HYDRO',
  SMALL_HYDRO: 'HYDRO',
  STORAGE: 'STORAGE',
  BATTERY_STORAGE: 'STORAGE',
  PUMPED_HYDRO: 'STORAGE',
  LITHIUM_ION: 'STORAGE',
  VANADIUM_FLOW: 'STORAGE',
  BIOMASS: 'BIOMASS',
  GEOTHERMAL: 'GEOTHERMAL',
  GRID_INFRA: 'GRID_INFRA',
};

const CATEGORY_ADJACENCIES: Record<string, string[]> = {
  SOLAR: ['STORAGE'],
  WIND: ['STORAGE'],
  STORAGE: ['SOLAR', 'WIND'],
  HYDRO: ['GEOTHERMAL', 'BIOMASS'],
  GEOTHERMAL: ['HYDRO'],
  BIOMASS: ['HYDRO'],
};

/** Stage numbers come from the taxonomy â€” one lifecycle, one numbering. */
function stageNumber(stage?: string | null): number {
  return stage ? STAGE_BY_VALUE[stage]?.number ?? 0 : 0;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function round(value: number): number {
  return Math.round(clamp(value));
}

function canonical(value?: string | null): string {
  const raw = String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return TECH_TO_CATEGORY[raw] ?? raw;
}

function normalizeList(values?: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
}

function normalizedHaystack(values: unknown[]): string {
  return values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter(Boolean)
    .map((value) => String(value).toUpperCase().replace(/[_-]+/g, ' '))
    .join(' ');
}

function fmtMoney(val: number | undefined | null): string {
  if (val == null || Number.isNaN(val)) return 'N/A';
  if (val >= 1_000_000_000) return `ZMW ${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `ZMW ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `ZMW ${(val / 1_000).toFixed(0)}K`;
  return `ZMW ${val}`;
}

function scoreRange(value?: number | null, min?: number | null, max?: number | null): number {
  if (!value || !min || !max) return 50;
  if (value >= min && value <= max) return 100;
  if (value < min) {
    const ratio = (min - value) / min;
    if (ratio <= 0.2) return 80;
    return clamp(100 - ratio * 100);
  }
  const ratio = (value - max) / max;
  if (ratio <= 0.2) return 80;
  return clamp(100 - ratio * 100);
}

function scoreSetMatch(value: string | undefined | null, accepted: string[] | undefined, neutralWhenEmpty = false): number {
  const list = normalizeList(accepted).map((item) => item.toUpperCase());
  if (!value) return 50;
  if (list.length === 0) return neutralWhenEmpty ? 50 : 0;
  return list.includes(String(value).toUpperCase()) ? 100 : 0;
}

function scoreTechnology(projectTech: string, partnerSectors?: string[]): number {
  const sectors = normalizeList(partnerSectors).map(canonical);
  if (sectors.length === 0) return 50;
  const projectCategory = canonical(projectTech);
  if (sectors.includes(projectCategory)) return 100;
  const adjacent = CATEGORY_ADJACENCIES[projectCategory] ?? [];
  return adjacent.some((item) => sectors.includes(item)) ? 65 : 0;
}

export function hasProfessionalSectorOverlap(projectTech: string, partnerSectors?: string[]): boolean {
  return scoreTechnology(projectTech, partnerSectors) > 0;
}

export function hasProfessionalCountryMatch(projectCountry: string, partnerCompanyCountry?: string | null): boolean {
  if (!projectCountry || !partnerCompanyCountry) return true;
  return projectCountry.trim().toLowerCase() === partnerCompanyCountry.trim().toLowerCase();
}

function scoreGeography(project: Project, regions?: string[], companyCountry?: string | null): number {
  const focus = normalizeList(regions);
  const region = project.location_region;
  const country = project.location_country;
  if (region && focus.some((item) => item.toLowerCase() === region.toLowerCase())) return 100;
  if (country && focus.some((item) => item.toLowerCase() === country.toLowerCase())) return 85;
  if (hasProfessionalCountryMatch(country, companyCountry)) return 70;
  if (focus.length === 0 && !companyCountry) return 50;
  return 0;
}

function scoreStage(projectStage?: string, preferred?: string[]): number {
  const stage = String(projectStage ?? '');
  const preferredStages = normalizeList(preferred);
  if (!stage) return 50;
  if (preferredStages.length === 0) return 70;
  if (preferredStages.includes(stage)) return 100;
  const current = stageNumber(stage);
  const closest = preferredStages
    .map((item) => Math.abs(stageNumber(item) - current))
    .sort((a, b) => a - b)[0];
  if (closest === 1) return 65;
  if (closest === 2) return 35;
  return 0;
}

function scoreRisk(project: Project, tolerance?: string): number {
  const view = readinessView(project);
  // Regulatory strength on its own 0â€“100 scale â€” not a raw 0â€“20 value
  // compared against 0â€“100 thresholds.
  const regulatory = view.regulatory ?? 50;
  const riskFlags = normalizeList(project.scores?.risk_flags);
  const hasRiskDisclosure = Boolean(project.risk_disclosures);
  let base = 50;
  switch (String(tolerance ?? '').toUpperCase()) {
    case 'LOW':
      base = regulatory >= 75 && riskFlags.length === 0 ? 100 : regulatory >= 55 ? 70 : 30;
      break;
    case 'MEDIUM':
      base = regulatory >= 45 ? 90 : 60;
      break;
    case 'HIGH':
      base = 100;
      break;
    default:
      base = 60;
  }
  return clamp(base + (hasRiskDisclosure ? 5 : -5) - Math.min(20, riskFlags.length * 5));
}

function scoreGovernance(project: Project, preference?: string): number {
  const terms = String(project.governance_terms ?? '').toLowerCase();
  if (!terms) return 50;
  switch (String(preference ?? '').toUpperCase()) {
    case 'ACTIVE_ROLE':
      return terms.includes('active') || terms.includes('management') ? 100 : 65;
    case 'BOARD_SEAT':
      return terms.includes('board') || terms.includes('seat') ? 100 : 65;
    case 'PASSIVE':
      return terms.includes('passive') || terms.includes('no control') ? 100 : 65;
    default:
      return 70;
  }
}

function scoreReadiness(project: Project, kind: MatchKind): number {
  const scores = project.scores;
  if (!scores) return 45;
  const view = readinessView(project);
  const overall = stageRelativeReadiness(view);

  if (kind === 'TECHNICAL' || kind === 'CONSULTANT') {
    // technical_readiness_score / documentation_score / governance_score are a
    // legacy admin-vetting column set; the evidence engine never writes them.
    // Use them only when present (admin-scored rows), otherwise fall back to
    // the stage-relative readiness instead of blending zeros in.
    const technical = normalizedPercent(scores.technical_readiness_score, 100);
    const documentation = normalizedPercent(scores.documentation_score, 100);
    const governance = normalizedPercent(scores.governance_score, 100);
    const hasLegacyColumns = scores.technical_readiness_score != null || scores.documentation_score != null;
    if (hasLegacyColumns) {
      return clamp(technical * 0.45 + documentation * 0.25 + (view.regulatory ?? 50) * 0.15 + governance * 0.15);
    }
    return clamp(overall * 0.7 + (view.regulatory ?? 50) * 0.3);
  }

  if (kind === 'POWER_TRADER') {
    const ppaStatus = String(project.tech_requirements?.ppa_status ?? '').toUpperCase();
    const ppaBonus = ppaStatus === 'SECURED' ? 15 : ppaStatus === 'IN_PROGRESS' ? 8 : 0;
    return clamp(overall * 0.6 + (view.regulatory ?? 50) * 0.4 + ppaBonus);
  }

  return clamp(overall * 0.55 + (view.regulatory ?? 50) * 0.25 + normalizedPercent(scores.documentation_score, 100) * 0.2);
}

function documentTypes(project: Project): string[] {
  return normalizeList((project.documents ?? []).map((doc) => doc.document_type || (doc as any).file_name || doc.file_url))
    .map((item) => item.toUpperCase());
}

function scoreDocuments(project: Project, required: string[]): number {
  const docs = documentTypes(project);
  if (required.length === 0) {
    const score = project.scores?.documentation_score;
    return score == null ? 50 : score;
  }
  const found = required.filter((needle) => docs.some((doc) => doc.includes(needle)));
  return Math.round((found.length / required.length) * 100);
}

function inferRequiredDocuments(project: Project, kind: MatchKind): string[] {
  const stage = String(project.project_stage ?? '');
  const docs = kind === 'CAPITAL'
    ? ['FEASIBILITY', 'FINANCIAL']
    : kind === 'TECHNICAL'
      ? ['FEASIBILITY', 'TECHNICAL']
      : kind === 'POWER_TRADER'
        ? ['PPA', 'LICENSE']
        : [];
  if (['REGULATORY_APPROVAL', 'PPA_READY', 'FINANCIAL_CLOSE', 'CONSTRUCTION'].includes(stage)) docs.push('ENVIRONMENTAL');
  if (['PPA_READY', 'FINANCIAL_CLOSE'].includes(stage)) docs.push('LEGAL');
  return [...new Set(docs)];
}

function scoreImpact(project: Project, partner: any): number {
  const haystack = normalizedHaystack([
    project.description,
    project.technology_type,
    partner?.eligibility_criteria,
    partner?.focus_sectors,
    partner?.sector_focus,
    partner?.expected_return_profile,
  ]);
  let score = 55;
  if (/(ESG|IMPACT|CLIMATE|RENEWABLE|DECARBON|COMMUNITY|JOBS)/.test(haystack)) score += 25;
  if (/(SOLAR|WIND|HYDRO|STORAGE|BIOMASS|GEOTHERMAL)/.test(haystack)) score += 15;
  return clamp(score);
}

function scoreReturnProfile(project: Project, partner: any): number {
  const profile = String(partner?.expected_return_profile ?? '').toUpperCase();
  if (!profile) return 55;
  const stage = String(project.project_stage ?? '');
  if (profile.includes('IMPACT')) return 85;
  if (profile.includes('HIGH') && ['CONCEPT', 'PRE_FEASIBILITY'].includes(stage)) return 80;
  if (profile.includes('STABLE') && ['PPA_READY', 'FINANCIAL_CLOSE', 'OPERATION'].includes(stage)) return 90;
  return 65;
}

function scoreServices(required: string[] | undefined, offered: string[] | undefined, neutral = 60): number {
  const req = normalizeList(required).map((item) => item.toUpperCase().replace(/[\s-]+/g, '_'));
  const off = normalizeList(offered).map((item) => item.toUpperCase().replace(/[\s-]+/g, '_'));
  if (req.length === 0) return neutral;
  if (off.length === 0) return 0;
  const matches = req.filter((item) => off.includes(item));
  if (matches.length === req.length) return 100;
  if (matches.length > 0) return 55 + Math.round((matches.length / req.length) * 30);
  return 0;
}

function scoreExperience(years?: number | null, completedProjects?: number | null): number {
  const yearScore = Math.min(70, Math.max(0, years ?? 0) * 8);
  const projectScore = Math.min(30, Math.max(0, completedProjects ?? 0) * 3);
  return clamp(yearScore + projectScore);
}

function scoreTrackRecord(partner: any): number {
  const deliveredMw = Number(partner?.total_mw_delivered ?? 0);
  const largestMw = Number(partner?.largest_project_mw ?? 0);
  const references = Array.isArray(partner?.references_data) ? partner.references_data.length : 0;
  return clamp(Math.min(45, deliveredMw / 5) + Math.min(35, largestMw) + Math.min(20, references * 10));
}

function scoreCertifications(partner: any): number {
  const certs = normalizeList(partner?.certifications);
  if (certs.length === 0) return 40;
  const haystack = normalizedHaystack(certs);
  let score = Math.min(85, 45 + certs.length * 12);
  if (/(ISO|IFC|HSE|QUALITY|SAFETY|ENVIRONMENT)/.test(haystack)) score += 15;
  return clamp(score);
}

function scoreCapacity(project: Project, partner: any): number {
  const annual = Number(partner?.annual_delivery_capacity_mw ?? 0);
  const bonding = Number(partner?.bonding_capacity ?? 0);
  const mwFit = annual ? scoreRange(project.project_size_mw, 0.01, annual) : 55;
  const capitalFit = bonding ? scoreRange(project.capital_required, 0.01, bonding * 4) : 55;
  return clamp(mwFit * 0.65 + capitalFit * 0.35);
}

function scoreAvailability(partner: any): number {
  switch (String(partner?.availability ?? '').toUpperCase()) {
    case 'AVAILABLE':
      return 100;
    case 'BUSY':
      return 55;
    case 'UNAVAILABLE':
      return 0;
    default:
      return 65;
  }
}

function confidence(project: Project, partner: any, requiredFields: string[]): number {
  const projectSignals = [
    project.technology_type,
    project.location_country,
    project.project_size_mw,
    project.capital_required,
    project.project_stage,
    project.scores,
  ].filter(Boolean).length;
  const partnerSignals = requiredFields.filter((field) => {
    const value = partner?.[field];
    return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '';
  }).length;
  return clamp(((projectSignals / 6) * 45) + ((partnerSignals / Math.max(1, requiredFields.length)) * 55));
}

function buildBreakdown(dimensions: Dimension[], extras: Record<string, unknown> = {}): Record<string, unknown> {
  const breakdown: Record<string, unknown> = {};
  for (const dimension of dimensions) {
    breakdown[dimension.key] = {
      score: Math.round(dimension.raw * dimension.weight),
      detail: dimension.detail,
      weight: `${Math.round(dimension.weight * 100)}%`,
      rawScore: round(dimension.raw),
    };
    breakdown[`raw_${dimension.key}`] = round(dimension.raw);
  }
  return { ...breakdown, ...extras };
}

function totalScore(dimensions: Dimension[], bonus = 0, penalty = 0): number {
  const weighted = dimensions.reduce((sum, dimension) => sum + dimension.raw * dimension.weight, 0);
  return round(weighted + bonus - penalty);
}

function hardEligibility(project: Project, partner: any, type: MatchKind): string[] {
  const reasons: string[] = [];
  if (!hasProfessionalCountryMatch(project.location_country, partner?.company?.country)) {
    reasons.push('Country mismatch');
  }
  const sectors = type === 'CAPITAL'
    ? partner?.sector_focus
    : type === 'POWER_TRADER'
      ? partner?.preferred_technology_types
      : partner?.sector_experience;
  if (!hasProfessionalSectorOverlap(project.technology_type, sectors)) {
    reasons.push('Technology or sector mismatch');
  }
  if (type !== 'POWER_TRADER' && !isPartnerEligibleForStage(project.project_stage, type, partner)) {
    reasons.push('Partner category is not recommended at this project stage');
  }
  return reasons;
}

function isPartnerEligibleForStage(stage: string | null | undefined, type: MatchKind, partner: any): boolean {
  if (!stage) return true;
  if (type === 'CONSULTANT') return isPartnerTypeAllowedAtStage(stage, 'Consultant');
  if (type === 'CAPITAL') {
    const structures = normalizeList(partner?.preferred_capital_structure);
    const labels = structures.includes('GRANT')
      ? ['Development Partner', 'Grant Provider']
      : ['Commercial Bank / DFI', 'Infrastructure Fund', 'Financial'];
    return labels.some((label) => isPartnerTypeAllowedAtStage(stage, label));
  }
  if (type === 'TECHNICAL') {
    const haystack = normalizedHaystack([partner?.company?.name, partner?.service_categories, partner?.delivery_models]);
    const labels = [
      /(EPC|CONSTRUCTION|EPCM)/.test(haystack) ? 'EPC Contractor' : '',
      /(O&M|O AND M|O_AND_M|OPERATOR|OPERATIONS)/.test(haystack) ? 'O&M' : '',
      'Technical Consultant',
    ].filter(Boolean);
    return labels.some((label) => isPartnerTypeAllowedAtStage(stage, label));
  }
  return true;
}

function ineligibleResult(project: Project, partner: any, type: MatchKind, reasons: string[]) {
  const breakdown = {
    eligibility: {
      score: 0,
      detail: reasons.join('; '),
      weight: 'required',
      rawScore: 0,
    },
    reasons,
    confidence: confidence(project, partner, []),
  };
  const common = {
    id: '',
    project_id: project.id,
    compatibility_score: 0,
    score_breakdown: breakdown,
    created_at: new Date().toISOString(),
  };
  if (type === 'TECHNICAL') return { ...common, technical_partner_id: partner.id } as TechnicalMatchResult;
  if (type === 'CONSULTANT') return { ...common, consultant_id: partner.id } as ConsultantMatchResult;
  if (type === 'POWER_TRADER') return { ...common, power_trader_id: partner.id };
  return { ...common, capital_partner_id: partner.id } as CapitalMatchResult;
}

export function calculateProfessionalCapitalMatchScore(
  project: Project,
  partner: CapitalPartner & Record<string, any>,
  options: EngineOptions = {},
): CapitalMatchResult {
  const failures = hardEligibility(project, partner, 'CAPITAL');
  if (failures.length > 0) return ineligibleResult(project, partner, 'CAPITAL', failures) as CapitalMatchResult;

  const isGrant = partner._grant_provider_id || normalizeList(partner.preferred_capital_structure).includes('GRANT');
  const requiredDocs = inferRequiredDocuments(project, 'CAPITAL');
  const dimensions: Dimension[] = isGrant
    ? [
        { key: 'capital_overlap', label: 'Grant Size', raw: scoreRange(project.funding_required ?? project.capital_required, partner.min_ticket_size, partner.max_ticket_size), weight: 0.22, detail: `${fmtMoney(project.funding_required ?? project.capital_required)} against grant range ${fmtMoney(partner.min_ticket_size)} to ${fmtMoney(partner.max_ticket_size)}` },
        { key: 'structure', label: 'Funding Type', raw: scoreSetMatch(project.capital_structure_type, ['GRANT'], true), weight: 0.14, detail: 'Grant provider fit against requested capital structure' },
        { key: 'sector', label: 'Sector', raw: scoreTechnology(project.technology_type, partner.sector_focus), weight: 0.14, detail: 'Technology focus alignment' },
        { key: 'geography', label: 'Geography', raw: scoreGeography(project, partner.geographic_focus, partner.company?.country), weight: 0.12, detail: 'Country and province eligibility' },
        { key: 'stage', label: 'Stage', raw: scoreStage(project.project_stage, partner.preferred_project_stage), weight: 0.12, detail: 'Grant timing against project lifecycle stage' },
        { key: 'readiness', label: 'Readiness', raw: scoreReadiness(project, 'CAPITAL'), weight: 0.10, detail: 'Capital readiness, documents, regulatory status, and financial transparency' },
        { key: 'documentation', label: 'Documents', raw: scoreDocuments(project, requiredDocs), weight: 0.08, detail: `Required evidence checked: ${requiredDocs.join(', ')}` },
        { key: 'impact', label: 'Impact', raw: scoreImpact(project, partner), weight: 0.08, detail: 'ESG, development impact, and renewable-energy fit' },
      ]
    : [
        { key: 'capital_overlap', label: 'Capital Range', raw: scoreRange(project.capital_required, partner.min_ticket_size, partner.max_ticket_size), weight: 0.20, detail: `${fmtMoney(project.capital_required)} against ticket range ${fmtMoney(partner.min_ticket_size)} to ${fmtMoney(partner.max_ticket_size)}` },
        { key: 'structure', label: 'Structure', raw: scoreSetMatch(project.capital_structure_type, partner.preferred_capital_structure, true), weight: 0.14, detail: 'Debt, equity, leasing, profit sharing, or grant preference fit' },
        { key: 'sector', label: 'Sector', raw: scoreTechnology(project.technology_type, partner.sector_focus), weight: 0.12, detail: 'Renewable technology and adjacent sector alignment' },
        { key: 'geography', label: 'Geography', raw: scoreGeography(project, partner.geographic_focus, partner.company?.country), weight: 0.10, detail: 'Country and province investment focus' },
        { key: 'stage', label: 'Stage', raw: scoreStage(project.project_stage, partner.preferred_project_stage), weight: 0.10, detail: 'Investment timing against project lifecycle stage' },
        { key: 'risk', label: 'Risk', raw: scoreRisk(project, partner.risk_tolerance), weight: 0.10, detail: 'Risk appetite, regulatory quality, and disclosed risk flags' },
        { key: 'governance', label: 'Governance', raw: scoreGovernance(project, partner.governance_preference), weight: 0.08, detail: 'Investor governance rights and project governance terms' },
        { key: 'readiness', label: 'Readiness', raw: scoreReadiness(project, 'CAPITAL'), weight: 0.08, detail: 'Capital readiness, financial transparency, documents, and regulatory status' },
        { key: 'documentation', label: 'Documents', raw: scoreDocuments(project, requiredDocs), weight: 0.04, detail: `Required evidence checked: ${requiredDocs.join(', ')}` },
        { key: 'impact', label: 'ESG / Impact', raw: scoreImpact(project, partner), weight: 0.02, detail: 'ESG and renewable-energy impact fit' },
        { key: 'return_profile', label: 'Return Profile', raw: scoreReturnProfile(project, partner), weight: 0.02, detail: 'Expected return profile against project maturity' },
      ];

  const epcBonus = options.hasAcceptedEPC ? 5 : 0;
  const dataConfidence = confidence(project, partner, ['min_ticket_size', 'max_ticket_size', 'risk_tolerance', 'geographic_focus', 'sector_focus', 'preferred_capital_structure']);
  const score = totalScore(dimensions, epcBonus, (dataConfidence < 55 ? 5 : 0) + Math.max(0, options.declinePenalty ?? 0));
  return {
    id: '',
    project_id: project.id,
    capital_partner_id: partner.id,
    compatibility_score: score,
    score_breakdown: buildBreakdown(dimensions, {
      bonuses: {
        joint_entity: { score: epcBonus, detail: epcBonus > 0 ? 'Accepted EPC engagement improves financeability' : 'No accepted EPC engagement' },
      },
      confidence: dataConfidence,
      engine_version: 'professional-v1',
      decline_penalty: Math.max(0, options.declinePenalty ?? 0),
      capital_range_overlap: round(dimensions[0].raw),
      structure_compatibility: round(dimensions[1].raw),
      sector_match: round(dimensions.find((d) => d.key === 'sector')?.raw ?? 0),
      geographic_match: round(dimensions.find((d) => d.key === 'geography')?.raw ?? 0),
      risk_tolerance_alignment: round(dimensions.find((d) => d.key === 'risk')?.raw ?? 100),
      governance_preference_alignment: round(dimensions.find((d) => d.key === 'governance')?.raw ?? 100),
    }),
    created_at: new Date().toISOString(),
  };
}

export function calculateProfessionalTechnicalMatchScore(
  project: Project,
  partner: TechnicalPartner,
  options: EngineOptions = {},
): TechnicalMatchResult {
  const failures = hardEligibility(project, partner, 'TECHNICAL');
  if (failures.length > 0) return ineligibleResult(project, partner, 'TECHNICAL', failures) as TechnicalMatchResult;

  const requiredServices = options.gapServices?.length ? options.gapServices : project.tech_requirements?.required_services;
  const requiredDocs = inferRequiredDocuments(project, 'TECHNICAL');
  const dimensions: Dimension[] = [
    { key: 'sector_tech', label: 'Technology', raw: scoreTechnology(project.technology_type, partner.sector_experience), weight: 0.18, detail: 'Direct and adjacent renewable technology experience' },
    { key: 'service_fit', label: 'Service Fit', raw: scoreServices(requiredServices, partner.service_categories, 65), weight: 0.16, detail: 'EPC, EPCM, O&M, engineering, or construction-service fit' },
    { key: 'project_size', label: 'Project Size', raw: scoreRange(project.project_size_mw, partner.min_mw_capacity, partner.max_mw_capacity), weight: 0.14, detail: `${project.project_size_mw} MW against partner range ${partner.min_mw_capacity} to ${partner.max_mw_capacity} MW` },
    { key: 'ticket_size', label: 'Commercial Range', raw: scoreRange(project.capital_required, partner.min_ticket_size_zmw, partner.max_ticket_size_zmw), weight: 0.08, detail: 'Commercial fit against typical project ticket range' },
    { key: 'geography', label: 'Geography', raw: scoreGeography(project, partner.regions_operated, partner.company?.country), weight: 0.10, detail: 'Country, province, and operating footprint' },
    { key: 'experience', label: 'Experience', raw: scoreExperience(partner.years_of_experience, undefined), weight: 0.10, detail: 'Years of operating experience' },
    { key: 'track_record', label: 'Track Record', raw: scoreTrackRecord(partner), weight: 0.08, detail: 'Delivered MW, largest project, and references' },
    { key: 'delivery_model', label: 'Delivery Model', raw: scoreServices(requiredServices, partner.delivery_models, 60), weight: 0.06, detail: 'EPC, EPCM, BOOT, O&M, or milestone delivery model' },
    { key: 'capacity', label: 'Delivery Capacity', raw: scoreCapacity(project, partner), weight: 0.05, detail: 'Annual delivery capacity and bonding capacity' },
    { key: 'certifications', label: 'Certifications', raw: scoreCertifications(partner), weight: 0.03, detail: 'Safety, quality, ISO, HSE, or equivalent certifications' },
    { key: 'documentation', label: 'Documents', raw: scoreDocuments(project, requiredDocs), weight: 0.02, detail: `Required evidence checked: ${requiredDocs.join(', ')}` },
  ];
  const dataConfidence = confidence(project, partner, ['service_categories', 'sector_experience', 'min_mw_capacity', 'max_mw_capacity', 'regions_operated', 'delivery_models']);
  return {
    id: '',
    project_id: project.id,
    technical_partner_id: partner.id,
    compatibility_score: totalScore(dimensions, 0, (dataConfidence < 55 ? 5 : 0) + Math.max(0, options.declinePenalty ?? 0)),
    score_breakdown: buildBreakdown(dimensions, {
      confidence: dataConfidence,
      engine_version: 'professional-v1',
      decline_penalty: Math.max(0, options.declinePenalty ?? 0),
    }),
    created_at: new Date().toISOString(),
  };
}

export function calculateProfessionalConsultantMatchScore(
  project: Project,
  partner: ConsultantProfile,
  options: EngineOptions = {},
): ConsultantMatchResult {
  const failures = hardEligibility(project, partner, 'CONSULTANT');
  if (failures.length > 0) return ineligibleResult(project, partner, 'CONSULTANT', failures) as ConsultantMatchResult;

  const requiredServices = options.gapServices?.length ? options.gapServices : project.tech_requirements?.required_services;
  const dimensions: Dimension[] = [
    { key: 'service_fit', label: 'Service Fit', raw: scoreServices(requiredServices, partner.service_categories, 70), weight: 0.24, detail: 'Fit against gap-resolution service need' },
    { key: 'sector_tech', label: 'Technology', raw: scoreTechnology(project.technology_type, partner.sector_experience), weight: 0.14, detail: 'Project technology and consultant sector experience' },
    { key: 'specialization', label: 'Specialization', raw: scoreServices(requiredServices, partner.specializations, 60), weight: 0.10, detail: 'Specialized advisory capabilities' },
    { key: 'project_size', label: 'Project Size', raw: partner.largest_project_mw ? scoreRange(project.project_size_mw, 0.01, partner.largest_project_mw) : 55, weight: 0.10, detail: 'Project size against consultant largest relevant project' },
    { key: 'geography', label: 'Geography', raw: scoreGeography(project, partner.regions_operated, partner.company?.country), weight: 0.10, detail: 'Country, province, and regional advisory footprint' },
    { key: 'experience', label: 'Experience', raw: scoreExperience(partner.years_of_experience, partner.total_projects_completed), weight: 0.16, detail: 'Years of experience and completed advisory mandates' },
    { key: 'availability', label: 'Availability', raw: scoreAvailability(partner), weight: 0.08, detail: 'Current availability to support the project' },
    { key: 'certifications', label: 'Certifications', raw: scoreCertifications(partner), weight: 0.04, detail: 'Professional certifications and quality signals' },
    { key: 'documentation', label: 'Profile Evidence', raw: partner.company_experience_doc_url || partner.portfolio_doc_url ? 100 : 45, weight: 0.04, detail: 'Capability documents, portfolio, and references' },
  ];
  const dataConfidence = confidence(project, partner, ['service_categories', 'sector_experience', 'specializations', 'years_of_experience', 'total_projects_completed', 'regions_operated']);
  return {
    id: '',
    project_id: project.id,
    consultant_id: partner.id,
    compatibility_score: totalScore(dimensions, 0, (dataConfidence < 55 ? 5 : 0) + Math.max(0, options.declinePenalty ?? 0)),
    score_breakdown: buildBreakdown(dimensions, {
      confidence: dataConfidence,
      engine_version: 'professional-v1',
      decline_penalty: Math.max(0, options.declinePenalty ?? 0),
      raw_project_size: round(dimensions.find((d) => d.key === 'project_size')?.raw ?? 0),
      raw_geography: round(dimensions.find((d) => d.key === 'geography')?.raw ?? 0),
      raw_experience: round(dimensions.find((d) => d.key === 'experience')?.raw ?? 0),
    }),
    created_at: new Date().toISOString(),
  };
}

export function calculateProfessionalPowerTraderMatchScore(
  project: Project,
  partner: PowerTrader,
  options: EngineOptions = {},
) {
  const failures = hardEligibility(project, partner, 'POWER_TRADER');
  if (failures.length > 0) return ineligibleResult(project, partner, 'POWER_TRADER', failures);

  const requiredDocs = inferRequiredDocuments(project, 'POWER_TRADER');
  const dimensions: Dimension[] = [
    { key: 'technology', label: 'Technology', raw: scoreTechnology(project.technology_type, partner.preferred_technology_types), weight: 0.18, detail: 'Preferred generation technology fit' },
    { key: 'offtake_capacity', label: 'Offtake Capacity', raw: scoreRange(project.project_size_mw, 0.01, partner.max_offtake_capacity_mw), weight: 0.22, detail: `${project.project_size_mw} MW against max offtake capacity ${partner.max_offtake_capacity_mw} MW` },
    { key: 'geography', label: 'Geography', raw: scoreGeography(project, partner.regions_of_interest, partner.company?.country), weight: 0.15, detail: 'Country and offtake region fit' },
    { key: 'ppa_tenor', label: 'PPA Tenor', raw: partner.min_ppa_duration_years ? 85 : 55, weight: 0.10, detail: 'Minimum PPA duration and project offtake maturity' },
    { key: 'readiness', label: 'PPA Readiness', raw: scoreReadiness(project, 'POWER_TRADER'), weight: 0.20, detail: 'Regulatory, documentation, financial, and PPA status readiness' },
    { key: 'documentation', label: 'Documents', raw: scoreDocuments(project, requiredDocs), weight: 0.10, detail: `Required evidence checked: ${requiredDocs.join(', ')}` },
    { key: 'credit', label: 'Credit Quality', raw: partner.credit_rating_equivalent ? 85 : 55, weight: 0.05, detail: 'Trader credit-rating signal' },
  ];
  return {
    id: '',
    project_id: project.id,
    power_trader_id: partner.id,
    compatibility_score: totalScore(dimensions, 0, Math.max(0, options.declinePenalty ?? 0)),
    score_breakdown: buildBreakdown(dimensions, {
      confidence: confidence(project, partner, ['license_type', 'max_offtake_capacity_mw', 'preferred_technology_types', 'regions_of_interest', 'min_ppa_duration_years']),
      engine_version: 'professional-v1',
      decline_penalty: Math.max(0, options.declinePenalty ?? 0),
    }),
    created_at: new Date().toISOString(),
  };
}



/**
 * Human-readable "why this match" reasons, ordered by contribution to the score.
 * Reads the persisted score_breakdown so it works for capital / technical /
 * consultant / power-trader rows alike, and surfaces the engagement-history
 * penalty when one applied.
 */
export function topMatchReasons(
  match: { score_breakdown?: Record<string, any> | null },
  limit = 3,
): string[] {
  const bd = (match?.score_breakdown ?? {}) as Record<string, any>;
  const entries: { detail: string; contribution: number }[] = [];

  for (const [key, value] of Object.entries(bd)) {
    if (key.startsWith('raw_')) continue;
    if (!value || typeof value !== 'object') continue;
    const detail = typeof value.detail === 'string' ? value.detail : null;
    if (!detail) continue;
    const rawScore = Number(value.rawScore ?? 0);
    const weightPct = Number.parseInt(String(value.weight ?? '0'), 10) || 0;
    entries.push({ detail, contribution: rawScore * (weightPct / 100) });
  }

  entries.sort((a, b) => b.contribution - a.contribution);
  const reasons = entries.slice(0, limit).map((e) => e.detail);

  const penalty = Number(bd.decline_penalty ?? 0);
  if (penalty > 0) {
    reasons.push(`Engagement history: recent declines applied a ${penalty}-point penalty.`);
  }

  const joint = Number(bd?.bonuses?.joint_entity?.score ?? 0);
  if (joint > 0 && typeof bd?.bonuses?.joint_entity?.detail === 'string') {
    reasons.push(bd.bonuses.joint_entity.detail);
  }

  if (reasons.length === 0 && Array.isArray(bd.reasons)) {
    return (bd.reasons as string[]).slice(0, limit);
  }
  return reasons;
}

import { Project, CapitalPartner, TechnicalPartner, CapitalMatchResult, TechnicalMatchResult } from '@/types';

// Capital Matching Algorithm Weights
const CAPITAL_MATCH_WEIGHTS = {
  capital_range_overlap: 0.30,
  structure_compatibility: 0.20,
  risk_tolerance_alignment: 0.15,
  governance_preference_alignment: 0.15,
  sector_match: 0.10,
  geographic_match: 0.10,
};

// Calculate Capital Match Score
export function calculateCapitalMatchScore(
  project: Project,
  partner: CapitalPartner,
  hasAcceptedEPC: boolean = false
): CapitalMatchResult {
  let score = 0;

  // Capital Range Overlap (30%)
  const capitalOverlap = calculateCapitalOverlap(
    project.capital_required,
    partner.min_ticket_size,
    partner.max_ticket_size
  );
  score += capitalOverlap * CAPITAL_MATCH_WEIGHTS.capital_range_overlap;

  // Structure Compatibility (20%)
  const structureMatch = calculateStructureMatch(project, partner);
  score += structureMatch * CAPITAL_MATCH_WEIGHTS.structure_compatibility;

  // Risk Tolerance Alignment (15%)
  const readinessScore = project.scores?.regulatory_score || 50;
  const riskAlignment = calculateRiskAlignment(project.risk_disclosures, partner.risk_tolerance, readinessScore);
  score += riskAlignment * CAPITAL_MATCH_WEIGHTS.risk_tolerance_alignment;

  // Governance Preference Alignment (15%)
  const governanceAlignment = calculateGovernanceAlignment(project.governance_terms, partner.governance_preference);
  score += governanceAlignment * CAPITAL_MATCH_WEIGHTS.governance_preference_alignment;

  // Sector Match (10%) — normalise both sides to canonical category
  const TECH_TO_CATEGORY: Record<string, string> = {
    SOLAR: 'SOLAR', SOLAR_PV: 'SOLAR', CONCENTRATED_SOLAR: 'SOLAR', CSP: 'SOLAR',
    WIND: 'WIND', ONSHORE_WIND: 'WIND', OFFSHORE_WIND: 'WIND',
    HYDRO: 'HYDRO', RUN_OF_RIVER: 'HYDRO', LARGE_HYDRO: 'HYDRO', SMALL_HYDRO: 'HYDRO',
    STORAGE: 'STORAGE', BATTERY_STORAGE: 'STORAGE', PUMPED_HYDRO: 'STORAGE',
    BIOMASS: 'BIOMASS', GEOTHERMAL: 'GEOTHERMAL', GRID_INFRA: 'GRID_INFRA',
  };
  const projectCategory = TECH_TO_CATEGORY[project.technology_type] ?? project.technology_type;
  const partnerCategories = (partner.sector_focus ?? []).map(s => TECH_TO_CATEGORY[s] ?? s);
  const sectorMatch = partnerCategories.includes(projectCategory) ? 100 : 50;
  score += sectorMatch * CAPITAL_MATCH_WEIGHTS.sector_match;

  // Geographic Match (10%) — partner stores provinces; check region first, then country
  const geoFocus = partner.geographic_focus ?? [];
  const geoMatch = geoFocus.length === 0 ? 50
    : geoFocus.includes(project.location_region ?? '') ? 100
    : geoFocus.includes(project.location_country) ? 75
    : 0;
  score += geoMatch * CAPITAL_MATCH_WEIGHTS.geographic_match;

  // Project Stage Alignment
  if (partner.preferred_project_stage && partner.preferred_project_stage.includes(project.project_stage)) {
    score += 5; // Bonus for stage alignment
  }

  // Joint Entity Bonus: Add +10 points if the project has an accepted EPC engagement.
  if (hasAcceptedEPC) {
    score += 10;
  }

  const compatibilityScore = Math.min(100, Math.round(score));

  return {
    id: '',
    project_id: project.id,
    capital_partner_id: partner.id,
    compatibility_score: compatibilityScore,
    score_breakdown: {
      capital_range_overlap: Math.round(capitalOverlap),
      structure_compatibility: Math.round(structureMatch),
      risk_tolerance_alignment: Math.round(riskAlignment),
      governance_preference_alignment: Math.round(governanceAlignment),
      sector_match: Math.round(sectorMatch),
      geographic_match: Math.round(geoMatch),
    },
    created_at: new Date().toISOString(),
  };
}

// Calculate Capital Overlap
function calculateCapitalOverlap(projectCapital: number, minTicket: number, maxTicket: number): number {
  if (!projectCapital || !minTicket || !maxTicket) return 50;
  
  if (projectCapital >= minTicket && projectCapital <= maxTicket) {
    return 100;
  }
  
  if (projectCapital < minTicket) {
    // Within 20% of min ticket is still a good match
    const diff = minTicket - projectCapital;
    if (diff / minTicket < 0.2) return 80;
    return Math.max(0, 100 - (diff / minTicket) * 100);
  }
  
  // projectCapital > maxTicket
  const diff = projectCapital - maxTicket;
  if (diff / maxTicket < 0.2) return 80;
  return Math.max(0, 100 - (diff / maxTicket) * 100);
}

// Calculate Risk Alignment
function calculateRiskAlignment(riskDisclosures: string | undefined, riskTolerance: string, regulatoryScore: number): number {
  let baseScore = 50;
  
  // Logic: Partners with higher risk tolerance match better with projects that have disclosed risks
  switch (riskTolerance) {
    case 'LOW':
      baseScore = regulatoryScore > 30 ? 90 : 40; // Low tolerance requires high regulatory readiness
      break;
    case 'MEDIUM':
      baseScore = regulatoryScore > 20 ? 85 : 60;
      break;
    case 'HIGH':
      baseScore = 100; // High tolerance matches everything
      break;
    default:
      baseScore = 50;
  }

  if (riskDisclosures) baseScore += 10;
  return Math.min(100, baseScore);
}

// Calculate Governance Alignment
function calculateGovernanceAlignment(governanceTerms: string | undefined, preference: string): number {
  if (!governanceTerms) return 50;
  
  const terms = governanceTerms.toLowerCase();
  
  if (preference === 'ACTIVE_ROLE' && (terms.includes('active') || terms.includes('management'))) return 100;
  if (preference === 'BOARD_SEAT' && (terms.includes('board') || terms.includes('seat'))) return 100;
  if (preference === 'PASSIVE' && (terms.includes('passive') || terms.includes('no control'))) return 100;
  
  return 70; // Partial match
}

// Calculate Structure Match
function calculateStructureMatch(project: Project, partner: CapitalPartner): number {
  if (!project.capital_structure_type) return 50;
  
  // Match in preferred_capital_structure
  if (partner.preferred_capital_structure?.includes(project.capital_structure_type)) return 100;
  
  return 0;
}

// Technical Matching Algorithm Weights
const NEW_TECHNICAL_MATCH_WEIGHTS = {
  sector_tech: 0.25,
  project_size: 0.25,
  ticket_size: 0.20,
  geography: 0.15,
  experience: 0.15,
};

// Calculate Technical Match Score (New implementation)
export function calculateTechnicalMatchScore(
  project: Project,
  partner: TechnicalPartner
): TechnicalMatchResult {
  let score = 0;
  const breakdown: any = {};

  // 1. Sector/Technology (25%)
  const sectorScore = calculateSectorScore(project.technology_type, partner.sector_experience);
  score += sectorScore * NEW_TECHNICAL_MATCH_WEIGHTS.sector_tech;
  breakdown.sector_tech = Math.round(sectorScore);

  // 2. Project Size MW (25%)
  const sizeScore = calculateProjectSizeScore(project.project_size_mw, partner.min_mw_capacity, partner.max_mw_capacity);
  score += sizeScore * NEW_TECHNICAL_MATCH_WEIGHTS.project_size;
  breakdown.project_size = Math.round(sizeScore);

  // 3. Ticket Size (20%)
  const ticketScore = calculateTicketSizeScore(project.capital_required, partner.min_ticket_size_zmw, partner.max_ticket_size_zmw);
  score += ticketScore * NEW_TECHNICAL_MATCH_WEIGHTS.ticket_size;
  breakdown.ticket_size = Math.round(ticketScore);

  // 4. Geography (15%)
  const geoScore = calculateGeoScore(project.location_country, project.location_region, partner.regions_operated, partner.company?.country);
  score += geoScore * NEW_TECHNICAL_MATCH_WEIGHTS.geography;
  breakdown.geography = Math.round(geoScore);

  // 5. Experience (15%)
  let experienceScore = Math.min(100, (partner.years_of_experience || 0) * 10);
  
  // Management Team Logic:
  if (partner.company?.is_new_company_with_experienced_team) {
    experienceScore += 10;
  }
  if (partner.company?.years_operating && partner.company.years_operating < 2) {
    const mgmtExp = partner.company.management_team_experience;
    if (!partner.company.is_new_company_with_experienced_team && (!mgmtExp || mgmtExp.years < 5)) {
      experienceScore -= 15;
    }
  }
  
  experienceScore = Math.max(0, Math.min(100, experienceScore));
  score += experienceScore * NEW_TECHNICAL_MATCH_WEIGHTS.experience;
  breakdown.experience = Math.round(experienceScore);

  const compatibilityScore = Math.round(score);

  return {
    id: '',
    project_id: project.id,
    technical_partner_id: partner.id,
    compatibility_score: compatibilityScore,
    score_breakdown: breakdown,
    created_at: new Date().toISOString(),
  };
}

function calculateSectorScore(tech: string, experience: string[]): number {
  if (!experience || experience.length === 0) return 0;
  if (experience.includes(tech)) return 100;
  
  const adjacencies: Record<string, string[]> = {
    'SOLAR_PV': ['WIND', 'BATTERY_STORAGE'],
    'WIND': ['SOLAR_PV', 'BATTERY_STORAGE'],
    'HYDRO': ['GEOTHERMAL', 'BIOMASS'],
    'BATTERY_STORAGE': ['SOLAR_PV', 'WIND'],
  };
  
  const isAdjacent = adjacencies[tech]?.some(adj => experience.includes(adj));
  return isAdjacent ? 50 : 0;
}

function calculateProjectSizeScore(projectMW: number, minMW: number, maxMW: number): number {
  if (projectMW >= minMW && projectMW <= maxMW) return 100;
  
  if (projectMW < minMW && (minMW - projectMW) / minMW <= 0.2) return 50;
  if (projectMW > maxMW && (projectMW - maxMW) / maxMW <= 0.2) return 50;
  
  return 0;
}

function calculateTicketSizeScore(required: number, min: number | undefined, max: number | undefined): number {
  if (!min || !max) return 50;
  if (required >= min && required <= max) return 100;
  
  if (required < min && (min - required) / min <= 0.2) return 50;
  if (required > max && (required - max) / max <= 0.2) return 50;
  
  return 0;
}

function calculateGeoScore(country: string, region: string | undefined, operated: string[], partnerCountry: string | undefined): number {
  if (!operated || operated.length === 0) return 0;
  if (operated.includes(region || '')) return 100;
  if (operated.includes(country)) return 50;
  if (partnerCountry === country) return 50;
  return 0;
}


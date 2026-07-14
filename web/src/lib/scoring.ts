import { Project, CapitalPartner, TechnicalPartner, ProjectScore, CapitalMatchResult, TechnicalMatchResult } from '@/types';

// Capital Readiness Score Weights
const CAPITAL_READINESS_WEIGHTS = {
  documentation_completeness: 0.20,
  governance_clarity: 0.20,
  financial_transparency: 0.20,
  risk_disclosure_quality: 0.15,
  developer_track_record: 0.15,
  ai_risk_analysis: 0.10,
};

// Technical Readiness Score Components
const TECHNICAL_READINESS_COMPONENTS = {
  engineering_completeness: 25,
  grid_connection_clarity: 20,
  environmental_approvals: 20,
  construction_timeline_realism: 20,
  technical_documentation_quality: 15,
};

// Calculate Capital Readiness Score
export function calculateCapitalReadinessScore(
  project: Project,
  aiAnalysis?: { risk_flags: string[]; clarity_rating: number }
): ProjectScore {
  // Documentation Completeness (20%)
  const documentationScore = calculateDocumentationScore(project);

  // Governance Clarity (20%)
  const governanceScore = project.governance_terms ? 80 : 40;

  // Financial Transparency (20%)
  const financialScore = project.capital_required ? 80 : 40;

  // Risk Disclosure Quality (15%)
  const riskScore = project.risk_disclosures ? 80 : 40;

  // Developer Track Record (15%)
  const trackRecordScore = 70; // Would be calculated from company history

  // AI Risk Analysis (10%)
  const aiScore = aiAnalysis ? (aiAnalysis.clarity_rating / 100) * 100 : 50;

  // Calculate weighted total
  const totalScore = Math.round(
    documentationScore * CAPITAL_READINESS_WEIGHTS.documentation_completeness +
    governanceScore * CAPITAL_READINESS_WEIGHTS.governance_clarity +
    financialScore * CAPITAL_READINESS_WEIGHTS.financial_transparency +
    riskScore * CAPITAL_READINESS_WEIGHTS.risk_disclosure_quality +
    trackRecordScore * CAPITAL_READINESS_WEIGHTS.developer_track_record +
    aiScore * CAPITAL_READINESS_WEIGHTS.ai_risk_analysis
  );

  // Generate risk flags
  const risk_flags: string[] = [];
  if (!project.governance_terms) risk_flags.push('missing_governance');
  if (!project.risk_disclosures) risk_flags.push('missing_risk_disclosure');
  if (aiAnalysis?.risk_flags) risk_flags.push(...aiAnalysis.risk_flags);

  // Generate recommendations
  const recommendations: string[] = [];
  if (!project.governance_terms) recommendations.push('add_governance_terms');
  if (!project.risk_disclosures) recommendations.push('add_risk_disclosures');
  if (documentationScore < 60) recommendations.push('complete_documentation');

  return {
    id: '',
    project_id: project.id,
    capital_readiness_score: totalScore,
    technical_readiness_score: 0, // Calculated separately
    documentation_score: documentationScore,
    governance_score: governanceScore,
    financial_transparency_score: financialScore,
    risk_flags,
    recommendations,
    created_at: new Date().toISOString(),
  };
}

// Calculate Documentation Score
function calculateDocumentationScore(project: Project): number {
  let score = 0;
  const factors = [
    project.name,
    project.technology_type,
    project.location_country,
    project.project_size_mw,
    project.capital_required,
    project.capital_structure_type,
    project.project_stage,
  ];

  const completedFactors = factors.filter(Boolean).length;
  return Math.round((completedFactors / factors.length) * 100);
}

// Calculate Technical Readiness Score
export function calculateTechnicalReadinessScore(project: Project): number {
  let score = 0;

  // Engineering Completeness (25%)
  score += project.technology_type ? TECHNICAL_READINESS_COMPONENTS.engineering_completeness : 0;

  // Grid Connection Clarity (20%)
  score += project.location_region ? TECHNICAL_READINESS_COMPONENTS.grid_connection_clarity : 0;

  // Environmental Approvals (20%)
  // Would be calculated from project documents

  // Construction Timeline Realism (20%)
  if (project.target_cod) {
    const targetDate = new Date(project.target_cod);
    const now = new Date();
    const monthsDiff = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsDiff > 6 && monthsDiff < 48) {
      score += TECHNICAL_READINESS_COMPONENTS.construction_timeline_realism;
    }
  }

  // Technical Documentation Quality (15%)
  // Would be calculated from project documents

  return Math.min(score, 100);
}

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

  // Sector Match (10%)
  const sectorMatch = partner.sector_focus?.includes(project.technology_type) ? 100 : 50;
  score += sectorMatch * CAPITAL_MATCH_WEIGHTS.sector_match;

  // Geographic Match (10%)
  const geoMatch = partner.geographic_focus?.includes(project.location_country) ? 100 : 50;
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
      capital_range_overlap: Math.round(capitalOverlap * 100),
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
  
  // Direct match in preferred_structures (legacy)
  if (partner.preferred_structures?.includes(project.capital_structure_type)) return 100;
  
  // Match in new preferred_capital_structure field
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


// Calculate Service Match
function calculateServiceMatch(required: string[], available: string[]): number {
  if (!required || required.length === 0) return 0;
  if (!available || available.length === 0) return 0;
  const matches = required.filter(s => available.includes(s));
  return (matches.length / required.length) * 100;
}

// Calculate MW Compatibility
function calculateMWCompatibility(projectMW: number, minMW: number, maxMW: number): number {
  if (!projectMW || !minMW || !maxMW) return 50;
  
  if (projectMW >= minMW && projectMW <= maxMW) {
    return 100;
  }
  
  if (projectMW < minMW) {
    return Math.max(0, 100 - ((minMW - projectMW) / minMW) * 100);
  }
  
  return Math.max(0, 100 - ((projectMW - maxMW) / maxMW) * 100);
}

// Calculate Track Record Score
function calculateTrackRecordScore(partner: TechnicalPartner): number {
  let score = 0;
  
  // Total MW delivered (40% of track record)
  score += Math.min(40, (partner.total_mw_delivered / 1000) * 40);
  
  // Largest project size (30% of track record)
  score += Math.min(30, (partner.largest_project_mw / 500) * 30);
  
  // Delivery time (30% of track record)
  if (partner.average_delivery_time_months > 0) {
    const timeScore = Math.max(0, 30 - (partner.average_delivery_time_months - 12) * 2);
    score += Math.min(30, timeScore);
  }
  
  return Math.min(100, score);
}

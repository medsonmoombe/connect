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
  const risk_flags: Record<string, unknown> = {};
  if (!project.governance_terms) risk_flags.missing_governance = true;
  if (!project.risk_disclosures) risk_flags.missing_risk_disclosure = true;
  if (aiAnalysis?.risk_flags) risk_flags.ai_flags = aiAnalysis.risk_flags;

  // Generate recommendations
  const recommendations: Record<string, unknown> = {};
  if (!project.governance_terms) recommendations.add_governance_terms = true;
  if (!project.risk_disclosures) recommendations.add_risk_disclosures = true;
  if (documentationScore < 60) recommendations.complete_documentation = true;

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
  partner: CapitalPartner
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
  const structureMatch = project.capital_structure_type && partner.preferred_structures.includes(project.capital_structure_type)
    ? 100
    : 0;
  score += structureMatch * CAPITAL_MATCH_WEIGHTS.structure_compatibility;

  // Risk Tolerance Alignment (15%)
  const riskAlignment = calculateRiskAlignment(project.risk_disclosures, partner.risk_tolerance);
  score += riskAlignment * CAPITAL_MATCH_WEIGHTS.risk_tolerance_alignment;

  // Governance Preference Alignment (15%)
  // Would be calculated from project governance terms and partner preference

  // Sector Match (10%)
  const sectorMatch = 80; // Would be calculated from technology type and sector focus
  score += sectorMatch * CAPITAL_MATCH_WEIGHTS.sector_match;

  // Geographic Match (10%)
  const geoMatch = partner.geographic_focus.includes(project.location_country) ? 100 : 50;
  score += geoMatch * CAPITAL_MATCH_WEIGHTS.geographic_match;

  const compatibilityScore = Math.round(score);

  return {
    id: '',
    project_id: project.id,
    capital_partner_id: partner.id,
    compatibility_score: compatibilityScore,
    score_breakdown: {
      capital_range_overlap: Math.round(capitalOverlap * CAPITAL_MATCH_WEIGHTS.capital_range_overlap),
      structure_compatibility: Math.round(structureMatch * CAPITAL_MATCH_WEIGHTS.structure_compatibility),
      risk_tolerance_alignment: Math.round(riskAlignment * CAPITAL_MATCH_WEIGHTS.risk_tolerance_alignment),
      sector_match: Math.round(sectorMatch * CAPITAL_MATCH_WEIGHTS.sector_match),
      geographic_match: Math.round(geoMatch * CAPITAL_MATCH_WEIGHTS.geographic_match),
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
    return Math.max(0, 100 - ((minTicket - projectCapital) / minTicket) * 100);
  }
  
  // projectCapital > maxTicket
  return Math.max(0, 100 - ((projectCapital - maxTicket) / maxTicket) * 100);
}

// Calculate Risk Alignment
function calculateRiskAlignment(riskDisclosures: string | undefined, riskTolerance: string): number {
  if (!riskDisclosures) return 50;
  
  switch (riskTolerance) {
    case 'LOW':
      return 80;
    case 'MEDIUM':
      return 90;
    case 'HIGH':
      return 100;
    default:
      return 50;
  }
}

// Technical Matching Algorithm Weights
const TECHNICAL_MATCH_WEIGHTS = {
  service_category_match: 0.25,
  sector_experience_match: 0.20,
  mw_size_compatibility: 0.20,
  geographic_coverage: 0.15,
  timeline_availability: 0.10,
  track_record_strength: 0.10,
};

// Calculate Technical Match Score
export function calculateTechnicalMatchScore(
  project: Project,
  partner: TechnicalPartner,
  requiredServices?: string[]
): TechnicalMatchResult {
  let score = 0;

  // Service Category Match (25%)
  const serviceMatch = requiredServices && requiredServices.length > 0
    ? calculateServiceMatch(requiredServices, partner.service_categories)
    : 80;
  score += serviceMatch * TECHNICAL_MATCH_WEIGHTS.service_category_match;

  // Sector Experience Match (20%)
  const sectorExpMatch = 80; // Would be calculated from technology type and sector experience
  score += sectorExpMatch * TECHNICAL_MATCH_WEIGHTS.sector_experience_match;

  // MW Size Compatibility (20%)
  const mwCompatibility = calculateMWCompatibility(
    project.project_size_mw,
    partner.min_mw_capacity,
    partner.max_mw_capacity
  );
  score += mwCompatibility * TECHNICAL_MATCH_WEIGHTS.mw_size_compatibility;

  // Geographic Coverage (15%)
  const geoCoverage = partner.regions_operated.includes(project.location_country) ? 100 : 50;
  score += geoCoverage * TECHNICAL_MATCH_WEIGHTS.geographic_coverage;

  // Timeline Availability (10%)
  const timelineAvail = 80; // Would be calculated from partner's current workload
  score += timelineAvail * TECHNICAL_MATCH_WEIGHTS.timeline_availability;

  // Track Record Strength (10%)
  const trackRecord = calculateTrackRecordScore(partner);
  score += trackRecord * TECHNICAL_MATCH_WEIGHTS.track_record_strength;

  const compatibilityScore = Math.round(score);

  return {
    id: '',
    project_id: project.id,
    technical_partner_id: partner.id,
    compatibility_score: compatibilityScore,
    score_breakdown: {
      service_category_match: Math.round(serviceMatch * TECHNICAL_MATCH_WEIGHTS.service_category_match),
      sector_experience_match: Math.round(sectorExpMatch * TECHNICAL_MATCH_WEIGHTS.sector_experience_match),
      mw_size_compatibility: Math.round(mwCompatibility * TECHNICAL_MATCH_WEIGHTS.mw_size_compatibility),
      geographic_coverage: Math.round(geoCoverage * TECHNICAL_MATCH_WEIGHTS.geographic_coverage),
      timeline_availability: Math.round(timelineAvail * TECHNICAL_MATCH_WEIGHTS.timeline_availability),
      track_record_strength: Math.round(trackRecord * TECHNICAL_MATCH_WEIGHTS.track_record_strength),
    },
    created_at: new Date().toISOString(),
  };
}

// Calculate Service Match
function calculateServiceMatch(required: string[], available: string[]): number {
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

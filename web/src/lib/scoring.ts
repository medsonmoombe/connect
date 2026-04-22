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
  const readinessScore = project.scores?.regulatory_score || 50;
  const riskAlignment = calculateRiskAlignment(project.risk_disclosures, partner.risk_tolerance, readinessScore);
  score += riskAlignment * CAPITAL_MATCH_WEIGHTS.risk_tolerance_alignment;

  // Governance Preference Alignment (15%)
  const governanceAlignment = calculateGovernanceAlignment(project.governance_terms, partner.governance_preference);
  score += governanceAlignment * CAPITAL_MATCH_WEIGHTS.governance_preference_alignment;

  // Sector Match (10%)
  const sectorMatch = partner.sector_focus.includes(project.technology_type) ? 100 : 50;
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

// Technical Matching Algorithm Weights
const TECHNICAL_MATCH_WEIGHTS = {
  service_category_match: 0.25,
  sector_experience_match: 0.20,
  mw_size_compatibility: 0.20,
  geographic_track_record: 0.35,
};

// Calculate Technical Match Score
export function calculateTechnicalMatchScore(
  project: Project,
  partner: TechnicalPartner
): TechnicalMatchResult {
  let score = 0;

  // Service Category Match (25%)
  const requiredServices = project.tech_requirements?.required_services || [];
  const serviceMatch = requiredServices.length > 0
    ? calculateServiceMatch(requiredServices, partner.service_categories)
    : 80;
  score += serviceMatch * TECHNICAL_MATCH_WEIGHTS.service_category_match;

  // Sector Experience Match (20%)
  const sectorExpMatch = partner.sector_experience.includes(project.technology_type) ? 100 : 50;
  score += sectorExpMatch * TECHNICAL_MATCH_WEIGHTS.sector_experience_match;

  // MW Size Compatibility (20%)
  const mwCompatibility = calculateMWCompatibility(
    project.project_size_mw,
    partner.min_mw_capacity,
    partner.max_mw_capacity
  );
  score += mwCompatibility * TECHNICAL_MATCH_WEIGHTS.mw_size_compatibility;

  // Geography & Track Record (35%)
  const geoMatch = partner.regions_operated.includes(project.location_country) ? 100 : 60;
  const trackRecord = calculateTrackRecordScore(partner);
  const geoTrackRecordMatch = (geoMatch * 0.6) + (trackRecord * 0.4);
  score += geoTrackRecordMatch * TECHNICAL_MATCH_WEIGHTS.geographic_track_record;

  const compatibilityScore = Math.round(score);

  return {
    id: '',
    project_id: project.id,
    technical_partner_id: partner.id,
    compatibility_score: compatibilityScore,
    score_breakdown: {
      service_category_match: Math.round(serviceMatch),
      sector_experience_match: Math.round(sectorExpMatch),
      mw_size_compatibility: Math.round(mwCompatibility),
      geographic_track_record: Math.round(geoTrackRecordMatch),
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

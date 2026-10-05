/**
 * gap-analysis.ts — Pure engine for detecting project gaps and recommending partners.
 *
 * Maps a project's current state against the User Guide's "Developer Gap Matrix"
 * and returns actionable gap items with recommended partner types.
 *
 * KISS: pure functions, no DB calls, no side effects. Easy to unit test.
 */

import type { Project, ProjectTechRequirements, ProjectScore } from '@/types';

/* ─── Public types ─────────────────────────────────────────────────────────── */

export type GapSeverity = 'critical' | 'high' | 'medium' | 'low';
export type GapStatus = 'complete' | 'partial' | 'missing';

export interface PartnerRecommendation {
  /** The type of partner needed (matches User Guide). */
  partnerType: string;
  /** The specific service/capability required. */
  service: string;
  /** Human-readable description of what the partner does. */
  description: string;
  /** Whether they're a CAPITAL, TECHNICAL, or CONSULTANT type counterparty. */
  counterpartyType: 'CAPITAL' | 'TECHNICAL' | 'CONSULTANT' | 'POWER_TRADER';
}

export interface GapItem {
  /** Unique ID within the analysis. */
  id: string;
  /** Category grouping (e.g. "Studies", "Financing", "Technical"). */
  category: string;
  /** Human-readable gap name. */
  label: string;
  /** Detailed explanation of what's missing. */
  detail: string;
  /** Current status. */
  status: GapStatus;
  /** How important filling this gap is. */
  severity: GapSeverity;
  /** Recommended partner to fill this gap. */
  recommendation: PartnerRecommendation;
  /** UI action hint. */
  actionLabel?: string;
}

export interface GapAnalysisResult {
  /** The project being analyzed. */
  projectId: string;
  /** Overall readiness percentage (0-100). */
  overallReadiness: number;
  /** Breakdown by category. */
  categoryBreakdown: Record<string, { complete: number; total: number }>;
  /** All identified gaps. */
  gaps: GapItem[];
  /** Summary text. */
  summary: string;
}

/* ─── Gap definitions (User Guide §Developer Gap Matrix) ─────────────────── */

interface GapRule {
  id: string;
  category: string;
  label: string;
  detail: string;
  severity: GapSeverity;
  recommendation: PartnerRecommendation;
  /** Checks if the gap is filled. Returns 'complete', 'partial', or 'missing'. */
  check: (project: Project, scores?: ProjectScore | null, techReqs?: ProjectTechRequirements | null) => GapStatus;
}

const GAP_RULES: GapRule[] = [
  // ── Project Form (grouped in UI as "Complete Form") ──────────────────────
  {
    id: 'form_description',
    category: 'Project Form',
    label: 'Project Description',
    detail: 'Describe your project in the project creation form.',
    severity: 'critical',
    recommendation: {
      partnerType: '',
      service: '',
      description: '',
      counterpartyType: 'TECHNICAL',
    },
    check: (p) => projectField(p, 'description') && String(projectField(p, 'description')).trim().length > 10 ? 'complete' : 'missing',
  },
  {
    id: 'form_technology_type',
    category: 'Project Form',
    label: 'Technology Type',
    detail: 'Choose solar, wind, hydro, battery, or other.',
    severity: 'critical',
    recommendation: {
      partnerType: '',
      service: '',
      description: '',
      counterpartyType: 'TECHNICAL',
    },
    check: (p) => projectField(p, 'technology_type') ? 'complete' : 'missing',
  },
  {
    id: 'form_location',
    category: 'Project Form',
    label: 'Location',
    detail: 'Specify country and region for your project.',
    severity: 'critical',
    recommendation: {
      partnerType: '',
      service: '',
      description: '',
      counterpartyType: 'TECHNICAL',
    },
    check: (p) => projectField(p, 'location_country') ? 'complete' : 'missing',
  },
  // ── Studies & Advisory ─────────────────────────────────────────────────
  {
    id: 'feasibility_study',
    category: 'Studies & Advisory',
    label: 'Feasibility Study',
    detail: 'A technical feasibility study is critical for validating project viability and attracting investors.',
    severity: 'critical',
    recommendation: {
      partnerType: 'Technical Consultant',
      service: 'FEASIBILITY_STUDY',
      description: 'Complete studies and improve project readiness',
      counterpartyType: 'CONSULTANT',
    },
    check: (p) => hasDocumentOfType(p, 'FEASIBILITY') ? 'complete' : 'missing',
  },
  {
    id: 'financial_model',
    category: 'Studies & Advisory',
    label: 'Financial Model',
    detail: 'A robust financial model demonstrates return projections and capital structure viability.',
    severity: 'high',
    recommendation: {
      partnerType: 'Financial Consultant',
      service: 'FINANCIAL_ADVISORY',
      description: 'Build bankable financial projections',
      counterpartyType: 'CONSULTANT',
    },
    check: (p) => hasDocumentOfType(p, 'FINANCIAL') ? 'complete' : 'missing',
  },
  {
    id: 'environmental_assessment',
    category: 'Studies & Advisory',
    label: 'Environmental Impact Assessment',
    detail: 'EIA is required for regulatory approval and permitting in most jurisdictions.',
    severity: 'high',
    recommendation: {
      partnerType: 'Environmental Consultant',
      service: 'ENVIRONMENTAL_IMPACT',
      description: 'Conduct environmental and social impact studies',
      counterpartyType: 'CONSULTANT',
    },
    check: (p) => hasDocumentOfType(p, 'ENVIRONMENTAL') ? 'complete' : 'missing',
  },
  {
    id: 'grid_study',
    category: 'Studies & Advisory',
    label: 'Grid Connection Study',
    detail: 'A grid study confirms interconnection feasibility and associated costs.',
    severity: 'high',
    recommendation: {
      partnerType: 'Engineering Consultant',
      service: 'FEASIBILITY_STUDY',
      description: 'Assess grid interconnection requirements',
      counterpartyType: 'CONSULTANT',
    },
    check: (p) => techField(p, 'grid_status') && String(techField(p, 'grid_status')) !== 'PENDING'
      ? 'complete' : 'missing',
  },
  // ── Technical / EPC ───────────────────────────────────────────────────
  {
    id: 'epc_services',
    category: 'Technical',
    label: 'EPC Contractor',
    detail: 'An EPC contractor is needed for detailed design, procurement, and construction.',
    severity: 'medium',
    recommendation: {
      partnerType: 'EPC Contractor',
      service: 'EPC',
      description: 'Design and construct the project',
      counterpartyType: 'TECHNICAL',
    },
    check: (p) => {
      const selected = (techField(p, 'required_services') as string[]) ?? [];
      return selected.includes('EPC') ? 'complete' : 'missing';
    },
  },
  // ── Financing ─────────────────────────────────────────────────────────
  {
    id: 'ppa_offtake',
    category: 'Commercial',
    label: 'PPA / Offtake Partner',
    detail: 'A power purchase agreement or bankable offtake route is needed before many financiers can proceed.',
    severity: 'high',
    recommendation: {
      partnerType: 'Power Trader',
      service: 'PPA_OFFTAKE',
      description: 'Secure offtake or PPA support for the project',
      counterpartyType: 'POWER_TRADER',
    },
    check: (p) => {
      const ppaStatus = String(techField(p, 'ppa_status') || '');
      return ppaStatus === 'SECURED' ? 'complete' : ppaStatus === 'IN_PROGRESS' ? 'partial' : 'missing';
    },
  },  {
    id: 'debt_financing',
    category: 'Financing',
    label: 'Debt / Construction Financing',
    detail: 'Senior debt or mezzanine financing is typically required for construction phase.',
    severity: 'medium',
    recommendation: {
      partnerType: 'Commercial Bank / DFI',
      service: 'DEBT',
      description: 'Provide construction and long-term debt financing',
      counterpartyType: 'CAPITAL',
    },
    check: (p) => {
      const capType = String(projectField(p, 'capital_structure_type') || '');
      if (capType === 'DEBT') return 'complete';
      return capType && ['EQUITY'].includes(capType)
        ? 'missing' // Equity-only projects still may need debt
        : 'partial';
    },
  },
  {
    id: 'equity_investment',
    category: 'Financing',
    label: 'Equity Investment',
    detail: 'Equity capital from institutional investors or infrastructure funds.',
    severity: 'medium',
    recommendation: {
      partnerType: 'Infrastructure Fund',
      service: 'EQUITY',
      description: 'Provide equity capital for project development',
      counterpartyType: 'CAPITAL',
    },
    check: (p) => {
      const capType = String(projectField(p, 'capital_structure_type') || '');
      return capType === 'EQUITY' || capType === 'PROFIT_SHARING'
        ? 'complete' : 'missing';
    },
  },
  {
    id: 'grant_funding',
    category: 'Financing',
    label: 'Grant / Concessional Funding',
    detail: 'Grant funding from development partners can support early-stage project preparation.',
    severity: 'low',
    recommendation: {
      partnerType: 'Development Partner',
      service: 'GRANT',
      description: 'Provide grant funding for project preparation',
      counterpartyType: 'CAPITAL',
    },
    check: (p) => String(projectField(p, 'capital_structure_type') || '') === 'GRANT' ? 'complete' : 'missing',
  },
  // ── Commercial / Structured Finance ───────────────────────────────────
  {
    id: 'carbon_credits',
    category: 'Commercial',
    label: 'Carbon Credit Registration',
    detail: 'Carbon credit revenue streams can significantly improve project economics.',
    severity: 'low',
    recommendation: {
partnerType: 'Carbon Finance Specialist',
      service: 'ENVIRONMENTAL_IMPACT',
      description: 'Advise on carbon credit monetization strategies',
      counterpartyType: 'CONSULTANT',
    },
    check: () => 'missing', // Always show — carbon is an upsell opportunity
  },
  {
    id: 'transaction_advisory',
    category: 'Commercial',
    label: 'Transaction Advisory',
    detail: 'An investment advisor can help structure the deal and negotiate terms.',
    severity: 'low',
    recommendation: {
partnerType: 'Investment Advisor',
      service: 'FINANCIAL_ADVISORY',
      description: 'Structure the financing and prepare the data room',
      counterpartyType: 'CONSULTANT',
    },
    check: (p) => {
      const hasDocs = hasDocumentOfType(p, 'FINANCIAL') || hasDocumentOfType(p, 'LEGAL');
      const hasScore = (p.scores?.financial_transparency_score ?? 0) >= 70;
      return hasDocs && hasScore ? 'complete' : hasDocs ? 'partial' : 'missing';
    },
  },
  // ── Regulatory ────────────────────────────────────────────────────────
  {
    id: 'regulatory_approvals',
    category: 'Regulatory',
    label: 'Regulatory Permits & Licences',
    detail: 'All required permits and licences must be secured before financial close.',
    severity: 'high',
    recommendation: {
      partnerType: 'Legal Advisor',
      service: 'LEGAL_ADVISORY',
      description: 'Navigate regulatory requirements and secure permits',
      counterpartyType: 'CONSULTANT',
    },
    check: (p) => {
      const approvals = (projectField(p, 'regulatory_approvals') as string[]) ?? [];
      return approvals.length >= 2 ? 'complete' : approvals.length >= 1 ? 'partial' : 'missing';
    },
  },
  {
    id: 'land_rights',
    category: 'Regulatory',
    label: 'Land Rights & Security',
    detail: 'Secured land rights are essential for project bankability.',
    severity: 'high',
    recommendation: {
      partnerType: 'Legal Advisor',
      service: 'LEGAL_ADVISORY',
      description: 'Secure land rights and title documentation',
      counterpartyType: 'CONSULTANT',
    },
    check: (p) => projectField(p, 'has_secured_land') ? 'complete' : 'missing',
  },
];

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function hasDocumentOfType(project: Project, typePrefix: string): boolean {
  const docs = project.documents ?? [];
  const prefix = typePrefix.toUpperCase();
  return docs.some(d => {
    const docType = (d.document_type ?? '').toUpperCase();
    const fileName = ((d as any).file_name ?? d.file_url ?? '').toUpperCase();
    return docType.startsWith(prefix) || fileName.startsWith(prefix) || fileName.includes(prefix);
  });
}

/** Read a field from the project, falling back to the extra_data JSONB blob. */
function projectField(project: Project, key: string): unknown {
  const direct = (project as any)[key];
  if (direct !== undefined && direct !== null && direct !== '') return direct;
  const extra = (project as any).extra_data;
  if (extra && typeof extra === 'object') {
    const val = (extra as Record<string, unknown>)[key];
    if (val !== undefined && val !== null && val !== '') return val;
  }
  return undefined;
}

/** Read tech_requirements field, falling back to extra_data JSONB. */
function techField(project: Project, key: string): unknown {
  const tr = project.tech_requirements;
  if (tr) {
    const direct = (tr as any)[key];
    if (direct !== undefined && direct !== null && direct !== '') return direct;
  }
  const extra = (project as any).extra_data;
  if (extra && typeof extra === 'object') {
    const trExtra = (extra as Record<string, unknown>).tech_requirements;
    if (trExtra && typeof trExtra === 'object') {
      const val = (trExtra as Record<string, unknown>)[key];
      if (val !== undefined && val !== null && val !== '') return val;
    }
  }
  return undefined;
}

/* ─── Public API ───────────────────────────────────────────────────────────── */

/**
 * Run a full gap analysis on a project.
 * Pure function — no DB calls, no side effects.
 */
export function analyzeProjectGaps(
  project: Project,
  scores?: ProjectScore | null,
): GapAnalysisResult {
  const techReqs = project.tech_requirements ?? null;
  const projectScores = scores ?? project.scores ?? null;

  const gaps: GapItem[] = [];
  const categoryCounts = new Map<string, { complete: number; total: number }>();

  for (const rule of GAP_RULES) {
    const status = rule.check(project, projectScores, techReqs);

    // Track category progress
    const cat = categoryCounts.get(rule.category) ?? { complete: 0, total: 0 };
    cat.total++;
    if (status === 'complete') cat.complete++;
    categoryCounts.set(rule.category, cat);

    // Only include if not complete (or if the rule is always shown)
    if (status !== 'complete' || rule.id === 'carbon_credits') {
      gaps.push({
        id: rule.id,
        category: rule.category,
        label: rule.label,
        detail: rule.detail,
        status,
        severity: rule.severity,
        recommendation: rule.recommendation,
        actionLabel: status === 'missing'
          ? `Find ${rule.recommendation.partnerType}`
          : 'Improve',
      });
    }
  }

  // Calculate overall readiness from all categories
  let totalComplete = 0;
  let totalItems = 0;
  for (const [, counts] of categoryCounts) {
    totalComplete += counts.complete;
    totalItems += counts.total;
  }
  const overallReadiness = totalItems > 0
    ? Math.round((totalComplete / totalItems) * 100)
    : 0;

  // Build summary
  const criticalGaps = gaps.filter(g => g.severity === 'critical').length;
  const highGaps = gaps.filter(g => g.severity === 'high').length;

  const summary = overallReadiness >= 80
    ? 'Your project is well-prepared. Address remaining gaps to maximise partner interest.'
    : overallReadiness >= 50
      ? `${criticalGaps + highGaps} priority gap${criticalGaps + highGaps !== 1 ? 's' : ''} to address before seeking partners.`
      : `${criticalGaps} critical gap${criticalGaps !== 1 ? 's' : ''} and ${highGaps} high-priority gap${highGaps !== 1 ? 's' : ''} identified. Start with feasibility and regulatory items.`;

  return {
    projectId: project.id,
    overallReadiness,
    categoryBreakdown: Object.fromEntries(categoryCounts),
    gaps,
    summary,
  };
}

/**
 * Count how many critical/blocking gaps exist.
 */
export function countBlockingGaps(result: GapAnalysisResult): number {
  return result.gaps.filter(g => g.severity === 'critical' || g.severity === 'high').length;
}


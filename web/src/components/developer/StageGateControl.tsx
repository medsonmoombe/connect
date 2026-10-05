'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Project } from '@/types';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

const STAGES = [
  { key: 'CONCEPT', label: 'Concept', number: 1, description: 'Initial project idea and basic information' },
  { key: 'PRE_FEASIBILITY', label: 'Pre-Feasibility', number: 2, description: 'Preliminary technical and economic assessment' },
  { key: 'FULL_FEASIBILITY', label: 'Full Feasibility', number: 3, description: 'Detailed feasibility study and technical analysis' },
  { key: 'REGULATORY_APPROVAL', label: 'Regulatory Approval', number: 4, description: 'Government permits and regulatory clearances' },
  { key: 'PPA_READY', label: 'PPA Ready', number: 5, description: 'Offtake secured or well advanced — preparing for financing' },
  { key: 'FINANCIAL_CLOSE', label: 'Financial Close', number: 6, description: 'Secured financing and investment agreements' },
  { key: 'CONSTRUCTION', label: 'Construction', number: 7, description: 'EPC contractor engaged, construction underway' },
  { key: 'OPERATION', label: 'Operation', number: 8, description: 'Commercial operation and power delivery' },
] as const;

const STAGE_COLORS = [
  { bg: 'bg-slate-500', light: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  { bg: 'bg-blue-500', light: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  { bg: 'bg-indigo-500', light: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  { bg: 'bg-violet-500', light: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  { bg: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  { bg: 'bg-green-500', light: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  { bg: 'bg-emerald-500', light: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  { bg: 'bg-emerald-600', light: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
];

// Each requirement now has: what it is, what type of action, and where to go
interface StageRequirement {
  label: string;
  actionType: 'upload' | 'find_partner' | 'run_analysis' | 'complete_form' | 'contact';
  actionHref: string;
  actionLabel: string;
  description: string;
  partnerType?: string; // for find_partner
}

const STAGE_REQUIREMENTS: Record<string, StageRequirement[]> = {
  CONCEPT: [
    { label: 'Project description', actionType: 'complete_form', actionHref: '/developer/submit', actionLabel: 'Complete Form', description: 'Describe your project in the project creation form' },
    { label: 'Technology type', actionType: 'complete_form', actionHref: '/developer/submit', actionLabel: 'Select Technology', description: 'Choose solar, wind, hydro, battery, or other' },
    { label: 'Location', actionType: 'complete_form', actionHref: '/developer/submit', actionLabel: 'Add Location', description: 'Specify country and region for your project' },
  ],
  PRE_FEASIBILITY: [
    { label: 'Pre-feasibility study', actionType: 'upload', actionHref: '/developer/data-room', actionLabel: 'Upload Document', description: 'Upload your pre-feasibility study report to the data room' },
    { label: 'Site assessment', actionType: 'upload', actionHref: '/developer/data-room', actionLabel: 'Upload Document', description: 'Upload site survey and assessment documents' },
    { label: 'Preliminary financial model', actionType: 'upload', actionHref: '/developer/data-room', actionLabel: 'Upload Document', description: 'Upload your initial financial projections' },
    { label: 'Environmental screening', actionType: 'find_partner', actionHref: '/developer/find-partners', actionLabel: 'Find Consultant', description: 'An environmental consultant can conduct screening', partnerType: 'Environmental Consultant' },
    { label: 'Grid connection study', actionType: 'find_partner', actionHref: '/developer/find-partners', actionLabel: 'Find Consultant', description: 'An engineering consultant can assess grid connection', partnerType: 'Engineering Consultant' },
  ],
  FULL_FEASIBILITY: [
    { label: 'Full feasibility study', actionType: 'upload', actionHref: '/developer/data-room', actionLabel: 'Upload Document', description: 'Upload the complete feasibility study report' },
    { label: 'ESIA report', actionType: 'find_partner', actionHref: '/developer/find-partners', actionLabel: 'Find Consultant', description: 'An environmental consultant can prepare the ESIA', partnerType: 'Environmental Consultant' },
    { label: 'Grid study', actionType: 'find_partner', actionHref: '/developer/find-partners', actionLabel: 'Find Consultant', description: 'An engineering consultant can conduct the grid study', partnerType: 'Engineering Consultant' },
    { label: 'Financial model', actionType: 'upload', actionHref: '/developer/data-room', actionLabel: 'Upload Document', description: 'Upload the detailed financial model with projections' },
    { label: 'Land title', actionType: 'find_partner', actionHref: '/developer/find-partners', actionLabel: 'Find Consultant', description: 'A legal consultant can help secure land rights', partnerType: 'Legal Consultant' },
    { label: 'Community engagement report', actionType: 'find_partner', actionHref: '/developer/find-partners', actionLabel: 'Find Consultant', description: 'A consultant can conduct community consultations', partnerType: 'Community Engagement Consultant' },
  ],
  REGULATORY_APPROVAL: [
    { label: 'Environmental permit', actionType: 'find_partner', actionHref: '/developer/find-partners', actionLabel: 'Find Consultant', description: 'A regulatory consultant can guide you through the permit process', partnerType: 'Regulatory Consultant' },
    { label: 'Generation license', actionType: 'contact', actionHref: '/engagements', actionLabel: 'Contact Regulator', description: 'Apply to the energy regulator for a generation license' },
    { label: 'Land title', actionType: 'find_partner', actionHref: '/developer/find-partners', actionLabel: 'Find Consultant', description: 'A legal consultant can help finalize land title', partnerType: 'Legal Consultant' },
    { label: 'Grid connection agreement', actionType: 'find_partner', actionHref: '/developer/find-partners', actionLabel: 'Find Consultant', description: 'An engineering consultant can negotiate grid connection', partnerType: 'Engineering Consultant' },
  ],
  FINANCIAL_CLOSE: [
    { label: 'Financial model', actionType: 'upload', actionHref: '/developer/data-room', actionLabel: 'Upload Document', description: 'Upload the final financial model for investor review' },
    { label: 'Term sheet', actionType: 'find_partner', actionHref: '/developer/find-partners', actionLabel: 'Find Investor', description: 'Institutional investors can provide term sheets', partnerType: 'Institutional Investor' },
    { label: 'PPA (Power Purchase Agreement)', actionType: 'find_partner', actionHref: '/developer/find-partners', actionLabel: 'Find Trader', description: 'A power trader or utility can sign a PPA', partnerType: 'Power Trader' },
    { label: 'Insurance', actionType: 'find_partner', actionHref: '/developer/find-partners', actionLabel: 'Find Partner', description: 'An insurance broker can arrange project insurance', partnerType: 'Insurance Broker' },
    { label: 'Equity commitment', actionType: 'find_partner', actionHref: '/developer/find-partners', actionLabel: 'Find Investor', description: 'An equity investor can commit capital', partnerType: 'Equity Investor' },
    { label: 'Debt commitment', actionType: 'find_partner', actionHref: '/developer/find-partners', actionLabel: 'Find Lender', description: 'A DFI or bank can provide debt financing', partnerType: 'Debt Provider' },
  ],
  CONSTRUCTION: [
    { label: 'EPC contract', actionType: 'find_partner', actionHref: '/developer/find-partners', actionLabel: 'Find EPC', description: 'An EPC contractor can design and build the project', partnerType: 'EPC Contractor' },
    { label: 'Insurance', actionType: 'find_partner', actionHref: '/developer/find-partners', actionLabel: 'Find Partner', description: 'Arrange construction all-risk insurance', partnerType: 'Insurance Provider' },
    { label: 'Performance guarantee', actionType: 'find_partner', actionHref: '/developer/find-partners', actionLabel: 'Find Partner', description: 'EPC contractor provides performance guarantee', partnerType: 'EPC Contractor' },
    { label: 'O&M contract', actionType: 'find_partner', actionHref: '/developer/find-partners', actionLabel: 'Find Operator', description: 'An O&M company can operate the plant', partnerType: 'O&M Operator' },
  ],
  PPA_READY: [
    { label: 'PPA draft or signed', actionType: 'upload', actionHref: '/developer/data-room', actionLabel: 'Upload Document', description: 'Upload your Power Purchase Agreement or draft' },
    { label: 'Offtaker credit assessment', actionType: 'find_partner', actionHref: '/developer/find-partners', actionLabel: 'Find Consultant', description: 'A consultant can assess offtaker creditworthiness', partnerType: 'Consultant' },
    { label: 'Tariff analysis', actionType: 'find_partner', actionHref: '/developer/find-partners', actionLabel: 'Find Consultant', description: 'Get expert tariff and PPA structuring advice', partnerType: 'Financial' },
  ],
  OPERATION: [
    { label: 'Commercial operation certificate', actionType: 'contact', actionHref: '/engagements', actionLabel: 'Contact Regulator', description: 'Request COD certificate from the energy regulator' },
    { label: 'Performance monitoring', actionType: 'upload', actionHref: '/developer/data-room', actionLabel: 'Upload Data', description: 'Upload monthly performance reports' },
  ],
};

const PEER_BENCHMARKS: Record<string, { avgDays: number; successRate: number }> = {
  CONCEPT:              { avgDays: 30, successRate: 95 },
  PRE_FEASIBILITY:      { avgDays: 60, successRate: 85 },
  FULL_FEASIBILITY:     { avgDays: 90, successRate: 75 },
  REGULATORY_APPROVAL:  { avgDays: 120, successRate: 65 },
  PPA_READY:            { avgDays: 90, successRate: 70 },
  FINANCIAL_CLOSE:      { avgDays: 180, successRate: 55 },
  CONSTRUCTION:         { avgDays: 365, successRate: 90 },
  OPERATION:            { avgDays: 0, successRate: 100 },
};

// Map requirement labels to document types for checking
const REQUIREMENT_DOC_MAP: Record<string, string[]> = {
  'Project description': ['description', 'project_description', 'project_desc'],
  'Technology type': ['technology', 'technology_type', 'tech_type'],
  'Location': ['location', 'country', 'region', 'site_location'],
  'Pre-feasibility study': ['feasibility', 'pre-feasibility', 'prefeasibility', 'pre_feas', 'feas'],
  'Site assessment': ['site', 'assessment', 'survey', 'site_survey', 'site_assessment'],
  'Preliminary financial model': ['financial', 'model', 'projections', 'fin_model', 'projections'],
  'Environmental screening': ['environmental', 'screening', 'eia', 'env_screen'],
  'Grid connection study': ['grid', 'connection', 'transmission', 'grid_study', 'grid_connection'],
  'Full feasibility study': ['feasibility', 'full_feasibility', 'full_feas', 'feas'],
  'ESIA report': ['esia', 'environmental', 'social_impact', 'social', 'impact_assessment'],
  'Grid study': ['grid', 'transmission', 'connection', 'grid_study'],
  'Financial model': ['financial', 'model', 'projections', 'fin_model', 'financial_model'],
  'Land title': ['land', 'title', 'deed', 'land_title', 'title_deed'],
  'Community engagement report': ['community', 'engagement', 'stakeholder', 'community_engagement'],
  'Environmental permit': ['environmental', 'permit', 'license', 'licence', 'env_permit'],
  'Generation license': ['generation', 'license', 'licence', 'gen_license'],
  'Grid connection agreement': ['grid', 'agreement', 'connection', 'grid_agreement'],
  'Term sheet': ['term', 'sheet', 'investment', 'term_sheet'],
  'PPA (Power Purchase Agreement)': ['ppa', 'purchase', 'agreement', 'power_purchase'],
  'Insurance': ['insurance', 'policy', 'insurance_policy'],
  'Equity commitment': ['equity', 'commitment', 'investment', 'equity_commitment'],
  'Debt commitment': ['debt', 'loan', 'financing', 'debt_commitment'],
  'EPC contract': ['epc', 'contract', 'construction', 'epc_contract'],
  'Performance guarantee': ['performance', 'guarantee', 'warranty', 'perf_guarantee'],
  'O&M contract': ['om', 'operation', 'maintenance', 'om_contract', 'operations'],
  'Test results': ['test', 'commissioning', 'performance', 'test_results', 'commissioning_test'],
  'Grid connection certificate': ['grid', 'certificate', 'connection', 'grid_certificate'],
  'Safety certification': ['safety', 'certification', 'audit', 'safety_cert'],
  'Commercial operation certificate': ['cod', 'commercial', 'operation', 'commercial_operation'],
  'Performance monitoring': ['performance', 'monitoring', 'report', 'perf_monitoring', 'performance_report'],
};

function resolveActionHref(href: string, projectId: string, requirementLabel?: string): string {
  const params: string[] = [];
  if (href.includes('/submit') || href.includes('/developer/submit')) {
    // Edit mode: open the submit form pre-filled with the existing project
    params.push(`edit=${projectId}`);
  } else if (href.includes('tab=dataroom') || href.includes('tab=find-partners')) {
    params.push(`project=${projectId}`);
  }
  if (requirementLabel && href.includes('tab=dataroom')) {
    params.push(`requirement=${encodeURIComponent(requirementLabel)}`);
  }
  if (params.length === 0) return href;
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}${params.join('&')}`;
}

function getActionIcon(type: string) {
  switch (type) {
    case 'upload': return <Icons.upload className="size-3" />;
    case 'find_partner': return <Icons.search className="size-3" />;
    case 'run_analysis': return <Icons.refreshCw className="size-3" />;
    case 'complete_form': return <Icons.pencil className="size-3" />;
    case 'contact': return <Icons.send className="size-3" />;
    default: return <Icons.arrowRight className="size-3" />;
  }
}

function getActionColor(type: string) {
  switch (type) {
    case 'upload': return 'bg-amber-500 hover:bg-amber-600';
    case 'find_partner': return 'bg-blue-600 hover:bg-blue-700';
    case 'run_analysis': return 'bg-violet-600 hover:bg-violet-700';
    case 'complete_form': return 'bg-green-600 hover:bg-green-700';
    case 'contact': return 'bg-slate-700 hover:bg-slate-800';
    default: return 'bg-primary hover:bg-primary/90';
  }
}

// Map complete_form requirement labels to the project fields that satisfy them
const FORM_FIELD_CHECKS: Record<string, (project: Project) => boolean> = {
  'Project description': (p) => !!(p.description && p.description.trim().length > 10),
  'Technology type': (p) => !!(p.technology_type && p.technology_type.trim().length > 0),
  'Location': (p) => !!(p.location_country && p.location_country.trim().length > 0),
};

function isRequirementMet(req: StageRequirement, project: Project): boolean {
  const docs = project.documents || [];

  // ── complete_form: check the actual project field ──
  if (req.actionType === 'complete_form') {
    const checker = FORM_FIELD_CHECKS[req.label];
    return checker ? checker(project) : false;
  }

  // ── upload: check if a matching document exists ──
  if (req.actionType === 'upload') {
    const keywords = REQUIREMENT_DOC_MAP[req.label] || [];
    if (keywords.length === 0) return false;
    return docs.some((doc) => {
      // Check document_type, storage_path, and file_url
      const haystack = [
        doc.document_type || '',
        doc.storage_path || '',
        doc.file_url || '',
      ].join(' ').toLowerCase();
      return keywords.some((kw) => haystack.includes(kw));
    });
  }

  // ── find_partner / contact / run_analysis: these are actions the user
  //    must take — they don't have a binary met/unmet state from data alone.
  //    Always show as needing action so the progress reflects real completion.
  return false;
}

export function StageGateControl({
  projects,
  selectedProject,
  onSelectProject,
}: {
  projects: Project[];
  selectedProject: string | null;
  onSelectProject: (id: string) => void;
}) {
  const targetId = selectedProject || projects[0]?.id;
  const project = projects.find((p) => p.id === targetId) || projects[0];

  const currentStageIdx = useMemo(() => {
    if (!project) return 0;
    return STAGES.findIndex((s) => s.key === project.project_stage) ?? 0;
  }, [project]);

  if (!project) {
    return (
      <div className="py-12 text-center bg-white rounded-none border border-dashed border-slate-200">
        <Icons.folder className="size-8 text-slate-200 mx-auto mb-3" />
        <h4 className="text-sm font-bold text-slate-700 mb-1">No Projects</h4>
        <p className="text-xs text-slate-400 font-medium">Create a project to see the stage gate control.</p>
        <Link href="/developer/submit" className="inline-flex items-center gap-1 mt-3 text-xs font-bold text-primary hover:underline">
          <Icons.plus className="size-3" /> Create Project
        </Link>
      </div>
    );
  }

  const currentStage = STAGES[currentStageIdx];
  const nextStage = currentStageIdx < STAGES.length - 1 ? STAGES[currentStageIdx + 1] : null;
  const requirements = STAGE_REQUIREMENTS[currentStage.key] || [];
  const benchmark = PEER_BENCHMARKS[currentStage.key];

  const daysInStage = Math.floor(
    (Date.now() - new Date(project.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  const isOverdue = benchmark && daysInStage > benchmark.avgDays;

  // Check which requirements are met
  const requirementStatus = requirements.map((req) => ({
    ...req,
    met: isRequirementMet(req, project),
  }));

  const metCount = requirementStatus.filter((r) => r.met).length;
  const totalCount = requirementStatus.length;
  const completionPercent = totalCount > 0 ? Math.round((metCount / totalCount) * 100) : 0;

  const missingReqs = requirementStatus.filter((r) => !r.met);
  const metReqs = requirementStatus.filter((r) => r.met);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="dash-section-label mb-1">Stage Gate</p>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Stage Gate Control</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Track requirements and take action for each stage of {project.name}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {projects.length > 1 && (
            <SearchableSelect
              value={targetId || ''}
              onChange={(val) => onSelectProject(val)}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Select project..."
              className="w-64"
            />
          )}
        </div>
      </div>

      {/* Visual Pipeline */}
      <div className="bg-white rounded-none border border-slate-100 shadow-soft p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900">Project Lifecycle</h3>
          <span className={cn(
            'px-2.5 py-1 rounded-none text-[10px] font-bold tracking-wider border',
            isOverdue ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-green-50 text-green-700 border-green-100'
          )}>
            {isOverdue ? `Overdue by ${daysInStage - benchmark.avgDays}d` : 'On Track'}
          </span>
        </div>

        <div className="relative">
          <div className="flex items-center gap-0">
            {STAGES.map((stage, idx) => {
              const isPast = idx < currentStageIdx;
              const isCurrent = idx === currentStageIdx;
              const color = STAGE_COLORS[idx];

              return (
                <div key={stage.key} className="flex-1 relative">
                  <div className="flex justify-center mb-2">
                    <div className={cn(
                      'size-8 rounded-full flex items-center justify-center border-2 transition-all z-10 relative',
                      isPast ? `${color.bg} border-transparent text-white` :
                      isCurrent ? `${color.bg} border-transparent text-white ring-4 ring-opacity-20` :
                      `bg-white border-slate-200 text-slate-400`
                    )}>
                      {isPast ? <Icons.check className="size-4" /> : <span className="text-xs font-bold">{stage.number}</span>}
                    </div>
                  </div>
                  <div className="text-center">
                    <p className={cn('text-[9px] font-bold tracking-wider', isCurrent ? color.text : isPast ? 'text-slate-600' : 'text-slate-400')}>
                      {stage.label}
                    </p>
                  </div>
                  {idx < STAGES.length - 1 && (
                    <div className={cn('absolute top-4 left-1/2 w-full h-0.5', isPast ? color.bg : 'bg-slate-200')} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── What To Do Next (Priority Section) ────────────────────────── */}
      {missingReqs.length > 0 && (
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-none border border-primary/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="size-8 rounded-none bg-primary/10 flex items-center justify-center">
              <Icons.target className="size-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">What To Do Next</h3>
              <p className="text-[10px] font-bold text-slate-400 tracking-wider">
                {missingReqs.length} action{missingReqs.length > 1 ? 's' : ''} needed to advance to {nextStage?.label || 'next stage'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {missingReqs.slice(0, 5).map((req, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded-none border border-slate-100 shadow-sm">
                <div className="size-7 rounded-none bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-primary">{idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900">{req.label}</p>
                  <p className="text-[10px] text-slate-400 font-medium truncate">{req.description}</p>
                </div>
                <Link
                  href={resolveActionHref(req.actionHref, project.id, req.label)}
                  className={cn(
                    'h-7 px-3 rounded-none text-[10px] font-bold text-white transition-colors flex items-center gap-1.5 shrink-0',
                    getActionColor(req.actionType)
                  )}
                >
                  {getActionIcon(req.actionType)}
                  {req.actionLabel}
                </Link>
              </div>
            ))}
            {missingReqs.length > 5 && (
              <p className="text-[10px] font-bold text-slate-400 tracking-wider text-center pt-1">
                +{missingReqs.length - 5} more actions below
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Low Score: Request Consultant Help ────────────────────────── */}
      {(project.scores?.capital_readiness_score ?? 0) < 40 && (project.scores?.capital_readiness_score ?? 0) > 0 && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-none border border-amber-200 p-6">
          <div className="flex items-center gap-4">
            <div className="size-11 rounded-none bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
              <Icons.headphones className="size-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-900">Need Help Improving Your Project?</h3>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                Your project scored {project.scores?.capital_readiness_score ?? 0}%. Our consultants can help you complete documentation and raise your readiness score.
              </p>
            </div>
            <Link
              href={`/developer/consultation-request?project=${project.id}`}
              className="h-9 px-5 rounded-none bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors shrink-0 inline-flex items-center gap-2"
            >
              <Icons.headphones className="size-3.5" /> Request Help
            </Link>
          </div>
        </div>
      )}

      {/* All requirements met */}
      {missingReqs.length === 0 && nextStage && (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-none border border-green-100 p-6">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-none bg-green-100 flex items-center justify-center">
              <Icons.checkCircle2 className="size-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-green-800">Stage Requirements Complete</h3>
              <p className="text-xs text-green-600 font-medium mt-0.5">
                All requirements for Stage {currentStage.number} are met. You're ready to advance to {nextStage.label}.
              </p>
            </div>
            <Link
              href={`/projects/${project.id}`}
              className="h-9 px-4 rounded-none bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-colors shrink-0"
            >
              Advance Stage
            </Link>
          </div>
        </div>
      )}

      {/* Current Stage Details */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Requirements Checklist */}
        <div className="lg:col-span-2 bg-white rounded-none border border-slate-100 shadow-soft p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={cn('size-8 rounded-none flex items-center justify-center', STAGE_COLORS[currentStageIdx].light)}>
                <Icons.clipboardCheck className={cn('size-4', STAGE_COLORS[currentStageIdx].text)} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Stage {currentStage.number}: {currentStage.label}</h3>
                <p className="text-[10px] font-bold text-slate-400 tracking-wider">{currentStage.description}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-primary">{completionPercent}%</p>
              <p className="text-[9px] font-bold text-slate-400 tracking-widest">{metCount}/{totalCount} COMPLETE</p>
            </div>
          </div>

          {/* Completion Bar */}
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-5">
            <div
              className={cn('h-full rounded-full transition-all duration-500', completionPercent === 100 ? 'bg-green-500' : 'bg-primary')}
              style={{ width: `${completionPercent}%` }}
            />
          </div>

          {/* Met Requirements */}
          {metReqs.length > 0 && (
            <div className="space-y-2 mb-4">
              <h4 className="text-[10px] font-bold text-green-600 tracking-[0.12em] uppercase flex items-center gap-1.5">
                <Icons.checkCircle2 className="size-3" /> Completed ({metReqs.length})
              </h4>
              {metReqs.map((req, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-none bg-green-50/50 border border-green-100/50">
                  <div className="size-6 rounded-full bg-green-100 flex items-center justify-center">
                    <Icons.check className="size-3 text-green-600" />
                  </div>
                  <span className="text-xs font-bold text-slate-600 line-through decoration-green-400">{req.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Missing Requirements with Actions */}
          {missingReqs.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-red-500 tracking-[0.12em] uppercase flex items-center gap-1.5">
                <Icons.alertTriangle className="size-3" /> Missing ({missingReqs.length})
              </h4>
              {missingReqs.map((req, idx) => (
                <div key={idx} className="p-3 rounded-none bg-red-50/30 border border-red-100/50">
                  <div className="flex items-start gap-3">
                    <div className="size-6 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Icons.x className="size-3 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900">{req.label}</p>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">{req.description}</p>
                      {req.partnerType && (
                        <p className="text-[9px] text-primary font-bold tracking-wider mt-1">
                          Recommended: {req.partnerType}
                        </p>
                      )}
                    </div>
                    <Link
                      href={resolveActionHref(req.actionHref, project.id, req.label)}
                      className={cn(
                        'h-7 px-3 rounded-none text-[10px] font-bold text-white transition-colors flex items-center gap-1.5 shrink-0',
                        getActionColor(req.actionType)
                      )}
                    >
                      {getActionIcon(req.actionType)}
                      {req.actionLabel}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Next Stage Preview */}
          {nextStage && (
            <div className="mt-6 p-4 rounded-none bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-2 mb-2">
                <Icons.arrowRight className="size-4 text-primary" />
                <h4 className="text-xs font-bold text-primary">Next: Stage {nextStage.number} — {nextStage.label}</h4>
              </div>
              <p className="text-[11px] text-slate-600 font-medium">{nextStage.description}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Peer Benchmark */}
          <div className="bg-white rounded-none border border-slate-100 shadow-soft p-5">
            <div className="flex items-center gap-2 mb-3">
              <Icons.barChart3 className="size-4 text-slate-500" />
              <h4 className="text-xs font-bold text-slate-900">Peer Benchmark</h4>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider">Avg. Time</span>
                <span className="text-xs font-bold text-slate-900">{benchmark.avgDays} days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider">Success Rate</span>
                <span className="text-xs font-bold text-slate-900">{benchmark.successRate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider">Your Time</span>
                <span className={cn('text-xs font-bold', isOverdue ? 'text-amber-600' : 'text-green-600')}>
                  {daysInStage} days
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', isOverdue ? 'bg-amber-400' : 'bg-green-400')}
                  style={{ width: `${Math.min((daysInStage / benchmark.avgDays) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Stage History */}
          <div className="bg-white rounded-none border border-slate-100 shadow-soft p-5">
            <div className="flex items-center gap-2 mb-3">
              <Icons.history className="size-4 text-slate-500" />
              <h4 className="text-xs font-bold text-slate-900">Stage History</h4>
            </div>
            <div className="space-y-2">
              {STAGES.slice(0, currentStageIdx + 1).reverse().map((stage, idx) => {
                const color = STAGE_COLORS[STAGES.indexOf(stage)];
                return (
                  <div key={stage.key} className="flex items-center gap-3">
                    <div className={cn('size-2 rounded-full', color.bg)} />
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-slate-700">{stage.label}</p>
                      <p className="text-[9px] text-slate-400 font-medium">
                        {idx === 0 ? 'Current' : idx === 1 ? 'Previous' : `${idx} stages ago`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-none border border-slate-100 shadow-soft overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50">
              <h4 className="text-xs font-bold text-slate-900">Quick Actions</h4>
            </div>
            <div className="p-4 space-y-2">
              <Link
                href={`/projects/${project.id}`}
                className="flex items-center gap-3 p-3 rounded-none hover:bg-slate-50 transition-colors group"
              >
                <div className="size-8 rounded-none bg-blue-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Icons.eye className="size-4 text-blue-600" />
                </div>
                <span className="text-xs font-bold text-slate-700 group-hover:text-primary transition-colors">View Project</span>
              </Link>
              <Link
                href={`/developer/data-room?project=${project.id}`}
                className="flex items-center gap-3 p-3 rounded-none hover:bg-slate-50 transition-colors group"
              >
                <div className="size-8 rounded-none bg-amber-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Icons.upload className="size-4 text-amber-600" />
                </div>
                <span className="text-xs font-bold text-slate-700 group-hover:text-primary transition-colors">Upload Documents</span>
              </Link>
              <Link
                href={`/developer/find-partners?project=${project.id}`}
                className="flex items-center gap-3 p-3 rounded-none hover:bg-slate-50 transition-colors group"
              >
                <div className="size-8 rounded-none bg-green-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Icons.search className="size-4 text-green-600" />
                </div>
                <span className="text-xs font-bold text-slate-700 group-hover:text-primary transition-colors">Find Partners</span>
              </Link>
              <Link
                href={`/projects/${project.id}/gaps`}
                className="flex items-center gap-3 p-3 rounded-none hover:bg-slate-50 transition-colors group"
              >
                <div className="size-8 rounded-none bg-violet-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Icons.fileSearch className="size-4 text-violet-600" />
                </div>
                <span className="text-xs font-bold text-slate-700 group-hover:text-primary transition-colors">Run Gap Analysis</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

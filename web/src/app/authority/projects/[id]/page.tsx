'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { readinessBandStyle } from '@/lib/readiness-thresholds';
import { ReviewHistory } from '@/components/developer/ReviewHistory';
import { PageHero } from '@/components/ui/PageHero';
import { SectionCard } from '@/components/ui/SectionCard';
import { ReviewPanel } from '@/components/review/ReviewPanel';

function money(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

type ProjectDetail = {
  id: string;
  name: string;
  status: string;
  project_stage: string;
  technology_type: string | null;
  project_size_mw: number | null;
  capital_required: number | null;
  capital_structure_type: string | null;
  location_country: string | null;
  location_region: string | null;
  description: string | null;
  target_cod: string | null;
  target_financial_close_date: string | null;
  governance_terms: string | null;
  exit_terms: string | null;
  risk_disclosures: string | null;
  has_secured_land: boolean | null;
  land_title_status: string | null;
  has_reached_financial_close: boolean | null;
  regulatory_approvals: string[] | null;
  capex: number | null;
  opex: number | null;
  funding_required: number | null;
  created_at: string;
  updated_at: string;
  developer?: { id: string; name: string; country: string | null; website: string | null; description: string | null; team_size: number | null; years_operating: number | null; registration_number: string | null } | null;
  documents?: { id: string; document_type: string; file_url: string; storage_path?: string; mime_type?: string; uploaded_at: string }[];
  audit_logs?: { id: string; action_type: string; timestamp: string; before_state?: any; after_state?: any }[];
  scores?: {
    capital_readiness_score: number | null;
    technical_readiness_score: number | null;
    documentation_score: number | null;
    governance_score: number | null;
    financial_transparency_score: number | null;
    regulatory_score: number | null;
    financial_score: number | null;
    developer_score: number | null;
    risk_flags: string[] | null;
    recommendations: string[] | null;
    summary: string | null;
    determined_stage: string | null;
    stage_rationale: string | null;
    breakdown: any;
  } | null;
  tech_requirements?: {
    required_services: string[];
    terrain_complexity: string;
    grid_status: string;
    budget_preference: string;
    ppa_status: string | null;
  } | null;
};

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  under_review: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  pending_live: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  live: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
  draft: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
  scoring: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  scoring_retry: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
};

const SCORE_LABELS: { key: string; label: string; color: string }[] = [
  { key: 'capital_readiness_score', label: 'Capital Readiness', color: 'bg-emerald-500' },
  { key: 'technical_readiness_score', label: 'Technical Readiness', color: 'bg-blue-500' },
  { key: 'documentation_score', label: 'Documentation', color: 'bg-violet-500' },
  { key: 'governance_score', label: 'Governance', color: 'bg-amber-500' },
  { key: 'financial_transparency_score', label: 'Financial Transparency', color: 'bg-cyan-500' },
  { key: 'regulatory_score', label: 'Regulatory', color: 'bg-rose-500' },
  { key: 'financial_score', label: 'Financial', color: 'bg-indigo-500' },
  { key: 'developer_score', label: 'Developer', color: 'bg-teal-500' },
];

type TabId = 'overview' | 'analysis' | 'documents' | 'tech' | 'history';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Icons.folder },
  { id: 'analysis', label: 'AI Analysis', icon: Icons.lightbulb },
  { id: 'documents', label: 'Documents', icon: Icons.fileText },
  { id: 'tech', label: 'Technical', icon: Icons.settings },
  { id: 'history', label: 'Review History', icon: Icons.history },
];

export default function AuthorityProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const loadProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/authority/projects/${params.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load project');
      setProject(json.data || null);
    } catch {
      toast.error('Could not load project');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { loadProject(); }, [loadProject]);



  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="bg-[#0b3b24] px-6 py-6 h-36 animate-pulse" />
        <div className="grid grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-none animate-pulse" />)}</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-8 text-center">
        <div className="size-12 rounded-none bg-slate-100 flex items-center justify-center mx-auto mb-3"><Icons.folder className="size-5 text-slate-300" /></div>
        <p className="text-sm font-bold text-slate-400">Project not found</p>
        <Link href="/authority/projects" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-green-700 hover:text-green-800">
          <Icons.arrowLeft className="size-3" /> Back
        </Link>
      </div>
    );
  }

  const p = project;
  const score = p.scores?.capital_readiness_score ?? 0;
  const ss = STATUS_STYLES[p.status] || STATUS_STYLES.draft;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Header (canonical dark-green) ──────────────────── */}
      <PageHero
        topLeft={
          <Link
            href="/authority/projects"
            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-200/50 hover:text-emerald-200 uppercase tracking-widest transition-colors"
          >
            <Icons.arrowLeft className="size-3" /> Project Reviews
          </Link>
        }
        eyebrow={p.technology_type?.replace(/_/g, ' ').toLowerCase()}
        title={
          <span className="flex items-center gap-2 flex-wrap">
            {p.name}
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 border text-[9px] font-bold uppercase tracking-wider bg-white/10 border-white/15 text-emerald-200/80')}>
              <span className={cn('size-1 rounded-full bg-emerald-300')} />
              {p.status?.replace(/_/g, ' ')}
            </span>
          </span>
        }
        description={
          <span>
            {p.project_size_mw ?? '—'} MW · {p.location_country || '—'}{p.location_region ? `, ${p.location_region}` : ''}
            {p.developer && (
              <span className="opacity-60"> · {p.developer.name}</span>
            )}
          </span>
        }
        actions={
          <ReviewPanel
            projectId={p.id}
            projectStatus={p.status}
            onDecision={async () => { await loadProject(); }}
          />
        }
      />

      {/* ── KPI Strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Readiness Score',  value: `${score}%`,                                  icon: Icons.shieldCheck, color: 'green' },
          { label: 'Capital Required', value: money(p.capital_required ?? 0),             icon: Icons.dollarSign,  color: 'emerald' },
          { label: 'Stage',            value: (p.project_stage || 'concept').replace(/_/g, ' '), icon: Icons.layers, color: 'blue' },
          { label: 'Documents',        value: p.documents?.length ?? 0,                    icon: Icons.fileText,    color: 'violet' },
          { label: 'Developer',        value: p.developer?.name || '—',                    icon: Icons.building,    color: 'slate' },
        ].map(({ label, value, icon: Icon, color }) => {
          const cm: Record<string, { bg: string; icon: string }> = {
            green:   { bg: 'bg-emerald-50', icon: 'text-emerald-700' },
            amber:   { bg: 'bg-amber-50',   icon: 'text-amber-700' },
            red:     { bg: 'bg-red-50',     icon: 'text-red-700' },
            blue:    { bg: 'bg-blue-50',    icon: 'text-blue-700' },
            violet:  { bg: 'bg-violet-50',  icon: 'text-violet-700' },
            emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-700' },
            slate:   { bg: 'bg-slate-100',  icon: 'text-slate-600' },
          };
          const co = cm[color];
          return (
            <div key={label} className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-4 hover:border-slate-300 hover:shadow-md transition-all">
              <div className={cn('size-8 flex items-center justify-center mb-3', co.bg)}>
                <Icon className={cn('size-4', co.icon)} />
              </div>
              <p className="text-lg font-bold text-slate-950 tracking-tight truncate">{value}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</p>
            </div>
          );
        })}
      </div>

      {/* ── Tabs (canonical pill row) ────────────────────── */}
      <div className="flex gap-1 border-b border-slate-200 bg-white px-1">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'h-10 px-4 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2',
                isActive
                  ? 'border-[#0b3b24] text-[#0b3b24]'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
              )}
            >
              <tab.icon className="size-3.5" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ─────────────────────────────────────────────── */}
      {activeTab === 'overview'  && <OverviewTab project={p} />}
      {activeTab === 'analysis'  && <AnalysisTab project={p} />}
      {activeTab === 'documents' && <DocumentsTab documents={p.documents ?? []} />}
      {activeTab === 'tech'      && <TechTab project={p} />}
      {activeTab === 'history'   && <HistoryTab projectId={p.id} />}
    </div>
  );
}

// ── Overview Tab ───────────────────────────────────────────────────────────

function OverviewTab({ project: p }: { project: ProjectDetail }) {
  return (
    <div className="space-y-5">
      {/* Project Details */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
          <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Project</p>
          <h3 className="text-[15px] font-bold text-ink mt-0.5">Project Details</h3>
        </div>
        <div className="p-[22px] space-y-4">
          {p.description && (
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Description</p>
              <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-none p-4 border border-slate-100">{p.description}</p>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5 pt-3 border-t border-slate-100">
            <Info label="Technology" value={p.technology_type || '—'} />
            <Info label="Capacity" value={p.project_size_mw ? `${p.project_size_mw} MW` : '—'} />
            <Info label="Location" value={[p.location_country, p.location_region].filter(Boolean).join(', ') || '—'} />
            <Info label="Capital Structure" value={p.capital_structure_type?.replace(/_/g, ' ') || '—'} />
            <Info label="Stage" value={(p.project_stage || 'concept').replace(/_/g, ' ')} />
            <Info label="Status" value={p.status?.replace(/_/g, ' ') || '—'} />
          </div>
        </div>
      </div>

      {/* Financial Details */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
          <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Financial</p>
          <h3 className="text-[15px] font-bold text-ink mt-0.5">Financial Details</h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <Info label="Capital Required" value={money(p.capital_required ?? 0)} />
            <Info label="CAPEX" value={p.capex ? money(p.capex) : '—'} />
            <Info label="OPEX" value={p.opex ? money(p.opex) : '—'} />
            <Info label="Funding Required" value={p.funding_required ? money(p.funding_required) : '—'} />
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
          <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Checklist</p>
          <h3 className="text-[15px] font-bold text-ink mt-0.5">Regulatory Checklist</h3>
        </div>
        <div className="p-5 space-y-3">
          {[
            { label: 'Secured Land', value: p.has_secured_land },
            { label: 'Reached Financial Close', value: p.has_reached_financial_close },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between p-3 rounded-none bg-slate-50 border border-slate-100">
              <span className="text-sm font-semibold text-slate-700">{item.label}</span>
              <span className={cn('inline-flex items-center gap-[7px] rounded-full px-[11px] py-1 text-xs font-semibold',
                item.value ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
              )}>
                {item.value ? <Icons.check className="size-3" /> : <Icons.x className="size-3" />}
                {item.value ? 'Yes' : 'No'}
              </span>
            </div>
          ))}
          {p.land_title_status && (
            <div className="flex items-center justify-between p-3 rounded-none bg-slate-50 border border-slate-100">
              <span className="text-sm font-semibold text-slate-700">Land Title Status</span>
              <span className="text-sm font-bold text-slate-900">{p.land_title_status}</span>
            </div>
          )}
          {p.regulatory_approvals && p.regulatory_approvals.length > 0 && (
            <div className="p-3 rounded-none bg-slate-50 border border-slate-100">
              <p className="text-sm font-semibold text-slate-700 mb-2">Regulatory Approvals</p>
              <div className="flex flex-wrap gap-1.5">
                {p.regulatory_approvals.map(a => (
                  <span key={a} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">{a}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Developer Info */}
      {p.developer && (
        <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
          <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
            <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Developer</p>
            <h3 className="text-[15px] font-bold text-ink mt-0.5">Developer Information</h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              <Info label="Company" value={p.developer.name} />
              <Info label="Country" value={p.developer.country || '—'} />
              <Info label="Team Size" value={p.developer.team_size ? `${p.developer.team_size} people` : '—'} />
              <Info label="Years Operating" value={p.developer.years_operating ? `${p.developer.years_operating} years` : '—'} />
              <Info label="Registration No." value={p.developer.registration_number || '—'} />
              <Info label="Website" value={p.developer.website || '—'} />
            </div>
            {p.developer.description && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Company Description</p>
                <p className="text-sm text-slate-600 leading-relaxed">{p.developer.description}</p>
              </div>
            )}
            <Link href={`/authority/organizations/${p.developer.id}`} className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-green-700 hover:text-green-800 transition-colors">
              <Icons.building className="size-3" /> View Full Organisation Profile
              <Icons.chevronRight className="size-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
          <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Timeline</p>
          <h3 className="text-[15px] font-bold text-ink mt-0.5">Project Timeline</h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            <Info label="Created" value={p.created_at ? new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'} />
            <Info label="Last Updated" value={p.updated_at ? new Date(p.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'} />
            <Info label="Target COD" value={p.target_cod || '—'} />
            <Info label="Target Financial Close" value={p.target_financial_close_date || '—'} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Analysis Tab ───────────────────────────────────────────────────────────

function AnalysisTab({ project: p }: { project: ProjectDetail }) {
  const scores = p.scores;
  return (
    <div className="space-y-5">
      {scores ? (
        <>
          {/* Overall Score */}
          <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
            <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
              <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">AI Assessment</p>
              <h3 className="text-[15px] font-bold text-ink mt-0.5">Overall Readiness</h3>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', readinessBandStyle(scores.capital_readiness_score ?? 0).bar)} style={{ width: `${scores.capital_readiness_score ?? 0}%` }} />
                </div>
                <span className="text-2xl font-bold text-slate-900">{scores.capital_readiness_score ?? 0}%</span>
              </div>
              {scores.summary && (
                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-none p-4 border border-slate-100">{scores.summary}</p>
              )}
              {scores.determined_stage && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Determined Stage:</span>
                  <span className="px-2.5 py-1 rounded-none bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider border border-blue-200">{scores.determined_stage.replace(/_/g, ' ')}</span>
                </div>
              )}
              {scores.stage_rationale && (
                <p className="text-xs text-slate-500 mt-2 italic">{scores.stage_rationale}</p>
              )}
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
            <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
              <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Breakdown</p>
              <h3 className="text-[15px] font-bold text-ink mt-0.5">Score Breakdown</h3>
            </div>
            <div className="p-5 space-y-3">
              {SCORE_LABELS.map(({ key, label, color }) => {
                const val = (scores as any)?.[key] ?? 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-600 w-40 shrink-0">{label}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${val}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-900 w-10 text-right">{val}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Risk Flags */}
          {scores.risk_flags && scores.risk_flags.length > 0 && (
            <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
              <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
                <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Risks</p>
                <h3 className="text-[15px] font-bold text-ink mt-0.5">Risk Flags</h3>
              </div>
              <div className="p-5 flex flex-wrap gap-2">
                {scores.risk_flags.map((flag, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-none bg-red-50 text-red-700 text-[11px] font-bold border border-red-200">{flag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {scores.recommendations && scores.recommendations.length > 0 && (
            <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
              <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
                <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Advice</p>
                <h3 className="text-[15px] font-bold text-ink mt-0.5">Recommendations</h3>
              </div>
              <div className="p-5 space-y-2">
                {scores.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 rounded-none bg-green-50/50 border border-green-100">
                    <Icons.lightbulb className="size-4 text-green-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-700">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-8 text-center">
          <div className="size-12 rounded-none bg-slate-100 flex items-center justify-center mx-auto mb-3"><Icons.lightbulb className="size-5 text-slate-300" /></div>
          <p className="text-sm font-bold text-slate-400">No AI analysis available</p>
          <p className="text-xs text-slate-400 mt-1">Analysis will appear after the developer submits the project.</p>
        </div>
      )}
    </div>
  );
}

// ── Documents Tab ──────────────────────────────────────────────────────────

function DocumentsTab({ documents }: { documents: NonNullable<ProjectDetail['documents']> }) {
  return (
    <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
      <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
        <div>
          <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Data Room</p>
          <h3 className="text-[15px] font-bold text-ink mt-0.5">Uploaded Documents ({documents.length})</h3>
        </div>
      </div>
      {documents.length === 0 ? (
        <div className="p-8 text-center">
          <div className="size-12 rounded-none bg-slate-100 flex items-center justify-center mx-auto mb-3"><Icons.fileText className="size-5 text-slate-300" /></div>
          <p className="text-sm font-bold text-slate-400">No documents uploaded</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {documents.map(doc => (
            <div key={doc.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
              <div className="size-9 rounded-none bg-blue-50 flex items-center justify-center shrink-0">
                <Icons.fileText className="size-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{doc.storage_path?.split('/').pop() || doc.document_type}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">{doc.document_type}</p>
              </div>
              {doc.uploaded_at && (
                <span className="text-[10px] text-slate-400 font-medium shrink-0">
                  {new Date(doc.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
              {doc.file_url && (
                <a href={doc.file_url} target="_blank" rel="noreferrer"
                  className="h-7 px-3 rounded-none border border-slate-200 bg-white text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1 shrink-0">
                  <Icons.download className="size-3" /> Download
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tech Tab ───────────────────────────────────────────────────────────────

function TechTab({ project: p }: { project: ProjectDetail }) {
  const tech = p.tech_requirements;
  return (
    <div className="space-y-5">
      {tech ? (
        <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
          <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
            <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Technical</p>
            <h3 className="text-[15px] font-bold text-ink mt-0.5">Technical Requirements</h3>
          </div>
          <div className="p-[22px] space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              <Info label="Terrain Complexity" value={tech.terrain_complexity || '—'} />
              <Info label="Grid Status" value={tech.grid_status || '—'} />
              <Info label="Budget Preference" value={tech.budget_preference || '—'} />
              <Info label="PPA Status" value={tech.ppa_status?.replace(/_/g, ' ') || '—'} />
            </div>
            {tech.required_services && tech.required_services.length > 0 && (
              <div className="pt-4 border-t border-slate-100">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Required Services</p>
                <div className="flex flex-wrap gap-1.5">
                  {tech.required_services.map(s => (
                    <span key={s} className="px-2.5 py-1 rounded-none bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-8 text-center">
          <div className="size-12 rounded-none bg-slate-100 flex items-center justify-center mx-auto mb-3"><Icons.settings className="size-5 text-slate-300" /></div>
          <p className="text-sm font-bold text-slate-400">No technical requirements submitted</p>
        </div>
      )}
    </div>
  );
}

// ── Review History Tab ────────────────────────────────────────────────────

function HistoryTab({ projectId }: { projectId: string }) {
  return <ReviewHistory projectId={projectId} />;
}

// ── Info ───────────────────────────────────────────────────────────────────

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-sm font-bold text-slate-800 mt-1">{value}</p>
    </div>
  );
}

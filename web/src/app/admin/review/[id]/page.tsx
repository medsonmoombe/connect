'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { ReviewHistory } from '@/components/developer/ReviewHistory';
import { PageHero } from '@/components/ui/PageHero';
import { ReviewPanel } from '@/components/review/ReviewPanel';
import { AiInsightsPanel } from '@/components/developer/AiInsightsPanel';
import { toast } from 'sonner';

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

type TabId = 'overview' | 'analysis' | 'documents' | 'tech' | 'history';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Icons.folder },
  { id: 'analysis', label: 'AI Analysis', icon: Icons.lightbulb },
  { id: 'documents', label: 'Documents', icon: Icons.fileText },
  { id: 'tech', label: 'Technical', icon: Icons.settings },
  { id: 'history', label: 'Review History', icon: Icons.history },
];

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-sm font-bold text-slate-800 mt-1">{value}</p>
    </div>
  );
}

export default function AdminReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [analyzing, setAnalyzing] = useState(false);

  const loadProject = useCallback(async () => {
    try {
      // Admin uses the admin projects API which has full access
      const res = await fetch(`/api/admin/projects/${params.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setProject(json.data ?? json ?? null);
    } catch {
      // Fallback: fetch from authority API (admin has access via RLS)
      try {
        const res = await fetch(`/api/authority/projects?status=ALL&pageSize=500`);
        const json = await res.json();
        const found = (json.data ?? []).find((p: any) => p.id === params.id);
        setProject(found || null);
      } catch {
        console.error('Could not load project');
      }
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { loadProject(); }, [loadProject]);

  const runAnalysis = useCallback(async () => {
    if (!project) return;
    setAnalyzing(true);
    toast.loading('Triggering AI analysis…', { id: 'ai-run' });
    try {
      const res = await fetch(`/api/projects/${project.id}/analyze`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok || !d.success) {
        toast.error(d.error ?? 'Analysis failed — check server logs.', { id: 'ai-run' });
        setAnalyzing(false);
        return;
      }
      const prevScore = project.scores?.capital_readiness_score ?? -1;
      const prevSummary = project.scores?.summary ?? '';
      toast.loading('Analysis running… this may take up to 60s', { id: 'ai-run' });
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const r = await fetch(`/api/admin/projects/${project.id}`);
          const j = await r.json();
          const fresh = (j.data ?? j)?.scores;
          const changed = fresh && (
            (fresh.capital_readiness_score ?? -1) !== prevScore ||
            (fresh.summary ?? '') !== prevSummary
          );
          if (changed || attempts >= 20) {
            clearInterval(poll);
            setAnalyzing(false);
            if (changed) toast.success('Analysis complete — scores updated.', { id: 'ai-run' });
            else toast.warning('Analysis is taking longer than expected. Refresh manually in a moment.', { id: 'ai-run' });
            loadProject();
          }
        } catch {
          clearInterval(poll);
          setAnalyzing(false);
          toast.warning('Analysis triggered. Refresh the page in a moment.', { id: 'ai-run' });
        }
      }, 5000);
    } catch {
      toast.error('Failed to trigger analysis.', { id: 'ai-run' });
      setAnalyzing(false);
    }
  }, [project, loadProject]);

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="rounded-none border border-line bg-white h-36 animate-pulse" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="border border-slate-200 bg-white p-8 text-center">
        <div className="size-12 bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <Icons.folder className="size-5 text-slate-300" />
        </div>
        <p className="text-sm font-bold text-slate-400">Project not found</p>
        <Link href="/admin/review" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-green-700 hover:text-green-800">
          <Icons.arrowLeft className="size-3" /> Back to Review Queue
        </Link>
      </div>
    );
  }

  const p = project;
  const score = p.scores?.capital_readiness_score ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      <PageHero
        topLeft={
          <Link
            href="/admin/review"
            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-200/50 hover:text-emerald-200 uppercase tracking-widest transition-colors"
          >
            <Icons.arrowLeft className="size-3" /> Review Queue
          </Link>
        }
        eyebrow={p.technology_type?.replace(/_/g, ' ').toLowerCase()}
        title={
          <span className="flex items-center gap-2 flex-wrap">
            {p.name}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 border text-[9px] font-bold uppercase tracking-wider bg-white/10 border-white/15 text-emerald-200/80">
              <span className="size-1 rounded-full bg-emerald-300" />
              {p.status?.replace(/_/g, ' ')}
            </span>
          </span>
        }
        description={
          <span>
            {p.project_size_mw ?? '—'} MW · {p.location_country || '—'}{p.location_region ? `, ${p.location_region}` : ''}
            {p.developer && <span className="opacity-60"> · {p.developer.name}</span>}
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

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Readiness Score', value: `${score}%`, icon: Icons.shieldCheck, color: 'green' },
          { label: 'Capital Required', value: money(p.capital_required ?? 0), icon: Icons.dollarSign, color: 'emerald' },
          { label: 'Stage', value: (p.project_stage || 'concept').replace(/_/g, ' '), icon: Icons.layers, color: 'blue' },
          { label: 'Documents', value: p.documents?.length ?? 0, icon: Icons.fileText, color: 'violet' },
          { label: 'Developer', value: p.developer?.name || '—', icon: Icons.building, color: 'slate' },
        ].map(({ label, value, icon: Icon, color }) => {
          const cm: Record<string, { bg: string; icon: string }> = {
            green:   { bg: 'bg-emerald-50', icon: 'text-emerald-700' },
            emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-700' },
            blue:    { bg: 'bg-blue-50',    icon: 'text-blue-700' },
            violet:  { bg: 'bg-violet-50',  icon: 'text-violet-700' },
            slate:   { bg: 'bg-slate-100',  icon: 'text-slate-600' },
          };
          const co = cm[color];
          return (
            <div key={label} className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-4">
              <div className={cn('size-8 flex items-center justify-center mb-3', co.bg)}>
                <Icon className={cn('size-4', co.icon)} />
              </div>
              <p className="text-lg font-bold text-slate-950 tracking-tight truncate">{value}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 bg-white px-1">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'h-10 px-4 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2',
                isActive ? 'border-[#0b3b24] text-[#0b3b24]' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
              )}
            >
              <tab.icon className="size-3.5" /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview'  && <OverviewTab project={p} />}
      {activeTab === 'analysis'  && (
        // The reviewer reads the SAME component the developer does. This tab used
        // to be a second, hand-rolled renderer that read legacy field names
        // (`authenticity_concerns`, `matchStatus`) the evidence engine never
        // writes, so it showed every document as "unreviewed" with no integrity
        // notes, no narrative brief and no per-rating ledger — the reviewer was
        // looking at a materially different report from the developer.
        <AiInsightsPanel
          project={p as any}
          scores={(p.scores ?? null) as any}
          onReanalyze={runAnalysis}
          analyzing={analyzing}
          emptyCopy={{
            title: 'No AI Analysis Has Completed',
            hint: 'The analysis runs automatically when the developer submits. If it failed, the project would sit in "Analysis Failed — Retry Available" — re-run it here.',
          }}
        />
      )}
      {activeTab === 'documents' && <DocumentsTab documents={p.documents ?? []} />}
      {activeTab === 'tech'      && <TechTab project={p} />}
      {activeTab === 'history'   && <ReviewHistory projectId={p.id} />}
    </div>
  );
}

function OverviewTab({ project: p }: { project: ProjectDetail }) {
  return (
    <div className="space-y-5">
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
          </div>
        </div>
      )}

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

function DocumentsTab({ documents }: { documents: NonNullable<ProjectDetail['documents']> }) {
  return (
    <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
      <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
        <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Data Room</p>
        <h3 className="text-[15px] font-bold text-ink mt-0.5">Uploaded Documents ({documents.length})</h3>
      </div>
      {documents.length === 0 ? (
        <div className="p-8 text-center">
          <div className="size-12 rounded-none bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Icons.fileText className="size-5 text-slate-300" />
          </div>
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
        <div className="border border-slate-200 bg-white p-8 text-center">
          <div className="size-12 rounded-none bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Icons.settings className="size-5 text-slate-300" />
          </div>
          <p className="text-sm font-bold text-slate-400">No technical requirements submitted</p>
        </div>
      )}
    </div>
  );
}

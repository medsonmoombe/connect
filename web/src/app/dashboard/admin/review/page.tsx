'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { projectsApi } from '@/services/api';
import { toast } from 'sonner';
import { projectService } from '@/services/projects';
import { Project } from '@/types';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { getReviewRecommendation } from '@/lib/review-intelligence';
import { ReviewRecommendationCard } from '@/components/ReviewRecommendationCard';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  submitted:    { label: 'Submitted',    color: 'text-blue-600',  bg: 'bg-blue-50',  border: 'border-blue-100' },
  under_review: { label: 'Under Review', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function ScorePillar({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  const pct = Math.min(100, (score / max) * 100);
  return (
    <div className="text-center">
      <div className="relative size-16 flex items-center justify-center mx-auto mb-1">
        <svg className="size-full -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-100" />
          <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="5"
            strokeDasharray={163} strokeDashoffset={163 - (163 * pct) / 100}
            strokeLinecap="round" className={cn('transition-all duration-700', color)} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-black text-slate-900 leading-none">{score}</span>
          <span className="text-[8px] font-bold text-slate-400">/{max}</span>
        </div>
      </div>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
    </div>
  );
}

export default function AdminReviewPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'under_review'>('all');

  const [selected, setSelected] = useState<Project | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [acting, setActing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const res = await projectsApi.getAdminAll({});
      if (res.data) {
        setProjects(
          (res.data as Project[]).filter(
            (p) => (p as any).status === 'submitted' || (p as any).status === 'under_review'
          )
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = projects.filter((p) => {
    const matchesStatus = statusFilter === 'all' || (p as any).status === statusFilter;
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const openDrawer = (project: Project) => {
    setSelected(project);
    setRejectReason('');
    setShowRejectInput(false);
  };

  const closeDrawer = () => {
    setSelected(null);
    setRejectReason('');
    setShowRejectInput(false);
  };

  const handleAction = async (action: 'review' | 'validate' | 'reject') => {
    if (!selected) return;
    const recommendation = getReviewRecommendation(selected.scores);
    if ((action === 'validate' || action === 'reject') && !selected.scores) {
      toast.error('Run AI analysis before completing project review.');
      return;
    }
    if (action === 'validate' && !recommendation.canValidate) {
      toast.error(recommendation.message);
      return;
    }
    if (action === 'reject' && !showRejectInput) { setShowRejectInput(true); return; }
    setActing(true);
    try {
      if (action === 'review') await projectsApi.review(selected.id);
      else if (action === 'validate') await projectsApi.validate(selected.id);
      else await projectsApi.reject(selected.id, rejectReason);

      const messages = {
        review: 'Project moved to Under Review.',
        validate: 'Project validated — scoring triggered.',
        reject: 'Project rejected.',
      };
      toast.success(messages[action]);
      await fetchProjects();
      if (action === 'review') {
        setSelected((prev) => prev ? { ...prev, status: 'under_review' } as any : null);
      } else {
        closeDrawer();
      }
    } catch (e: any) {
      toast.error(e.message || 'Action failed');
    } finally {
      setActing(false);
    }
  };

  const submittedCount = projects.filter((p) => (p as any).status === 'submitted').length;
  const underReviewCount = projects.filter((p) => (p as any).status === 'under_review').length;
  const reviewRecommendation = selected ? getReviewRecommendation(selected.scores) : null;

  const runAnalysis = async () => {
    if (!selected) return;
    const docs = selected.documents ?? [];
    if (docs.length === 0) {
      toast.error('No documents uploaded. The developer must upload project documents before analysis can run.');
      return;
    }

    setAnalyzing(true);
    const toastId = toast.loading('Running AI analysis...');
    try {
      const responseData = await apiClient.post<{ success: boolean; data: any }>(
        `/projects/${selected.id}/analyze`,
        {}
      );
      if (!responseData.success || !responseData.data) throw new Error('AI scoring failed');

      const s = responseData.data;
      const regulatory = Math.round(s.breakdown?.regulatory?.score ?? 0);
      const financial  = Math.round(s.breakdown?.financial?.score ?? 0);
      const developer  = Math.round(s.breakdown?.developer?.score ?? 0);
      const totalScore = Math.round(s.total_score ?? (regulatory + financial + developer));

      await projectService.saveProjectScores({
        project_id: selected.id,
        capital_readiness_score: totalScore,
        regulatory_score: regulatory,
        financial_score: financial,
        developer_score: developer,
        breakdown: s.breakdown,
        risk_flags: (s.risk_signals || []).map((r: any) => `${r.level}: ${r.text}`),
        recommendations: s.recommendations || [],
        summary: s.summary || 'Analysis complete.',
      });

      toast.success('Analysis complete — opening full project page.', { id: toastId });
      router.push(`/projects/${selected.id}`);
    } catch (err: any) {
      toast.error(`Analysis failed: ${err.message || 'Unknown error'}`, { id: toastId });
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="dash-section-label mb-1">Project Review</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Review Queue</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {isLoading ? 'Loading...' : projects.length === 0
              ? 'All caught up — no projects pending review.'
              : `${projects.length} project${projects.length !== 1 ? 's' : ''} awaiting your attention.`}
          </p>
        </div>
        <Link href="/dashboard/admin/projects">
          <Button variant="outline" className="h-9 px-4 rounded-xl">
            <Icons.folder className="mr-2 size-4" /> All Projects
          </Button>
        </Link>
      </div>

      {/* ── Tabs + Search ──────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="flex gap-2 p-1.5 bg-white rounded-2xl border border-slate-100 shadow-sm w-fit">
          {([
            { id: 'all', label: 'All', count: projects.length },
            { id: 'submitted', label: 'Submitted', count: submittedCount },
            { id: 'under_review', label: 'Under Review', count: underReviewCount },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                'px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2',
                statusFilter === tab.id
                  ? 'bg-green-800 text-white shadow'
                  : 'text-slate-400 hover:text-slate-600'
              )}
            >
              {tab.label}
              <span className={cn(
                'text-[10px] font-black px-1.5 py-0.5 rounded-md',
                statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm ml-auto">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            placeholder="Search by project name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-xl border-slate-200"
          />
        </div>
      </div>

      {/* ── Project Cards ──────────────────────────────── */}
      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="dash-card p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="flex-1 space-y-3">
                  <div className="h-5 w-48 bg-slate-100 rounded" />
                  <div className="h-3 w-32 bg-slate-100 rounded" />
                  <div className="flex gap-2 mt-2">
                    <div className="h-6 w-20 bg-slate-100 rounded-full" />
                    <div className="h-6 w-24 bg-slate-100 rounded-full" />
                  </div>
                </div>
                <div className="h-9 w-24 bg-slate-100 rounded-xl self-start" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="dash-card p-16 text-center">
          <div className="size-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Icons.folder className="size-6 text-slate-300" />
          </div>
          <p className="text-sm font-bold text-slate-900 mb-1">
            {search ? 'No projects match your search.' : 'No projects pending review.'}
          </p>
          <p className="text-xs text-slate-500 font-medium">
            {search ? 'Try a different search term.' : 'All caught up — check back later.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((project) => {
            const status = (project as any).status as string;
            const st = STATUS_CONFIG[status] ?? STATUS_CONFIG.submitted;
            const score = project.scores?.capital_readiness_score ?? 0;

            return (
              <div
                key={project.id}
                className="dash-card p-5 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer"
                onClick={() => openDrawer(project)}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border', st.bg, st.color, st.border)}>
                        <span className="size-1.5 rounded-full bg-current" />
                        {st.label}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {new Date(project.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <h3 className="text-[13px] font-bold text-slate-900 truncate">{project.name}</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {project.developer?.name || 'Unknown org'} · {project.technology_type} · {project.project_stage?.replace(/_/g, ' ')}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-700">
                        <Icons.dollarSign className="size-3 text-primary" />{formatCurrency(project.capital_required)}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-700">
                        <Icons.mapPin className="size-3 text-primary" />{project.location_country}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-700">
                        <Icons.fileText className="size-3 text-primary" />{project.documents?.length ?? 0} doc{(project.documents?.length ?? 0) !== 1 ? 's' : ''}
                      </span>
                      {project.scores && (
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold',
                          score >= 60 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                          score >= 40 ? 'bg-amber-50 border-amber-100 text-amber-700' :
                                        'bg-red-50 border-red-100 text-red-700'
                        )}>
                          <Icons.zap className="size-3" />AI Score: {score}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <Button
                      size="sm"
                      className="h-9 px-4 rounded-xl bg-green-800 text-white shadow font-bold text-xs hover:bg-green-800 text-white shadow"
                      onClick={(e) => { e.stopPropagation(); openDrawer(project); }}
                    >
                      <Icons.eye className="size-3.5 mr-1.5" />Review
                    </Button>
                    <Link href={`/projects/${project.id}`} onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-8 px-3 rounded-xl text-[11px] font-semibold text-slate-500 hover:text-slate-900">
                        Full Page →
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Review Drawer ──────────────────────────────── */}
      <Drawer
        open={!!selected}
        onClose={closeDrawer}
        title="Review Project"
        description={selected?.name ?? ''}
        size="lg"
      >
        {selected && (
          <div className="space-y-5">
            {/* Status badge */}
            {(() => {
              const st = STATUS_CONFIG[(selected as any).status] ?? STATUS_CONFIG.submitted;
              return (
                <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border', st.bg, st.color, st.border)}>
                  <span className="size-1.5 rounded-full bg-current" />{st.label}
                </span>
              );
            })()}

            {/* Summary grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Developer', value: selected.developer?.name || 'N/A' },
                { label: 'Technology', value: selected.technology_type || 'N/A' },
                { label: 'Stage', value: selected.project_stage?.replace(/_/g, ' ') || 'N/A' },
                { label: 'Location', value: `${selected.location_country}${selected.location_region ? `, ${selected.location_region}` : ''}` },
                { label: 'Capital Required', value: formatCurrency(selected.capital_required) },
                { label: 'Size', value: `${selected.project_size_mw} MW` },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{value}</p>
                </div>
              ))}
            </div>

            {/* AI Score */}
            {selected.scores ? (
              <div className="p-4 rounded-xl bg-white border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI Readiness Score</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-3 rounded-lg border-slate-200 text-[10px] font-bold text-slate-500"
                    onClick={runAnalysis}
                    disabled={analyzing}
                  >
                    {analyzing ? <Icons.spinner className="size-3 animate-spin mr-1" /> : <Icons.zap className="size-3 mr-1" />}
                    Re-run
                  </Button>
                </div>
                <div className="flex justify-around">
                  <ScorePillar label="Regulatory" score={selected.scores.regulatory_score ?? 0} max={40} color="text-blue-500" />
                  <ScorePillar label="Financial"  score={selected.scores.financial_score ?? 0}  max={35} color="text-emerald-500" />
                  <ScorePillar label="Developer"  score={selected.scores.developer_score ?? 0}  max={25} color="text-amber-500" />
                  <div className="text-center">
                    <div className={cn(
                      'size-16 rounded-full flex items-center justify-center border-4 mx-auto mb-1',
                      (selected.scores.capital_readiness_score ?? 0) >= 60 ? 'border-emerald-400 bg-emerald-50' :
                      (selected.scores.capital_readiness_score ?? 0) >= 40 ? 'border-amber-400 bg-amber-50' :
                                                                              'border-red-400 bg-red-50'
                    )}>
                      <span className="text-lg font-black text-slate-900">{selected.scores.capital_readiness_score ?? 0}</span>
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
                  </div>
                </div>
                {selected.scores.summary && (
                  <p className="mt-4 text-xs text-slate-600 italic leading-relaxed border-t border-slate-100 pt-3">
                    "{selected.scores.summary}"
                  </p>
                )}
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-3 mb-4">
                  <div className="size-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <Icons.alertTriangle className="size-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-900">AI Analysis Required</p>
                    <p className="text-xs text-amber-700 font-medium mt-0.5">
                      This project must be analysed before it can be validated. Run the analysis below — you will be taken to the full project page once complete.
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full h-10 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm"
                  onClick={runAnalysis}
                  disabled={analyzing || (selected.documents?.length ?? 0) === 0}
                >
                  {analyzing
                    ? <><Icons.spinner className="size-4 animate-spin mr-2" />Running Analysis...</>
                    : <><Icons.zap className="size-4 mr-2" />Run AI Analysis</>}
                </Button>
                {(selected.documents?.length ?? 0) === 0 && (
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest text-center mt-2">
                    No documents uploaded — developer must upload documents first
                  </p>
                )}
              </div>
            )}

            {/* Documents */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Documents ({selected.documents?.length ?? 0})
              </p>
              {selected.documents && selected.documents.length > 0 ? (
                <div className="space-y-1.5">
                  {selected.documents.map((doc, i) => (
                    <a
                      key={i}
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-primary/30 hover:bg-primary/5 transition-all group"
                    >
                      <Icons.fileText className="size-4 text-slate-400 group-hover:text-primary shrink-0" />
                      <span className="text-[13px] font-semibold text-slate-700 group-hover:text-primary truncate flex-1">{doc.document_type}</span>
                      <Icons.arrowRight className="size-3 text-slate-300 group-hover:text-primary shrink-0" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-slate-400 font-medium">No documents uploaded.</p>
              )}
            </div>

            {/* Full page link */}
            <Link href={`/projects/${selected.id}`} target="_blank">
              <Button variant="outline" className="w-full h-10 rounded-xl border-slate-200 text-slate-600 font-semibold text-sm">
                <Icons.eye className="size-4 mr-2" />Open Full Project Page
              </Button>
            </Link>

            {reviewRecommendation && (selected as any).status === 'under_review' && (
              <ReviewRecommendationCard recommendation={reviewRecommendation} />
            )}

            {/* Actions */}
            <div className="border-t border-slate-100 pt-4 space-y-2.5">
              {(selected as any).status === 'submitted' && (
                <Button
                  className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                  onClick={() => handleAction('review')}
                  disabled={acting}
                >
                  {acting ? <Icons.spinner className="size-4 animate-spin mr-2" /> : <Icons.eye className="size-4 mr-2" />}
                  Start Review
                </Button>
              )}

              {(selected as any).status === 'under_review' && (
                <Button
                  className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  onClick={() => handleAction('validate')}
                  disabled={acting || !reviewRecommendation?.canValidate}
                  title={!reviewRecommendation?.canValidate ? 'Run AI analysis first or review low AI score' : undefined}
                >
                  {acting ? <Icons.spinner className="size-4 animate-spin mr-2" /> : <Icons.check className="size-4 mr-2" />}
                  {reviewRecommendation?.canValidate ? 'Validate Project' : 'Run Analysis First'}
                </Button>
              )}

              {!showRejectInput ? (
                <Button
                  variant="outline"
                  className="w-full h-11 rounded-xl border-red-200 text-red-600 hover:bg-red-50 font-bold"
                  onClick={() => setShowRejectInput(true)}
                  disabled={acting || !selected.scores}
                  title={!selected.scores ? 'Run AI analysis first' : undefined}
                >
                  <Icons.close className="size-4 mr-2" />Reject Project
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Rejection Reason <span className="text-red-500">*</span>
                  </p>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Explain why this project is being rejected (min 10 characters)..."
                    className="w-full h-28 px-4 py-3 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm"
                      onClick={() => handleAction('reject')}
                      disabled={acting || rejectReason.trim().length < 10}
                    >
                      {acting && <Icons.spinner className="size-4 animate-spin mr-1.5" />}
                      Confirm Rejection
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-10 px-4 rounded-xl text-slate-500 font-bold text-sm"
                      onClick={() => { setShowRejectInput(false); setRejectReason(''); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

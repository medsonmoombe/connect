'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { projectService } from '@/services/projects';
import { Project, CapitalMatchResult, TechnicalMatchResult, ProjectStage } from '@/types';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { MatchingSection } from '@/components/MatchingSection';
import { storageService } from '@/lib/storage';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { engagementService, getStateLabel } from '@/lib/engagement';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Engagement } from '@/types';


const STAGES: { key: ProjectStage; label: string }[] = [
  { key: 'CONCEPT', label: 'Concept' },
  { key: 'FEASIBILITY', label: 'Feasibility' },
  { key: 'PERMITTING', label: 'Permitting' },
  { key: 'FINANCIAL_CLOSE', label: 'Fin. Close' },
  { key: 'CONSTRUCTION', label: 'Construction' },
  { key: 'OPERATIONS', label: 'Operations' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft:        { label: 'Draft',        color: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-100' },
  scoring:      { label: 'Scoring',      color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100' },
  pending_live: { label: 'Pending Live', color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
  live:         { label: 'Live',         color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  deactivated:  { label: 'Deactivated',  color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-100' },
  archived:     { label: 'Archived',     color: 'text-slate-400',   bg: 'bg-slate-50',   border: 'border-slate-100' },
};

function PageSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const incomingEngagementId = searchParams.get('engagement_id');
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState(0);
  const [capitalMatches, setCapitalMatches] = useState<CapitalMatchResult[]>([]);
  const [technicalMatches, setTechnicalMatches] = useState<TechnicalMatchResult[]>([]);
  const [projectEngagements, setProjectEngagements] = useState<Engagement[]>([]);

  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [showAllFlags, setShowAllFlags] = useState(false);
  const [showAllRecs, setShowAllRecs] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expressingInterest, setExpressingInterest] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const PREVIEW_COUNT = 3;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refetch when countdown reaches 0
  const wasPendingRef = useRef(false);
  useEffect(() => {
    if (!project || project.status !== 'pending_live' || !project.scores_visible_at) {
      wasPendingRef.current = false;
      return;
    }
    const visibleAt = new Date(project.scores_visible_at).getTime();
    const remaining = visibleAt - Date.now();

    if (remaining <= 0 && !wasPendingRef.current) {
      wasPendingRef.current = true;
      const timer = setTimeout(async () => {
        try {
          const data = await projectService.getProjectDetails(params.id as string);
          setProject(data);
          if (data.status === 'live') {
            toast.success('Your project is now live!');
            const matches = await projectService.getProjectMatches(params.id as string);
            setCapitalMatches(matches.capital);
            setTechnicalMatches(matches.technical);
          }
        } catch {}
      }, 60_000);
      return () => clearTimeout(timer);
    }
    if (remaining > 0) {
      wasPendingRef.current = false;
    }
  }, [project?.status, project?.scores_visible_at, now]);

  // ── Permissions ────────────────────────────────────────────
  const isOwner = !!project && !!user && (
    project.developer_id === user.company_id || user.is_platform_admin
  );
  const isCreator = !!project && !!user && (
    project.created_by === user.id || user.is_platform_admin
  );
  const isPlatformAdmin = !!user?.is_platform_admin;
  const isPartner = !isOwner && !!user?.company_id;
  const [hasNda, setHasNda] = useState(false);
  const [partnerEngagement, setPartnerEngagement] = useState<Engagement | null>(null);

  useEffect(() => {
    async function checkPartner() {
      if (!user?.company_id || !project) return;
      if (project.developer_id === user.company_id) return;
      const NDA_STATUSES = ['NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED'];
      try {
        // If we arrived from an engagement page, fetch that engagement directly
        if (incomingEngagementId) {
          const res = await fetch(`/api/engagements/${incomingEngagementId}`);
          const json = await res.json();
          const eng: Engagement | null = json.data ?? null;
          setPartnerEngagement(eng);
          setHasNda(eng ? NDA_STATUSES.includes(eng.status) : false);
          return;
        }
        // Otherwise query by project
        const res = await fetch(`/api/engagements?project_id=${project.id}`);
        const json = await res.json();
        const eng: Engagement | null = (json.data as Engagement[])?.[0] ?? null;
        setPartnerEngagement(eng);
        setHasNda(eng ? NDA_STATUSES.includes(eng.status) : false);
      } catch {}
    }
    checkPartner();
  }, [user, project, incomingEngagementId]);

  // ── Bookmark state ─────────────────────────────────────────
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);

  useEffect(() => {
    async function checkBookmark() {
      if (!user || !params.id) return;
      try {
        const res = await fetch(`/api/projects/${params.id}/bookmark`);
        const json = await res.json();
        setIsBookmarked(!!json.bookmarked);
      } catch {}
    }
    checkBookmark();
  }, [user, params.id]);

  const handleToggleBookmark = async () => {
    if (!params.id || bookmarking) return;
    setBookmarking(true);
    try {
      const res = await fetch(`/api/projects/${params.id}/bookmark`, { method: 'POST' });
      const json = await res.json();
      setIsBookmarked(json.bookmarked);
      toast.success(json.bookmarked ? 'Project saved' : 'Project removed from saved');
    } catch {
      toast.error('Failed to update bookmark');
    } finally {
      setBookmarking(false);
    }
  };

  // ── Fetch project ──────────────────────────────────────────
  useEffect(() => {
    async function fetchProject() {
      if (!params.id) return;
      try {
        const data = await projectService.getProjectDetails(params.id as string);
        setProject(data);
        const idx = STAGES.findIndex(s => s.key === data.project_stage);
        setActiveStage(idx !== -1 ? idx : 0);

        const matches = await projectService.getProjectMatches(params.id as string);
        setCapitalMatches(matches.capital);
        setTechnicalMatches(matches.technical);

        try {
          const engagements = await engagementService.getProjectEngagements(params.id as string);
          setProjectEngagements(engagements || []);
        } catch {}
      } catch (error) {
        console.error('Error fetching project:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchProject();
  }, [params.id]);

  // ── View tracking ──────────────────────────────────────────
  useEffect(() => {
    if (project && user && !isPlatformAdmin) {
      apiClient.post(`/projects/${project.id}/view`, {}).catch(() => {});
    }
  }, [project?.id, user?.id]);

  // ── Handlers ───────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project) return;
    setUploading(true);
    try {
      const { file_url, storage_path, file_hash } = await storageService.uploadProjectDocument(project.id, file, file.name);
      const newDoc = await projectService.addProjectDocument({ project_id: project.id, document_type: file.name, file_url, storage_path, file_hash });
      setProject({ ...project, documents: [...(project.documents || []), newDoc] });
      toast.success('Document uploaded');
    } catch (err: any) {
      if (err?.status === 409) {
        toast.error('Duplicate file — an identical document already exists in this project.');
      } else {
        toast.error('Failed to upload document');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string, storagePath: string) => {
    try {
      const result = await projectService.deleteProjectDocument(docId, storagePath, project!.id);
      setProject({ ...project!, documents: project!.documents?.filter(d => d.id !== docId) });
      if (result?.scores_invalidated) {
        setProject(prev => prev ? { ...prev, scores: undefined, status: 'draft' as const } : prev);
        toast.warning('Document removed. AI scores were cleared — re-analyze before going live.');
      } else {
        toast.success('Document removed');
      }
    } catch {
      toast.error('Failed to delete document');
    }
  };

  const runAIAnalysis = async () => {
    if (!project?.documents?.length) { toast.error('Upload documents first'); return; }
    setAnalyzing(true);
    try {
      const responseData = await apiClient.post<{ success: boolean; data: any; cached?: boolean; message?: string }>(`/projects/${project.id}/analyze`, {});
      if (!responseData.success || !responseData.data) throw new Error('AI scoring failed');

      setProject({ ...project, scores: responseData.data, status: 'pending_live' as const });
      toast.success(responseData.cached ? responseData.message || 'Showing cached scores — documents unchanged.' : 'AI analysis complete');
    } catch (err: any) {
      toast.error(`AI analysis failed: ${err.message || 'Unknown error'}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    setDeleting(true);
    try {
      await projectService.deleteProject(project.id);
      toast.success('Project deleted');
      setShowDeleteDialog(false);
      router.push('/dashboard/developer');
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.message}`);
      setDeleting(false);
    }
  };


  const handleManualOverride = async (category: string, score: number) => {
    if (!project?.scores) return;
    const newScores: any = { ...project.scores };
    if (category === 'regulatory') newScores.regulatory_score = score;
    if (category === 'financial') newScores.financial_score = score;
    if (category === 'developer') newScores.developer_score = score;
    newScores.capital_readiness_score = Math.round((newScores.regulatory_score || 0) + (newScores.financial_score || 0) + (newScores.developer_score || 0));
    try {
      const updated = await projectService.saveProjectScores(newScores);
      setProject({ ...project, scores: updated });
    } catch { toast.error('Override failed'); }
  };

  const handleDeactivate = async () => {
    if (!project) return;
    setDeactivating(true);
    try {
      await apiClient.post(`/projects/${project.id}/deactivate`, {});
      const updated = await projectService.getProjectDetails(project.id);
      setProject(updated);
      setShowDeactivateDialog(false);
      toast.success('Project deactivated.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to deactivate');
      setDeactivating(false);
    }
  };

  const handleReactivate = async () => {
    if (!project) return;
    try {
      await apiClient.patch(`/projects/${project.id}`, { status: 'live' });
      const updated = await projectService.getProjectDetails(project.id);
      setProject(updated);
      toast.success('Project reactivated.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reactivate');
    }
  };

  const handleExpressInterest = async () => {
    if (!project || !user?.company_id) return;
    setExpressingInterest(true);
    try {
      const eng = await engagementService.requestIntroduction(project.id, user.company_id, 'CAPITAL');
      if (eng) {
        setPartnerEngagement(eng);
        toast.success('Interest expressed! The developer has been notified.');
        router.push(`/dashboard/engagements/${eng.id}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to express interest');
    } finally {
      setExpressingInterest(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-10 px-4">
        <PageSkeleton />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-6xl mx-auto py-20 text-center">
        <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Icons.fileText className="size-8 text-slate-300" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Project Not Found</h2>
        <p className="text-sm text-slate-500 mb-6">This project doesn't exist or you don't have access.</p>
        <Link href="/dashboard/developer">
          <Button className="h-10 px-6 rounded-xl">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const stageIndex = activeStage;
  const progressPct = (stageIndex / (STAGES.length - 1)) * 100;
  const readinessScore = project.scores?.capital_readiness_score || 0;

  // Engagement lock
  const hasActiveEngagement = capitalMatches.some((m: any) =>
    ['NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET'].includes(m.status)
  ) || technicalMatches.some((m: any) =>
    ['NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET'].includes(m.status)
  );

  const editableStatuses = ['draft', 'scoring', 'pending_live', 'deactivated'];
  const canEdit = (isCreator || isPlatformAdmin) && editableStatuses.includes(project.status || '') && !hasActiveEngagement;
  const canDelete = (isCreator || isPlatformAdmin) && !hasActiveEngagement;
  const canDeactivate = (isCreator || isPlatformAdmin) && (project.status === 'live' || project.status === 'pending_live');
  const canReactivate = (isCreator || isPlatformAdmin) && project.status === 'deactivated' || (isPlatformAdmin && project.status === 'archived');
  const isEffectivelyLive = project.status === 'live' && !!(project as any).is_visible_to_investors;
  const canSeeMatching = isEffectivelyLive && (user?.is_org_admin || user?.is_platform_admin);

  // Countdown for pending_live
  const scoresVisibleAt = (project as any).scores_visible_at ? new Date((project as any).scores_visible_at) : null;
  const scoresStillPending = project.status === 'pending_live' && !!scoresVisibleAt && scoresVisibleAt.getTime() > now;
  const msRemaining = scoresVisibleAt ? Math.max(0, scoresVisibleAt.getTime() - now) : 0;
  const hoursUntilLive = Math.floor(msRemaining / 3_600_000);
  const minsUntilLive  = Math.floor((msRemaining % 3_600_000) / 60_000);
  const secsUntilLive  = Math.floor((msRemaining % 60_000) / 1_000);
  const countdownLabel = scoresStillPending
    ? `${String(hoursUntilLive).padStart(2, '0')}:${String(minsUntilLive).padStart(2, '0')}:${String(secsUntilLive).padStart(2, '0')}`
    : null;

  // Status badge — use real status from DB
  const st = STATUS_CONFIG[project.status || 'draft'] || STATUS_CONFIG.draft;

  // Support prompt
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@placeholder.com';
  const showSupportPrompt = isOwner && !!project.scores && readinessScore < 40;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">

      {/* ── Back Nav ─────────────────────────────────── */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest">
        <Icons.arrowLeft className="size-3.5" /> Back
      </button>

      {/* ── Hero Card ────────────────────────────────── */}
      <div className="dash-card p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-bl-[160px] -z-10" />

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
          <div className="flex-1">
            {/* Status Badge */}
            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border mb-4", st.bg, st.color, st.border)}>
              <span className="size-1.5 rounded-full bg-current" />
              {st.label}
            </span>



            {/* Project Name */}
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
              {project.name}
            </h1>

            {/* Meta Pills */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700">
                <Icons.zap className="size-3 text-primary" /> {project.project_size_mw} MW
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700">
                <Icons.mapPin className="size-3 text-primary" /> {project.location_country}{project.location_region ? `, ${project.location_region}` : ''}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700">
                <Icons.dollarSign className="size-3 text-primary" /> ZMW {(project.capital_required / 1_000_000).toFixed(1)}M
              </span>
              {project.technology_type && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700">
                  <Icons.cpu className="size-3 text-primary" /> {project.technology_type}
                </span>
              )}
            </div>
          </div>

          {/* Readiness Score */}
          <div className="shrink-0 w-40">
            <div className="p-5 rounded-2xl bg-white border border-slate-100 text-center">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Readiness</p>
              <p className="text-4xl font-black text-primary leading-none">{readinessScore}<span className="text-lg">%</span></p>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-700", readinessScore >= 60 ? 'bg-emerald-500' : readinessScore >= 40 ? 'bg-amber-500' : 'bg-red-400')} style={{ width: `${readinessScore}%` }} />
              </div>
            </div>
            {/* Submit checklist — owner + draft/scoring only */}
            {isOwner && (project.status === 'draft' || project.status === 'scoring') && (
              <div className="mt-3 space-y-1">
                {[
                  { label: 'Documents uploaded', met: (project.documents?.length ?? 0) > 0 },
                  { label: 'AI analysis done', met: !!project.scores },
                  { label: 'Score ≥ 40', met: readinessScore >= 40 },
                ].map((r, i) => (
                  <div key={i} className={cn("flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-bold", r.met ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500')}>
                    {r.met ? <Icons.check className="size-2.5 shrink-0" /> : <Icons.close className="size-2.5 shrink-0" />}
                    <span className="leading-tight">{r.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stage Stepper */}
        <div className="relative pt-6">
          <div className="absolute top-10 left-0 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="bg-primary h-full rounded-full transition-all duration-700" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="relative flex justify-between">
            {STAGES.map((s, i) => (
              <div key={s.key} className="flex flex-col items-center gap-2 z-10">
                <div className={cn(
                  "size-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all",
                  i < stageIndex && "bg-primary border-primary text-white",
                  i === stageIndex && "bg-white border-primary text-primary ring-4 ring-primary/10 scale-110",
                  i > stageIndex && "bg-white border-slate-200 text-slate-400"
                )}>
                  {i < stageIndex ? <Icons.check className="size-4" color="#fff" /> : i + 1}
                </div>
                <span className={cn("text-[9px] font-bold uppercase tracking-widest text-center max-w-[64px]", i > stageIndex ? 'text-slate-400' : 'text-slate-700')}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Countdown banner — owner only, while scores are pending */}
        {isOwner && scoresStillPending && countdownLabel && (
          <div className="relative overflow-hidden bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-transparent px-5 py-4 rounded-2xl mt-6">
            {/* Subtle animated shimmer */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-100/30 to-transparent animate-pulse pointer-events-none" />

            <div className="relative flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm shadow-amber-500/25">
                  <Icons.clock className="size-5 text-green-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-0.5">Going Live In</p>
                  <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                    Your project will become visible to investors after the reveal window.
                  </p>
                </div>
              </div>

              {/* Countdown digits */}
              <div className="shrink-0 flex items-center gap-1.5">
                {countdownLabel.split(':').map((segment, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="flex flex-col items-center">
                      <span className="font-mono text-2xl font-black text-amber-700 tabular-nums leading-none bg-white/80 px-2.5 py-1.5 rounded-lg border border-amber-200/50 shadow-sm">
                        {segment}
                      </span>
                      <span className="text-[8px] font-bold text-amber-500/70 uppercase tracking-wider mt-1">
                        {i === 0 ? 'hrs' : i === 1 ? 'min' : 'sec'}
                      </span>
                    </div>
                    {i < 2 && (
                      <span className="text-lg font-bold text-amber-300 mb-3">:</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Action Bar */}
        {(canEdit || canDelete || canDeactivate || canReactivate || (isPlatformAdmin && project.scores) || isPartner) && (
          <div className="flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-slate-100">

            {/* Bookmark button — everyone */}
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 rounded-xl p-0 border-slate-200"
              onClick={handleToggleBookmark}
              disabled={bookmarking}
              title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
            >
              {bookmarking ? (
                <Icons.spinner className="size-3.5 animate-spin" />
              ) : (
                <Icons.bookmark className={cn('size-3.5', isBookmarked ? 'fill-amber-400 text-amber-400' : 'text-slate-400')} />
              )}
            </Button>

            {/* Partner: Express Interest / Expressed badge */}
            {isPartner && (
              partnerEngagement ? (
                <Link href={`/dashboard/engagements/${partnerEngagement.id}`}>
                  <Button
                    disabled
                    className="h-9 px-5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold text-xs cursor-pointer hover:bg-emerald-100"
                  >
                    <Icons.check className="size-3.5 mr-1.5" /> Expressed
                  </Button>
                </Link>
              ) : (
                <Button
                  onClick={handleExpressInterest}
                  disabled={expressingInterest}
                  className="h-9 px-5 rounded-xl bg-slate-900 text-white font-bold text-xs"
                >
                  {expressingInterest ? <Icons.spinner className="size-3.5 animate-spin mr-1.5" /> : <Icons.send className="size-3.5 mr-1.5" />}
                  Express Interest
                </Button>
              )
            )}

            {canEdit && (
              <Link href={`/dashboard/developer/submit?edit=${project.id}`}>
                <Button variant="outline" className="h-9 px-5 rounded-xl border-slate-200 font-bold text-xs">
                  <Icons.pencil className="size-3.5 mr-1.5" /> Edit Project
                </Button>
              </Link>
            )}

            {(isCreator || isPlatformAdmin) && project.scores && (
              <Button
                variant="outline"
                className="h-9 px-5 rounded-xl border-slate-200 font-bold text-xs"
                onClick={runAIAnalysis}
                disabled={analyzing}
              >
                {analyzing ? <Icons.spinner className="size-3.5 animate-spin mr-1.5" /> : <Icons.zap className="size-3.5 mr-1.5" />}
                Re-run Analysis
              </Button>
            )}

            {canDeactivate && (
              <Button
                variant="outline"
                className="h-9 px-5 rounded-xl border-orange-200 text-orange-600 font-bold text-xs hover:bg-orange-50"
                onClick={() => setShowDeactivateDialog(true)}
              >
                <Icons.eyeOff className="size-3.5 mr-1.5" /> Deactivate
              </Button>
            )}

            {canReactivate && (
              <Button
                className="h-9 px-5 rounded-xl bg-emerald-600 text-white font-bold text-xs"
                onClick={handleReactivate}
              >
                <Icons.eye className="size-3.5 mr-1.5" /> Reactivate
              </Button>
            )}

            {hasActiveEngagement && (isOwner || isPlatformAdmin) && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg">
                Edits & deletion locked — active partner discussions in progress
              </span>
            )}

            {canDelete && (
              <Button onClick={() => setShowDeleteDialog(true)} variant="ghost" className="h-9 px-4 rounded-xl text-red-500 hover:bg-red-50 font-bold text-xs ml-auto">
                <Icons.trash className="size-3.5 mr-1.5" /> Delete
              </Button>
            )}
          </div>
        )}

        
                {/* Support prompt — owner only, score < 40 */}
                {showSupportPrompt && (
                  <div className="mt-6 flex items-start gap-2 bg-amber-50/60 border border-amber-100 p-3 rounded-lg">
                    <span className="size-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Score Below Threshold</p>
                      <p className="text-[11px] font-semibold text-slate-700 leading-relaxed mb-2">
                        Your project scored below 40. Our consultancy team can help you improve your readiness before going live.
                      </p>
                      <button
                        onClick={() => {
                          const subject = encodeURIComponent(`Project Readiness Support — ${project.name}`);
                          const body = encodeURIComponent(`Hi,\n\nI'd like help improving my project readiness score.\n\nProject: ${project.name}\nCurrent Score: ${readinessScore}%\n\nPlease reach out at your earliest convenience.\n\nThank you.`);
                          window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
                        }}
                        className="text-[10px] font-black text-amber-700  tracking-widest"
                      >
                        Need help bringing your project up to standard? →
                      </button>
                    </div>
                  </div>
                )}
      </div>

      {/* ── Main Grid ────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Technical Specs */}
          <div className="dash-card p-6">
            <h3 className="dash-section-label mb-5 flex items-center gap-2">
              <div className="size-6 bg-primary/10 rounded-lg flex items-center justify-center"><Icons.zap className="size-3 text-primary" /></div>
              Technical Specifications
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
              <SpecItem label="Technology" value={project.technology_type || 'N/A'} />
              <SpecItem label="Grid Status" value={project.tech_requirements?.grid_status || 'Pending'} />
              <SpecItem label="Land Status" value={project.has_secured_land ? 'Secured' : 'In Progress'} />
              <SpecItem label="Capital Structure" value={project.capital_structure_type || 'N/A'} />
              <SpecItem label="Financial Close" value={project.target_financial_close_date || 'TBD'} />
              <SpecItem label="COD Target" value={project.target_cod || 'TBD'} />
              <SpecItem label="Stage" value={project.project_stage?.replace(/_/g, ' ') || 'N/A'} />
              <SpecItem label="Land Title" value={project.land_title_status || 'N/A'} />
              {project.regulatory_approvals && project.regulatory_approvals.length > 0 && (
                <div className="col-span-2 md:col-span-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Regulatory Approvals</p>
                  <div className="flex flex-wrap gap-1.5">
                    {project.regulatory_approvals.map((a: string) => (
                      <span key={a} className="px-2 py-0.5 bg-primary/5 text-primary text-[10px] font-bold rounded border border-primary/10">{a}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Governance / Risk / Exit — shown for owner or validated */}
          {(isOwner || project.status === 'live') && (project.governance_terms || project.exit_terms || project.risk_disclosures) && (
            <div className="dash-card p-6">
              <h3 className="dash-section-label mb-5 flex items-center gap-2">
                <div className="size-6 bg-primary/10 rounded-lg flex items-center justify-center"><Icons.shieldCheck className="size-3 text-primary" /></div>
                Deal Terms
              </h3>
              <div className="grid md:grid-cols-3 gap-6">
                {project.governance_terms && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Governance</p>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">{project.governance_terms}</p>
                  </div>
                )}
                {project.exit_terms && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Exit Strategy</p>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">{project.exit_terms}</p>
                  </div>
                )}
                {project.risk_disclosures && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Risk Disclosures</p>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">{project.risk_disclosures}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Scoring */}
          <div className="dash-card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="dash-section-label flex items-center gap-2">
                <div className="size-6 bg-primary/10 rounded-lg flex items-center justify-center"><Icons.zap className="size-3 text-primary" /></div>
                AI Readiness Insights
              </h3>
              {isPlatformAdmin && project.scores && (
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-8 px-3 rounded-lg border-slate-200 text-[10px] font-bold" onClick={() => setShowOverride(!showOverride)}>
                    {showOverride ? 'Close' : 'Override'}
                  </Button>
                  <Button size="sm" className="h-8 px-3 rounded-lg bg-primary text-white text-[10px] font-bold" onClick={runAIAnalysis} disabled={analyzing}>
                    {analyzing ? <Icons.spinner className="size-3 animate-spin mr-1" /> : <Icons.zap className="size-3 mr-1" />}
                    Re-run
                  </Button>
                </div>
              )}
            </div>

            {project.scores ? (
              <>
                {/* Override Panel — platform admin only */}
                {showOverride && isPlatformAdmin && (
                  <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Manual Score Adjustment</p>
                    <div className="grid md:grid-cols-3 gap-4">
                      <OverrideSlider label="Regulatory" value={project.scores.regulatory_score || 0} max={40} onChange={(v) => handleManualOverride('regulatory', v)} />
                      <OverrideSlider label="Financial" value={project.scores.financial_score || 0} max={35} onChange={(v) => handleManualOverride('financial', v)} />
                      <OverrideSlider label="Developer" value={project.scores.developer_score || 0} max={25} onChange={(v) => handleManualOverride('developer', v)} />
                    </div>
                  </div>
                )}

                {/* Score Pillars */}
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <ScorePillar label="Regulatory" score={project.scores.regulatory_score || 0} max={40} color="text-blue-600" details={project.scores.breakdown?.regulatory?.details} />
                  <ScorePillar label="Financial" score={project.scores.financial_score || 0} max={35} color="text-emerald-600" details={project.scores.breakdown?.financial?.details} />
                  <ScorePillar label="Developer" score={project.scores.developer_score || 0} max={25} color="text-amber-600" details={project.scores.breakdown?.developer?.details} />
                </div>

                {/* Executive Summary */}
                {project.scores.summary && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mb-6">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Icons.zap className="size-3 text-primary" /> Executive Summary
                    </p>
                    <p className="text-xs text-slate-700 leading-relaxed font-medium italic">"{project.scores.summary}"</p>
                  </div>
                )}


                {/* Risk Flags + Recommendations */}
                <div className="grid md:grid-cols-2 gap-6">
                  <CollapsibleList
                    title="Risk Flags"
                    titleIcon={<Icons.shieldCheck className="size-3" />}
                    titleColor="text-red-500"
                    items={project.scores.risk_flags || []}
                    showAll={showAllFlags}
                    onToggle={() => setShowAllFlags(v => !v)}
                    previewCount={PREVIEW_COUNT}
                    renderItem={(item) => (
                      <li key={item} className="text-[11px] font-semibold text-slate-700 flex items-start gap-2 bg-red-50/50 p-2.5 rounded-lg border border-red-100/50">
                        <span className="size-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                        {item}
                      </li>
                    )}
                  />
                  <CollapsibleList
                    title="Recommendations"
                    titleIcon={<Icons.zap className="size-3" />}
                    titleColor="text-primary"
                    items={project.scores.recommendations || []}
                    showAll={showAllRecs}
                    onToggle={() => setShowAllRecs(v => !v)}
                    previewCount={PREVIEW_COUNT}
                    renderItem={(item) => (
                      <li key={item} className="text-[11px] font-semibold text-slate-700 flex items-start gap-2 bg-primary/5 p-2.5 rounded-lg border border-primary/10">
                        <span className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        {item}
                      </li>
                    )}
                  />
                </div>
              </>
            ) : (
              <div className="p-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <div className="size-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Icons.zap className="size-6 text-slate-300" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">No Analysis Yet</h4>
                <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto mb-2">
                  AI readiness scoring runs automatically after project creation.
                </p>
                {(isOwner || isPlatformAdmin) && (
                  <Button onClick={runAIAnalysis} disabled={analyzing || !project.documents?.length} className="h-10 px-6 bg-primary text-white font-bold rounded-xl text-xs shadow-lg shadow-primary/10 mt-3">
                    {analyzing ? <Icons.spinner className="size-3.5 animate-spin mr-1.5" /> : <Icons.zap className="size-3.5 mr-1.5" />}
                    Run AI Analysis
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Data Room / Documents */}
          <div className="dash-card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="dash-section-label flex items-center gap-2">
                <div className="size-6 bg-primary/10 rounded-lg flex items-center justify-center"><Icons.fileText className="size-3 text-primary" /></div>
                {isOwner ? 'Data Room' : isPartner && hasNda ? 'Due Diligence Room' : 'Secure Data Room'}
              </h3>
              {isCreator && (
                <>
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg" />
                  <Button variant="outline" className="h-8 px-3 rounded-lg border-slate-200 text-[10px] font-bold" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Icons.spinner className="size-3 animate-spin mr-1" /> : <Icons.plus className="size-3 mr-1" />}
                    Upload
                  </Button>
                </>
              )}
            </div>

            {(isOwner || hasNda) ? (
              project.documents && project.documents.length > 0 ? (
                <div className="space-y-2">
                  {project.documents.map((doc, i) => (
                    <DocumentRow key={i} name={doc.document_type} date={new Date(doc.uploaded_at).toLocaleDateString()} canDelete={isCreator} onDelete={() => handleDeleteDocument(doc.id, doc.storage_path || '')} projectId={project.id} storagePath={doc.storage_path || ''} />
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No documents uploaded</p>
                </div>
              )
            ) : (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-100">
                <Icons.lock className="size-6 mx-auto text-slate-300 mb-3" />
                <h4 className="text-xs font-bold text-slate-700 mb-1">Secure Data Room — Locked</h4>
                {isPartner && partnerEngagement ? (
                  <>
                    <p className="text-[11px] text-slate-500 font-medium max-w-xs mx-auto mb-1">
                      Your engagement is currently at <span className="font-bold text-slate-700">{getStateLabel(partnerEngagement.status)}</span>.
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium max-w-xs mx-auto mb-4">
                      Progress to <span className="font-bold text-slate-700">NDA Signed</span> to unlock document access.
                    </p>
                    <Link href={`/dashboard/engagements/${partnerEngagement.id}`}>
                      <Button className="h-9 px-5 rounded-xl bg-slate-900 text-white text-xs font-bold">
                        Go to Engagement Room
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] text-slate-500 font-medium max-w-xs mx-auto mb-4">
                      Document access requires a signed NDA. Express interest to start the engagement process.
                    </p>
                    {isPartner && (
                      <Button
                        onClick={handleExpressInterest}
                        disabled={expressingInterest}
                        className="h-9 px-5 rounded-xl bg-slate-900 text-white text-xs font-bold"
                      >
                        {expressingInterest ? <Icons.spinner className="size-3.5 animate-spin mr-1.5" /> : <Icons.send className="size-3.5 mr-1.5" />}
                        Express Interest
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Sidebar ───────────────────────────── */}
        <div className="space-y-6">

          {/* Project Status Card */}
          <div className="p-6 rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-bl-[80px]" />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Project Status</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</span>
                <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border", st.bg, st.color, st.border)}>
                  <span className="size-1.5 rounded-full bg-current" />
                  {st.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stage</span>
                <span className="text-xs font-bold">{project.project_stage?.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Capital</span>
                <span className="text-xs font-bold">ZMW {(project.capital_required / 1_000_000).toFixed(1)}M</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Matches</span>
                <span className="text-lg font-black text-primary">{capitalMatches.length + technicalMatches.length}</span>
              </div>
            </div>
            {isOwner && (
              <Link href={`/projects/${project.id}/analytics`}>
                <Button className="w-full h-10 rounded-xl bg-primary text-white font-bold text-xs mt-5 hover:bg-primary/90">
                  View Analytics
                </Button>
              </Link>
            )}
          </div>

          {/* Developer Info */}
          {project.developer && (
            <div className="dash-card p-5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Developer</p>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                  {project.developer.logo_url ? (
                    <img src={project.developer.logo_url} alt="" className="h-7 w-7 object-contain" />
                  ) : (
                    <Icons.building className="size-4 text-primary" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">{project.developer.name}</p>
                  <p className="text-[10px] text-slate-500 font-medium">{project.developer.country}</p>
                </div>
              </div>
            </div>
          )}

          {/* Engagements */}
          <div className="dash-card overflow-hidden">
            <div className="p-4 border-b border-slate-50">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Engagements</p>
            </div>
            <div className="p-5">
              {(!isOwner && isPartner) ? (
                partnerEngagement ? (
                  <Link href={`/dashboard/engagements/${partnerEngagement.id}`} className="block">
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer">
                      <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">ENG</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-slate-700">Your Engagement</p>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[9px] font-bold border border-emerald-100 mt-1">
                          {getStateLabel(partnerEngagement.status)}
                        </span>
                      </div>
                      <Icons.arrowRight className="size-3.5 text-slate-400 shrink-0 mt-0.5" />
                    </div>
                  </Link>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[11px] font-bold text-slate-400 text-center">No engagement yet</p>
                    <Button
                      onClick={handleExpressInterest}
                      disabled={expressingInterest}
                      className="w-full h-9 rounded-xl bg-slate-900 text-white text-xs font-bold"
                    >
                      {expressingInterest ? (
                        <Icons.spinner className="size-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Icons.send className="size-3.5 mr-1.5" />
                      )}
                      Express Interest
                    </Button>
                  </div>
                )
              ) : isOwner ? (
                <p className="text-[11px] font-bold text-slate-400 text-center">{capitalMatches.length + technicalMatches.length} partner{capitalMatches.length + technicalMatches.length !== 1 ? 's' : ''} matched</p>
              ) : (
                <p className="text-[11px] font-bold text-slate-400 text-center">No engagements</p>
              )}
            </div>
            {(!isOwner && isPartner) ? (
              <Link href="/dashboard?tab=portfolio">
                <div className="p-3 border-t border-slate-50 text-center">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">Open Engagement Center</span>
                </div>
              </Link>
            ) : isOwner ? (
              <Link href="/dashboard/developer?tab=engagements">
                <div className="p-3 border-t border-slate-50 text-center">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">Open Engagement Center</span>
                </div>
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Matching Section (live projects, org admins only) ───── */}
      {canSeeMatching && (
        <MatchingSection
          projectId={project.id}
          projectTechnology={project.technology_type}
          capitalMatches={capitalMatches}
          technicalMatches={technicalMatches}
          engagements={projectEngagements}
          isOrgAdmin={!!(user?.is_org_admin || user?.is_platform_admin)}
        />
      )}

      {/* ── Matched Partners notice — shown when project is not yet effectively live ── */}
      {isOwner && !isEffectivelyLive && project.status !== 'deactivated' && project.status !== 'archived' && (
        <div className="dash-card p-6 flex items-start gap-4">
          <div className="size-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Icons.users className="size-5 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 mb-1">Matched Partners</p>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Investor and technical partner matches will appear here once your project goes live.
              {scoresStillPending && countdownLabel && (
                <span className="inline-flex items-center gap-1.5 text-amber-600 font-bold">
                  <Icons.clock className="size-3" />
                  Goes live in {countdownLabel}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* ── Confirm Dialogs ──────────────────────── */}
      <ConfirmDialog
        open={showDeactivateDialog}
        onClose={() => !deactivating && setShowDeactivateDialog(false)}
        onConfirm={handleDeactivate}
        title={`Deactivate "${project?.name}"?`}
        description="This project will no longer be visible to investors and technical partners. You can reactivate it later."
        confirmLabel="Deactivate"
        confirmVariant="danger"
        loading={deactivating}
      />

      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => !deleting && setShowDeleteDialog(false)}
        onConfirm={handleDeleteProject}
        title={`Delete "${project?.name}"?`}
        description="This action cannot be undone. All project data, documents, scores, and match history will be permanently removed."
        confirmLabel="Delete Project"
        confirmVariant="danger"
        loading={deleting}
      />
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

function SpecItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xs font-bold text-slate-900">{value}</p>
    </div>
  );
}

function ScorePillar({ label, score, max, color, details }: { label: string; score: number; max: number; color: string; details?: any }) {
  const pct = (score / max) * 100;
  return (
    <div className="p-4 rounded-xl bg-white border border-slate-100 text-center">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3">{label}</p>
      <div className="relative size-20 flex items-center justify-center mx-auto mb-3">
        <svg className="size-full -rotate-90">
          <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-100" />
          <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray={226} strokeDashoffset={226 - (226 * pct) / 100} strokeLinecap="round" className={cn("transition-all duration-700", color)} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black text-slate-900 leading-none">{score}</span>
          <span className="text-[9px] font-bold text-slate-400">/ {max}</span>
        </div>
      </div>
      {details && (
        <div className="space-y-1">
          {Object.entries(details).slice(0, 2).map(([key, val]: [string, any]) => (
            <div key={key} className="flex justify-between text-[9px] font-bold text-slate-400">
              <span className="truncate">{key.replace(/_/g, ' ')}</span>
              <span className="text-slate-700 shrink-0 ml-2">{val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OverrideSlider({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
        <span className="text-[10px] font-bold text-primary">{value}/{max}</span>
      </div>
      <input type="range" min="0" max={max} value={value} onChange={(e) => onChange(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary" />
    </div>
  );
}

function DocumentRow({ name, date, canDelete, onDelete, projectId, storagePath }: { name: string; date: string; canDelete?: boolean; onDelete?: () => void; projectId: string; storagePath?: string }) {
  const handleOpen = async () => {
    if (!storagePath) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/documents/download?storage_path=${encodeURIComponent(storagePath)}`);
      if (!res.ok) return;
      const { signedUrl } = await res.json();
      if (signedUrl) window.open(signedUrl, '_blank');
    } catch {}
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-primary/20 group transition-all" onClick={handleOpen}>
      <div className="flex items-center gap-3 cursor-pointer">
        <div className="h-9 w-9 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
          <Icons.fileText className="size-4" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-900 group-hover:text-primary transition-colors">{name}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{date}</p>
        </div>
      </div>
      {canDelete && (
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); onDelete?.(); }}>
          <Icons.trash className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

function CollapsibleList({ title, titleIcon, titleColor, items, showAll, onToggle, previewCount, renderItem }: {
  title: string; titleIcon: React.ReactNode; titleColor: string;
  items: string[]; showAll: boolean; onToggle: () => void; previewCount: number;
  renderItem: (item: string) => React.ReactNode;
}) {
  const visibleItems = showAll ? items : items.slice(0, previewCount);
  const hasMore = items.length > previewCount;

  return (
    <div className="space-y-3">
      <h4 className={cn("text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5", titleColor)}>
        {titleIcon} {title}
      </h4>
      <ul className="space-y-1.5">
        {visibleItems.map((item, i) => (
          <div key={item} className="animate-in fade-in slide-in-from-top-1 duration-300" style={{ animationDelay: `${i * 30}ms` }}>
            {renderItem(item)}
          </div>
        ))}
      </ul>
      {hasMore && (
        <button onClick={onToggle} className={cn("text-[9px] font-black uppercase tracking-widest hover:underline", titleColor)}>
          {showAll ? 'Show Less' : `+${items.length - previewCount} more`}
        </button>
      )}
    </div>
  );
}

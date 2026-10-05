'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { projectService } from '@/services/projects';
import { Project, CapitalMatchResult, TechnicalMatchResult, ProjectStage, CounterpartyType } from '@/types';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { cn, formatUploadDate } from '@/lib/utils';
import { READINESS_ACTION_THRESHOLD, readinessBandStyle } from '@/lib/readiness-thresholds';
import { MatchingSection } from '@/components/MatchingSection';
import { storageService } from '@/lib/storage';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { engagementService, getStateLabel } from '@/lib/engagement';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { FileUpload } from '@/components/ui/FileUpload';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Engagement } from '@/types';
import { AiInsightsPanel } from '@/components/developer/AiInsightsPanel';
import { ReviewHistory } from '@/components/developer/ReviewHistory';
import { PageHero } from '@/components/ui/PageHero';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { DocumentViewer } from '@/components/ui/DocumentViewer';


const STAGES: { key: ProjectStage; label: string }[] = [
  { key: 'CONCEPT', label: 'Concept' },
  { key: 'PRE_FEASIBILITY', label: 'Pre-Feas.' },
  { key: 'FULL_FEASIBILITY', label: 'Full Feas.' },
  { key: 'REGULATORY_APPROVAL', label: 'Regulatory' },
  { key: 'PPA_READY', label: 'PPA Ready' },
  { key: 'FINANCIAL_CLOSE', label: 'Fin. Close' },
  { key: 'CONSTRUCTION', label: 'Construction' },
  { key: 'OPERATION', label: 'Operation' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft:         { label: 'Draft',                       color: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-100' },
  scoring:       { label: 'Scoring',                     color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100' },
  scoring_retry: { label: 'Re-analyzing',                color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100' },
  under_review:  { label: 'Under Regulator Review',      color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
  pending_live:  { label: 'Pending Live (legacy)',       color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
  live:          { label: 'Live',                        color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  deactivated:   { label: 'Deactivated',                 color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-100' },
  archived:      { label: 'Archived',                    color: 'text-slate-400',   bg: 'bg-slate-50',   border: 'border-slate-100' },
};

function PageSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-40 w-full" />
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-none" />)}
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-80" />
        </div>
        <Skeleton className="h-96" />
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

  const [viewerDoc, setViewerDoc] = useState<{ storagePath: string; label: string; mimeType?: string | null } | null>(null);

  const PREVIEW_COUNT = 3;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refetch while the project is still being analysed (post-submit) or
  // while a legacy countdown is running. Polling interval is intentionally
  // long (5s) so we don't hammer the server while waiting for the AI to finish.
  const wasPendingRef = useRef(false);
  useEffect(() => {
    if (!project) return;
    const isAnalysing = project.status === 'scoring' || project.status === 'scoring_retry';
    if (isAnalysing) {
      const t = setTimeout(async () => {
        try {
          const data = await projectService.getProjectDetails(params.id as string);
          setProject(data);
        } catch {}
      }, 5000);
      return () => clearTimeout(t);
    }

    if (project.status !== 'pending_live' || !project.scores_visible_at) {
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
            const matches = await projectService.getProjectMatches(params.id as string, incomingEngagementId || undefined)
              .catch((e: any) => {
                if (e?.status !== 403) console.error('Error fetching project matches:', e);
                return { capital: [], technical: [], consultant: [] };
              });
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
  //
  // The page serves three audiences with very different affordances:
  //   1. Developer owner — the org that created the project.
  //   2. Partner prospect — a capital / technical / grant / trader org
  //      browsing the marketplace, eligible to express interest.
  //   3. Reviewer / admin — authority user or platform admin reviewing or
  //      moderating; not eligible to "express interest" or see the
  //      developer's incoming-engagement list.
  const isPlatformAdmin = !!user?.is_platform_admin;
  const isAuthorityUser = !!(user as any)?.is_authority_user;
  const isReviewer = isPlatformAdmin || isAuthorityUser;
  // "Acts-as-owner" for the destructive action bar (Edit/Delete/Deactivate):
  // the developer's own org OR a platform admin.
  const isOwnerLike = !!project && !!user && (
    project.developer_id === user.company_id
  );
  const isAdminOrOwner = isOwnerLike || isPlatformAdmin;
  const isCreator = !!project && !!user && (
    project.created_by === user.id
  );
  // For partner-style affordances (incoming-engagement sidebar, "Express
  // Interest" CTAs) the developer is the owner; everyone else who is
  // eligible to act as a counterparty in the marketplace is a partner.
  // Reviewers and admins are intentionally excluded.
  const isOwner = isOwnerLike;
  const PARTNER_ROLES = new Set(['CAPITAL_PARTNER', 'TECHNICAL_PARTNER', 'GRANT_PROVIDER', 'POWER_TRADER', 'CONSULTANT']);
  const isPartner = !!project && !!user && (
    !isOwner
    && !isReviewer
    && !!user.company_id
    && project.developer_id !== user.company_id
    && (PARTNER_ROLES.has(String(user.role || '')) || PARTNER_ROLES.has(String((user as any).primary_role || '')))
  );
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

        // Partners without an engagement legitimately get 403 on project
        // matches — that's not an error state for the page, it just means the
        // matching section stays hidden. Swallow quietly (403 only).
        const matches = await projectService.getProjectMatches(params.id as string, incomingEngagementId || undefined)
          .catch((e: any) => {
            if (e?.status !== 403) console.error('Error fetching project matches:', e);
            return { capital: [], technical: [], consultant: [] };
          });
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
  const handleFileUploadViaComponent = async (files: File[]) => {
    if (!project) return;
    // Map common proof filenames to their proof-type constants so the
    // analyze route's proof check can find them by exact document_type.
    const PROOF_KEYWORDS: [string, string][] = [
      ['financial_close', 'FINANCIAL_CLOSE_PROOF'],
      ['financialclose',  'FINANCIAL_CLOSE_PROOF'],
      ['financial close', 'FINANCIAL_CLOSE_PROOF'],
      ['land_title',      'LAND_TITLE_PROOF'],
      ['landtitle',       'LAND_TITLE_PROOF'],
      ['land title',      'LAND_TITLE_PROOF'],
      ['zema',            'APPROVAL_PROOF_ZEMA'],
      ['grid_connection', 'APPROVAL_PROOF_GRID'],
      ['ppa',             'APPROVAL_PROOF_PPA'],
      ['construction_permit', 'APPROVAL_PROOF_PERMIT'],
    ];
    const resolveDocType = (fileName: string): string => {
      const lower = fileName.toLowerCase();
      for (const [keyword, type] of PROOF_KEYWORDS) {
        if (lower.includes(keyword)) return type;
      }
      return fileName;
    };
    for (const file of files) {
      try {
        setUploading(true);
        const docType = resolveDocType(file.name);
        const { file_url, storage_path, file_hash } = await storageService.uploadProjectDocument(project.id, file, docType);
        const newDoc = await projectService.addProjectDocument({ project_id: project.id, document_type: docType, file_url, storage_path, file_hash });
        setProject(prev => prev ? { ...prev, documents: [...(prev.documents || []), newDoc] } : prev);
        toast.success(`"${file.name}" uploaded`);
      } catch (err: any) {
        if (err?.status === 409) {
          toast.error(`"${file.name}" is a duplicate — an identical file already exists.`);
        } else {
          toast.error(`Failed to upload "${file.name}": ${err?.message || 'Unknown error'}`);
        }
      } finally {
        setUploading(false);
      }
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
      if (!responseData.success) throw new Error('AI scoring failed');

      // Scoring never moves a project by itself: a SUBMITTED project completes
      // into `under_review` (the review queue), while a draft stays a draft so
      // the developer can keep working on it. Re-read the row for the real
      // outcome instead of assuming review.
      const updated = await projectService.getProjectDetails(project.id);
      const scores = responseData.data as import('@/types').ProjectScore | undefined;
      setProject(scores?.project_id ? { ...updated, scores } : updated);
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
      router.push('/developer');
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.message}`);
      setDeleting(false);
    }
  };


  const handleManualOverride = async (category: string, score: number) => {
    if (!project?.scores) return;
    const newScores = { ...project.scores } as any;
    if (category === 'regulatory') newScores.regulatory_score = score;
    if (category === 'financial') newScores.financial_score = score;
    if (category === 'developer') newScores.developer_score = score;
    newScores.capital_readiness_score = Math.round((newScores.regulatory_score || 0) + (newScores.financial_score || 0) + (newScores.developer_score || 0));
    try {
      const updated = await projectService.saveProjectScores(newScores);
      setProject({ ...project, scores: updated as any });
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
      const roleToCounterpartyType: Record<string, CounterpartyType> = {
        DEVELOPER: 'TECHNICAL',
        TECHNICAL_PARTNER: 'TECHNICAL',
        CAPITAL_PARTNER: 'CAPITAL',
        GRANT_PROVIDER: 'GRANT_PROVIDER',
        CONSULTANT: 'CONSULTANT',
        POWER_TRADER: 'POWER_TRADER',
      };
      const counterpartyType: CounterpartyType = roleToCounterpartyType[user.role] || 'CAPITAL';
      const eng = await engagementService.requestIntroduction(project.id, user.company_id, counterpartyType);
      if (eng) {
        setPartnerEngagement(eng);
        toast.success('Interest expressed! The developer has been notified.');
        router.push(`/engagements/${eng.id}`);
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
        <div className="h-16 w-16 bg-slate-50 flex items-center justify-center mx-auto mb-6">
          <Icons.fileText className="size-8 text-slate-300" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Project Not Found</h2>
        <p className="text-sm text-slate-500 mb-6">This project doesn't exist or you don't have access.</p>
        <Link href="/developer">
          <Button className="h-10 px-6 ">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const stageIndex = activeStage;
  const progressPct = (stageIndex / (STAGES.length - 1)) * 100;
  // AI score is visible only after the authority approves (live) or returns
  // the project with comments. The server already nulls `project.scores` in
  // those cases, but we also check status explicitly so the hero card never
  // shows a misleading "0%" before the developer has any feedback.
  const isScoreVisible = !!project.scores;
  const readinessScore = isScoreVisible ? (project.scores?.capital_readiness_score || 0) : 0;

  // Engagement lock
  const hasActiveEngagement = capitalMatches.some((m: any) =>
    ['NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET'].includes(m.status)
  ) || technicalMatches.some((m: any) =>
    ['NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET'].includes(m.status)
  );

  const editableStatuses = ['draft', 'scoring', 'pending_live', 'live', 'deactivated'];
  // Engagement lock levels — some fields are locked at NDA+, full lock at Term Sheet+
  const SOFT_LOCK_STATUSES = ['NDA_SIGNED', 'DUE_DILIGENCE'];
  const HARD_LOCK_STATUSES = ['TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED'];
  const engagementStatuses = projectEngagements.map(e => e.status);
  const hasSoftLock = engagementStatuses.some(s => SOFT_LOCK_STATUSES.includes(s));
  const hasHardLock = engagementStatuses.some(s => HARD_LOCK_STATUSES.includes(s));
  const canEdit = isCreator && !isReviewer && editableStatuses.includes(project.status || '') && !hasHardLock;
  const canDelete = (isCreator || isPlatformAdmin) && !hasHardLock;
  const canDeactivate = (isCreator || isPlatformAdmin) && (project.status === 'live' || project.status === 'pending_live' || project.status === 'under_review');
  const canReactivate = (isCreator || isPlatformAdmin) && project.status === 'deactivated' || (isPlatformAdmin && project.status === 'archived');
  const isEffectivelyLive = project.status === 'live' && !!(project as any).is_visible_to_investors;
  const canSeeMatching = isEffectivelyLive && isOwner;

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
  const isReturned = project.status === 'draft' && !!(project as any).rejection_reason;
  const st = isReturned
    ? { label: 'Returned for Changes', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' }
    : STATUS_CONFIG[project.status || 'draft'] || STATUS_CONFIG.draft;

  // Support prompt
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@placeholder.com';
  const showSupportPrompt = isOwner && !isReviewer && !isPlatformAdmin && !!project.scores && readinessScore > 0 && readinessScore < 40;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">

      {/* ── Hero (canonical dark-green page header) ─────────── */}
      <PageHero
        topLeft={
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-200/50 hover:text-emerald-200 uppercase tracking-widest transition-colors"
          >
            <Icons.arrowLeft className="size-3" /> Back
          </button>
        }
        eyebrow={project.technology_type?.replace(/_/g, ' ').toLowerCase()}
        title={project.name}
        description={
          <span>
            {project.project_size_mw} MW · {project.location_country}
            {project.location_region ? `, ${project.location_region}` : ''} · ZMW {(project.capital_required / 1_000_000).toFixed(1)}M
          </span>
        }
        actions={
          // Status pill on the right
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-none text-[10px] font-bold tracking-widest border bg-white/10 border-white/15 text-white',
            )}
          >
            <span className="size-1.5 rounded-full bg-emerald-300" />
            {st.label}
          </span>
        }
      />

      {/* ── Readiness Score (separate card, below the hero) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Readiness</p>
          {isScoreVisible ? (
            <>
              <p className="text-4xl font-black text-slate-900 leading-none">
                {readinessScore}<span className="text-lg text-slate-500">%</span>
              </p>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', readinessBandStyle(readinessScore).bar)}
                  style={{ width: `${readinessScore}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-3">Capital readiness score (visible after review).</p>
            </>
          ) : (
            <>
              <p className="text-4xl font-black text-slate-300 leading-none">—</p>
              <p className="text-[10px] text-slate-400 mt-3">Awaiting Regulator Review</p>
            </>
          )}
        </div>

        {/* Submit checklist — owner only, on draft/scoring states */}
        {isOwner && (project.status === 'draft' || project.status === 'scoring') && (
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] md:col-span-2 p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Submit Checklist</p>
            <div className="space-y-1">
              {[
                { label: 'Documents uploaded', met: (project.documents?.length ?? 0) > 0 },
                { label: 'AI analysis done', met: !!project.scores },
                { label: `Score ≥ ${READINESS_ACTION_THRESHOLD}`, met: readinessScore >= READINESS_ACTION_THRESHOLD },
              ].map((r, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-none text-[10px] font-bold',
                    r.met ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500',
                  )}
                >
                  {r.met ? <Icons.check className="size-2.5 shrink-0" /> : <Icons.close className="size-2.5 shrink-0" />}
                  <span className="leading-tight">{r.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <SectionCard noHeader className="overflow-hidden" bodyClassName="">
        {/* Sibling nav */}
        <div className="px-8 py-2 border-b border-slate-100 flex items-center gap-1">
          {[
            { href: `/projects/${project.id}`,        label: 'Overview', icon: 'eye' as const,        active: true },
            ...(isOwner && isEffectivelyLive ? [
              { href: `/projects/${project.id}/matches`, label: 'Matches',  icon: 'search' as const },
              { href: `/projects/${project.id}/gaps`,    label: 'Gaps',     icon: 'fileSearch' as const },
              { href: `/projects/${project.id}/stages`,  label: 'Stages',   icon: 'layers' as const },
            ] : []),
          ].map(tab => {
            const Icon = Icons[tab.icon];
            return (
              <Link key={tab.href} href={tab.href} className={cn(
                'inline-flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold tracking-wider transition-all',
                tab.active ? 'bg-green-800 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              )}>
                <Icon className="size-3" /> {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Stage Stepper */}
        <div className="relative px-8 pt-6 pb-6">
          <div className="absolute top-[52px] left-8 right-8 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="bg-green-800 h-full rounded-full transition-all duration-700" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="relative flex justify-between">
            {STAGES.map((s, i) => (
              <div key={s.key} className="flex flex-col items-center gap-2 z-10">
                <div className={cn(
                  "size-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all",
                  i < stageIndex && "bg-green-800 border-green-800 text-white",
                  i === stageIndex && "bg-white border-green-800 text-green-800 ring-4 ring-green-800/10 scale-110",
                  i > stageIndex && "bg-white border-slate-200 text-slate-400"
                )}>
                  {i < stageIndex ? <Icons.check className="size-4" color="#fff" /> : i + 1}
                </div>
                <span className={cn("text-[10px] font-bold  tracking-widest text-center max-w-[64px]", i > stageIndex ? 'text-slate-400' : 'text-slate-700')}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Status banners — owner / reviewer / admin only.
            - "AI is analysing" only shows to admin / reviewers; the developer
              sees the project page after analysis has already completed.
            - "Under Regulator Review" shows to the developer while the
              project is being reviewed.
            - "Returned for changes" shows to the developer on a draft with
              a reviewer comment, with a one-click "Edit & resubmit".
            - Legacy 24h countdown is kept for back-compat `pending_live` rows. */}
        {isReviewer && (project.status === 'scoring' || project.status === 'scoring_retry') && (
          <StatusBanner
            variant="analyzing"
            label="AI is analysing this project"
            message={
              <>AI is reading the project documents and computing the readiness score. This usually takes under a minute. Refresh to check again.</>
            }
          />
        )}

        {isOwner && project.status === 'under_review' && (
          <StatusBanner
            variant="warning"
            label="Under Regulator Review"
            message={
              <>The platform team and regulators are reviewing your project. You'll get a notification once a decision is made.</>
            }
          />
        )}

        {isOwner && project.status === 'draft' && (project as any).rejection_reason && (
          <StatusBanner
            variant="danger"
            label="Returned for changes"
            message={
              <>
                <p className="whitespace-pre-wrap text-slate-700 font-medium">{(project as any).rejection_reason}</p>
                <p className="text-[11px] text-slate-500 mt-1 font-normal">
                  Your AI score is now visible. Address the feedback and resubmit.
                </p>
              </>
            }
            actions={
              <Link
                href={`/developer/submit?edit=${project.id}`}
                className="h-9 px-4 rounded-none bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors"
              >
                <Icons.refreshCw className="size-3.5" /> Edit &amp; resubmit
              </Link>
            }
          />
        )}

        {/* Legacy pending_live rows: quiet inline notice (full countdown banner removed —
            the "Matched Partners" card below already communicates the reveal timing). */}
        {isOwner && scoresStillPending && countdownLabel && project.status === 'pending_live' && (
          <StatusBanner
            variant="warning"
            label="Reveal window active"
            message={<>Your project becomes visible to investors in {countdownLabel}.</>}
          />
        )}

        {/* Review History — visible to the owner and to reviewers. Always
            rendered so reviewers can see prior decisions on the same project. */}
        {(isOwner || isReviewer) && <ReviewHistory projectId={project.id} embedded />}

        {/* Action Bar — owner + admin only. Partner CTAs (Express Interest)
            live in the right sidebar, so they don't repeat here. */}
        {(canEdit || canDelete || canDeactivate || canReactivate || (isPlatformAdmin && project.scores)) && (
          <div className="flex flex-wrap items-center gap-2 px-8 py-4 border-t border-slate-100">

            {/* Bookmark button — owner + admin */}
            {(isOwner || isPlatformAdmin) && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 border-slate-200 bg-slate-50"
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
            )}

            {canEdit && (
              <Link href={`/developer/submit?edit=${project.id}`}>
                <Button variant="outline" className="h-9 px-5 border-slate-200 bg-slate-50 font-bold text-xs">
                  <Icons.pencil className="size-3.5 mr-1.5" /> Edit Project
                </Button>
              </Link>
            )}

            {/* Soft-lock notice — NDA signed but edits still allowed with warning */}
            {(isCreator || isPlatformAdmin) && hasSoftLock && !hasHardLock && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5">
                Active NDA — narrative &amp; financial edits only
              </span>
            )}

            {/* Hard-lock notice — Term Sheet or beyond */}
            {(isCreator || isPlatformAdmin) && hasHardLock && (
              <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-3 py-1.5">
                Locked — project is in active deal negotiations
              </span>
            )}

            {isPlatformAdmin && project.scores && (
              <Button
                variant="outline"
                className="h-9 px-5 border-slate-200 font-bold text-xs"
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
                className="h-9 px-5 border-orange-200 text-orange-600 font-bold text-xs hover:bg-orange-50"
                onClick={() => setShowDeactivateDialog(true)}
              >
                <Icons.eyeOff className="size-3.5 mr-1.5" /> Deactivate
              </Button>
            )}

            {canReactivate && (
              <Button
                className="h-9 px-5 bg-emerald-600 text-white font-bold text-xs"
                onClick={handleReactivate}
              >
                <Icons.eye className="size-3.5 mr-1.5" /> Reactivate
              </Button>
            )}

            {canDelete && (
              <Button onClick={() => setShowDeleteDialog(true)} variant="ghost" className="h-9 px-4 text-red-500 hover:bg-red-50 font-bold text-xs ml-auto">
                <Icons.trash className="size-3.5 mr-1.5" /> Delete
              </Button>
            )}
          </div>
        )}

        
                {showSupportPrompt && (
                  <StatusBanner
                    variant="warning"
                    label="Score Below Threshold"
                    message={
                      <>Your project scored {readinessScore}%. Our consultants can help you improve documentation and readiness.</>
                    }
                    actions={
                      <Link
                        href={`/developer/consultation-request?project=${project.id}`}
                        className="h-9 px-4 rounded-none bg-amber-500 text-white text-[11px] font-bold hover:bg-amber-600 transition-colors inline-flex items-center gap-2"
                      >
                        <Icons.headphones className="size-3.5" /> Request Help
                      </Link>
                    }
                  />
                )}
      </SectionCard>

      {/* ── Main Grid ────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Technical Specs */}
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-6">
            <h3 className="dash-section-label mb-5 flex items-center gap-2">
              <div className="size-6 bg-green-100 rounded-none flex items-center justify-center"><Icons.zap className="size-3 text-green-800" /></div>
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
                  <p className="text-[10px] font-bold text-slate-400 tracking-widest mb-2">Regulatory Approvals</p>
                  <div className="flex flex-wrap gap-1.5">
                    {project.regulatory_approvals.map((a: string) => (
                      <span key={a} className="px-2 py-0.5 bg-green-50 text-green-800 text-[10px] font-bold rounded-none border border-green-200">{a}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Governance / Risk / Exit — shown for owner or validated */}
          {(isOwner || project.status === 'live') && (project.governance_terms || project.exit_terms || project.risk_disclosures) && (
            <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-6">
              <h3 className="dash-section-label mb-5 flex items-center gap-2">
                <div className="size-6 bg-green-100 rounded-none flex items-center justify-center"><Icons.shieldCheck className="size-3 text-green-800" /></div>
                Deal Terms
              </h3>
              <div className="grid md:grid-cols-3 gap-6">
                {project.governance_terms && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 tracking-widest mb-1.5">Governance</p>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">{project.governance_terms}</p>
                  </div>
                )}
                {project.exit_terms && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 tracking-widest mb-1.5">Exit Strategy</p>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">{project.exit_terms}</p>
                  </div>
                )}
                {project.risk_disclosures && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 tracking-widest mb-1.5">Risk Disclosures</p>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">{project.risk_disclosures}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Data Room / Documents */}
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-6">
              <h3 className="dash-section-label my-3 flex items-center gap-2">
                <div className="size-6 bg-green-100 rounded-none flex items-center justify-center"><Icons.fileText className="size-3 text-green-800" /></div>
                {isOwner ? 'Data Room' : isPartner && hasNda ? 'Due Diligence Room' : 'Secure Data Room'}
              </h3>
            <div className="flex items-center justify-between mb-5">
              {isCreator && (
                <FileUpload
                  onUpload={handleFileUploadViaComponent}
                  maxFiles={10}
                  multiple
                  existingCount={project.documents?.length ?? 0}
                  className="mb-2"
                  label="Drag documents here or click to browse"
                />
              )}
            </div>

            {(isOwner || hasNda) ? (
              project.documents && project.documents.length > 0 ? (
                <div className="space-y-2">
                  {project.documents.map((doc, i) => (
                    <DocumentRow
                      key={i}
                      name={doc.document_type}
                      date={formatUploadDate(doc.uploaded_at)}
                      canDelete={isCreator}
                      onDelete={() => handleDeleteDocument(doc.id, doc.storage_path || '')}
                      onView={doc.storage_path ? () => setViewerDoc({ storagePath: doc.storage_path!, label: doc.document_type, mimeType: doc.mime_type }) : undefined}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed border-slate-200 ">
                  <p className="text-xs font-bold text-slate-400 tracking-widest">No documents uploaded</p>
                </div>
              )
            ) : (
              <div className="p-8 text-center bg-slate-50 rounded-none border border-line">
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
                    <Link href={`/engagements/${partnerEngagement.id}`}>
                      <Button className="h-9 px-5 bg-slate-900 text-white text-xs font-bold">
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
                        className="h-9 px-5 bg-slate-900 text-white text-xs font-bold"
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

          {/* Project Status Card — canonical dark-header section card */}
          <SectionCard
            eyebrow="Project Status"
            title="Status"
          >
            <div className="space-y-3">
              <SidebarRow label="Stage" value={project.project_stage?.replace(/_/g, ' ')} />
              <SidebarRow label="Capital" value={`ZMW ${(project.capital_required / 1_000_000).toFixed(1)}M`} />
              <SidebarRow
                label="Matches"
                value={
                  <span className="text-lg font-black text-emerald-700">
                    {capitalMatches.length + technicalMatches.length}
                  </span>
                }
              />
              <SidebarRow label="Documents" value={`${project.documents?.length ?? 0} uploaded`} />
            </div>
            {isOwner && (
              <Link href={`/projects/${project.id}/analytics`} className="block mt-5">
                <Button className="w-full h-10 bg-[#0b3b24] text-white font-bold text-xs hover:bg-[#0d4a2e]">
                  <Icons.barChart className="size-3.5 mr-1.5" /> View Analytics
                </Button>
              </Link>
            )}
          </SectionCard>

          {/* Developer Info */}
          {project.developer && (
            <SectionCard
              eyebrow="Developer"
              title={
                <span className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                    {project.developer.logo_url ? (
                      <img src={project.developer.logo_url} alt="" className="h-5 w-5 object-contain" />
                    ) : (
                      <Icons.building className="size-3.5 text-emerald-700" />
                    )}
                  </div>
                  <span className="text-sm font-bold text-black truncate">{project.developer.name}</span>
                </span>
              }
            >
              <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                <Icons.mapPin className="size-3" /> {project.developer.country}
              </p>
            </SectionCard>
          )}

          {/* Incoming Requests Panel — owner only, hidden from reviewers/admins */}
          {isOwner && !isReviewer && projectEngagements.length > 0 && (
            <SectionCard
              eyebrow="Engagement"
              title={`Incoming Requests (${projectEngagements.length})`}
            >
              <div className="divide-y divide-slate-100 -mx-5">
                {projectEngagements.slice(0, 5).map((eng) => {
                  const reqType = (eng as any).request_type as string | undefined;
                  const typeLabel = reqType === 'quote' ? 'Quote Request'
                    : reqType === 'meeting' ? 'Meeting Request'
                    : 'Introduction';
                  const typeTone = reqType === 'quote'
                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                    : reqType === 'meeting'
                    ? 'bg-violet-50 text-violet-700 border-violet-100'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-100';
                  const statusTone = eng.status === 'INTRO_ACCEPTED' || eng.status === 'NDA_SIGNED'
                    ? 'text-emerald-700' : eng.status === 'DROPPED' ? 'text-red-500' : 'text-amber-700';
                  return (
                    <Link key={eng.id} href={`/engagements/${eng.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors group">
                      <div className="size-7 bg-slate-100 flex items-center justify-center shrink-0 text-[10px] font-black text-slate-600">
                        {((eng as any).counterparty_type as string || 'P').charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`px-1.5 py-0.5 text-[10px] font-bold border ${typeTone}`}>{typeLabel}</span>
                        </div>
                        <p className={`text-[10px] font-bold tracking-widest ${statusTone}`}>{getStateLabel(eng.status)}</p>
                      </div>
                      <Icons.chevronRight className="size-3.5 text-slate-300 group-hover:text-emerald-700 transition-colors shrink-0" />
                    </Link>
                  );
                })}
              </div>
              <Link href="/engagements/requests" className="block mt-4 pt-3 border-t border-slate-100 text-center">
                <span className="text-[10px] font-bold text-emerald-700 tracking-widest hover:underline">View All Incoming Requests →</span>
              </Link>
            </SectionCard>
          )}

          {/* Engagements — partner-facing CTA lives here, hidden from reviewers/admins */}
          {isPartner && (
            <SectionCard
              eyebrow="Engagement"
              title={partnerEngagement ? 'Your Engagement' : 'Get Engaged'}
            >
              {partnerEngagement ? (
                <Link href={`/engagements/${partnerEngagement.id}`} className="block">
                  <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 transition-all cursor-pointer">
                    <div className="size-7 bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700 shrink-0">ENG</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-slate-700">Your Engagement</p>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100 mt-1">
                        {getStateLabel(partnerEngagement.status)}
                      </span>
                    </div>
                    <Icons.arrowRight className="size-3.5 text-slate-400 shrink-0 mt-0.5" />
                  </div>
                </Link>
              ) : (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-500 text-center">No engagement yet — start one to access the data room.</p>
                  <Button
                    onClick={handleExpressInterest}
                    disabled={expressingInterest}
                    className="w-full h-10 bg-[#0b3b24] text-white font-bold text-xs hover:bg-[#0d4a2e]"
                  >
                    {expressingInterest ? <Icons.spinner className="size-3.5 animate-spin mr-1.5" /> : <Icons.send className="size-3.5 mr-1.5" />}
                    Express Interest
                  </Button>
                </div>
              )}
              <Link href="/engagements" className="block mt-3 pt-3 border-t border-slate-100 text-center">
                <span className="text-[10px] font-bold text-emerald-700 tracking-widest hover:underline">Open Engagement Center →</span>
              </Link>
            </SectionCard>
          )}

          {/* Owner — match count summary — only when project is live */}
          {isOwner && !isReviewer && isEffectivelyLive && (
            <SectionCard eyebrow="Match Engine" title="Project Reach">
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {capitalMatches.length + technicalMatches.length} active partner{capitalMatches.length + technicalMatches.length !== 1 ? 's' : ''} are currently matched to this project.
              </p>
              <Link href={`/projects/${project.id}/matches`} className="block mt-3">
                <Button variant="outline" className="w-full h-9 bg-slate-50 border-slate-200 text-xs font-bold">
                  View Matches
                </Button>
              </Link>
            </SectionCard>
          )}
        </div>
      </div>

      {/* ── AI Scoring (full width) ─────────────────────────────── */}
      <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="dash-section-label flex items-center gap-2">
            <div className="size-6 bg-green-100 rounded-none flex items-center justify-center"><Icons.zap className="size-3 text-green-800" /></div>
            AI Readiness Insights
          </h3>
          {isPlatformAdmin && project.scores && (
            <Button variant="outline" size="sm" className="h-8 px-3 rounded-none border-slate-200 text-[10px] font-bold" onClick={() => setShowOverride(!showOverride)}>
              {showOverride ? 'Close' : 'Override'}
            </Button>
          )}
        </div>

        {project.scores ? (
          <>
            {showOverride && isPlatformAdmin && (
              <div className="mb-6 p-4 bg-slate-50 rounded-none border border-line">
                <p className="text-[10px] font-bold text-slate-500 tracking-widest mb-3">Manual Score Adjustment</p>
                <div className="grid md:grid-cols-3 gap-4">
                  <OverrideSlider label="Regulatory" value={project.scores.regulatory_score || 0} max={40} onChange={(v) => handleManualOverride('regulatory', v)} />
                  <OverrideSlider label="Financial" value={project.scores.financial_score || 0} max={35} onChange={(v) => handleManualOverride('financial', v)} />
                  <OverrideSlider label="Developer" value={project.scores.developer_score || 0} max={25} onChange={(v) => handleManualOverride('developer', v)} />
                </div>
              </div>
            )}
            {(isOwner || isReviewer || isPlatformAdmin || hasNda) ? (
              <AiInsightsPanel
                project={project}
                scores={project.scores}
                onReanalyze={isReviewer ? runAIAnalysis : undefined}
                analyzing={analyzing}
              />
            ) : (
              <>
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <ScorePillar label="Regulatory" score={project.scores.regulatory_score || 0} max={40} color="text-blue-600" details={project.scores.breakdown?.regulatory?.details} />
                  <ScorePillar label="Financial" score={project.scores.financial_score || 0} max={35} color="text-emerald-600" details={project.scores.breakdown?.financial?.details} />
                  <ScorePillar label="Developer" score={project.scores.developer_score || 0} max={25} color="text-amber-600" details={project.scores.breakdown?.developer?.details} />
                </div>
                {project.scores.summary && (
                  <div className="p-4 bg-slate-50 rounded-none border border-line mb-6">
                    <p className="text-[10px] font-bold text-slate-400 tracking-widest mb-2 flex items-center gap-1.5">
                      <Icons.zap className="size-3 text-green-800" /> Executive Summary
                    </p>
                    <p className="text-xs text-slate-700 leading-relaxed font-medium italic">"{project.scores.summary}"</p>
                  </div>
                )}
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
                      <li key={item} className="text-[11px] font-semibold text-slate-700 flex items-start gap-2 bg-red-50/50 p-2.5 rounded-none border border-red-100/50">
                        <span className="size-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                        {item}
                      </li>
                    )}
                  />
                  <CollapsibleList
                    title="Recommendations"
                    titleIcon={<Icons.zap className="size-3" />}
                    titleColor="text-green-800"
                    items={project.scores.recommendations || []}
                    showAll={showAllRecs}
                    onToggle={() => setShowAllRecs(v => !v)}
                    previewCount={PREVIEW_COUNT}
                    renderItem={(item) => (
                      <li key={item} className="text-[11px] font-semibold text-slate-700 flex items-start gap-2 bg-green-50 p-2.5 rounded-none border border-green-200">
                        <span className="size-1.5 rounded-full bg-green-800 mt-1.5 shrink-0" />
                        {item}
                      </li>
                    )}
                  />
                </div>
              </>
            )}
          </>
        ) : (
          <div className="p-10 text-center bg-slate-50 rounded-none border border-dashed border-slate-200">
            <div className="size-12 bg-white flex items-center justify-center mx-auto mb-4 shadow-sm">
              {isReviewer ? <Icons.shieldCheck className="size-6 text-slate-300" /> : <Icons.clock className="size-6 text-slate-300" />}
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">{isReviewer ? 'Analysis Not Available Yet' : project.status === 'under_review' ? 'Review in Progress' : 'Feedback Pending'}</h4>
            <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto mb-2">
              {isReviewer ? 'The project is available for governance review. If scoring is still running, refresh the review queue shortly.' : project.status === 'under_review' ? 'Your project has been submitted. Readiness results and reviewer feedback will be visible after the authority review decision.' : 'Readiness results will appear here once the project has been reviewed or returned with feedback.'}
            </p>
            {isPlatformAdmin && (
              <Button onClick={runAIAnalysis} disabled={analyzing || !project.documents?.length} className="h-10 px-6 bg-green-800 text-white font-bold text-xs shadow-lg shadow-green-800/10 mt-3">
                {analyzing ? <Icons.spinner className="size-3.5 animate-spin mr-1.5" /> : <Icons.zap className="size-3.5 mr-1.5" />}
                Re-run Analysis
              </Button>
            )}
          </div>
        )}
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
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-6 flex items-start gap-4">
          <div className="size-10 rounded-none bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Icons.users className="size-5 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 mb-1">Matched Partners</p>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Investor and technical partner matches will appear here once your project is approved and live.
              {project.status === 'under_review' && (
                <span className="block mt-1 text-amber-700 font-bold">Currently under authority review.</span>
              )}
              {scoresStillPending && countdownLabel && project.status === 'pending_live' && (
                <span className="inline-flex items-center gap-1.5 text-amber-600 font-bold">
                  <Icons.clock className="size-3" />
                  Goes live in {countdownLabel}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* ── Document Viewer modal ─────────────────────────────── */}
      {viewerDoc && (
        <DocumentViewer
          projectId={project.id}
          storagePath={viewerDoc.storagePath}
          label={viewerDoc.label}
          mimeType={viewerDoc.mimeType}
          onClose={() => setViewerDoc(null)}
        />
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
      <p className="text-[10px] font-bold text-slate-400 tracking-widest mb-1">{label}</p>
      <p className="text-xs font-bold text-slate-900">{value}</p>
    </div>
  );
}

function ScorePillar({ label, score, max, color, details }: { label: string; score: number; max: number; color: string; details?: any }) {
  const pct = (score / max) * 100;
  return (
    <div className="p-4 rounded-none bg-white border border-line shadow-[0_1px_2px_rgba(22,36,28,0.05)] text-center">
      <p className="text-[10px] font-bold text-slate-400 tracking-widest mb-3">{label}</p>
      <div className="relative size-20 flex items-center justify-center mx-auto mb-3">
        <svg className="size-full -rotate-90">
          <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-100" />
          <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray={226} strokeDashoffset={226 - (226 * pct) / 100} strokeLinecap="round" className={cn("transition-all duration-700", color)} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black text-slate-900 leading-none">{score}</span>
          <span className="text-[10px] font-bold text-slate-400">/ {max}</span>
        </div>
      </div>
      {details && (
        <div className="space-y-1">
          {Object.entries(details).slice(0, 2).map(([key, val]: [string, any]) => (
            <div key={key} className="flex justify-between text-[10px] font-bold text-slate-400">
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
        <span className="text-[10px] font-bold text-slate-500 tracking-widest">{label}</span>
        <span className="text-[10px] font-bold text-green-800">{value}/{max}</span>
      </div>
      <input type="range" min="0" max={max} value={value} onChange={(e) => onChange(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-none appearance-none cursor-pointer accent-green-800" />
    </div>
  );
}

// ── Sidebar Row — small key/value pair used in the right sidebar cards ──
function SidebarRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-bold text-slate-400 tracking-widest">{label}</span>
      <span className="text-xs font-bold text-slate-900 truncate text-right">{value}</span>
    </div>
  );
}

function DocumentRow({ name, date, canDelete, onDelete, onView }: { name: string; date: string; canDelete?: boolean; onDelete?: () => void; onView?: () => void }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 hover:border-green-200 group transition-all">
      <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={onView}>
        <div className="h-9 w-9 rounded-none bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-green-800 transition-colors shrink-0">
          <Icons.fileText className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900 group-hover:text-green-800 transition-colors truncate">{name}</p>
          <p className="text-[10px] font-bold text-slate-400 tracking-widest">{date}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        {onView && (
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-green-50 hover:text-green-800 opacity-0 group-hover:opacity-100 transition-opacity" onClick={onView} title="View">
            <Icons.eye className="size-3.5" />
          </Button>
        )}
        {canDelete && (
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); onDelete?.(); }} title="Delete">
            <Icons.trash className="size-3.5" />
          </Button>
        )}
      </div>
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
      <h4 className={cn("text-[10px] font-black  tracking-widest flex items-center gap-1.5", titleColor)}>
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
        <button onClick={onToggle} className={cn("text-[10px] font-black  tracking-widest hover:underline", titleColor)}>
          {showAll ? 'Show Less' : `+${items.length - previewCount} more`}
        </button>
      )}
    </div>
  );
}

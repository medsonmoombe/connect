'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { projectService } from '@/services/projects';
import { Project, CapitalMatchResult, TechnicalMatchResult, ProjectStage } from '@/types';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { MatchingSection } from '@/components/MatchingSection';
import { storageService } from '@/lib/storage';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { engagementService } from '@/lib/engagement';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { getReviewRecommendation } from '@/lib/review-intelligence';
import { ReviewRecommendationCard } from '@/components/ReviewRecommendationCard';

const STAGES: { key: ProjectStage; label: string }[] = [
  { key: 'CONCEPT', label: 'Concept' },
  { key: 'FEASIBILITY', label: 'Feasibility' },
  { key: 'PERMITTING', label: 'Permitting' },
  { key: 'FINANCIAL_CLOSE', label: 'Fin. Close' },
  { key: 'CONSTRUCTION', label: 'Construction' },
  { key: 'OPERATIONS', label: 'Operations' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft:                   { label: 'Draft',                  color: 'text-slate-500',   bg: 'bg-slate-50',    border: 'border-slate-100' },
  pending_internal_review: { label: 'Pending Internal Review', color: 'text-purple-600',  bg: 'bg-purple-50',   border: 'border-purple-100' },
  returned:                { label: 'Returned for Rework',    color: 'text-orange-600',  bg: 'bg-orange-50',   border: 'border-orange-100' },
  submitted:               { label: 'Submitted',              color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-100' },
  under_review:            { label: 'Under Review',           color: 'text-blue-600',    bg: 'bg-blue-50',     border: 'border-blue-100' },
  validated:               { label: 'Validated',              color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-100' },
  rejected:                { label: 'Rejected',               color: 'text-red-600',     bg: 'bg-red-50',      border: 'border-red-100' },
  archived:                { label: 'Archived',               color: 'text-slate-400',   bg: 'bg-slate-50',    border: 'border-slate-100' },
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
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState(0);
  const [capitalMatches, setCapitalMatches] = useState<CapitalMatchResult[]>([]);
  const [technicalMatches, setTechnicalMatches] = useState<TechnicalMatchResult[]>([]);

  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [showAllFlags, setShowAllFlags] = useState(false);
  const [showAllRecs, setShowAllRecs] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const PREVIEW_COUNT = 3;

  // ── Permissions ────────────────────────────────────────────
  const isCreator = !!project && !!user && project.created_by === user.id;
  const isOwner = !!project && !!user && (
    project.developer_id === user.company_id || user.is_platform_admin
  );
  const isPlatformAdmin = !!user?.is_platform_admin;
  const isPartner = !isOwner && !!user?.company_id;
  const [hasNda, setHasNda] = useState(false);
  const [isInternalReviewer, setIsInternalReviewer] = useState(false);
  const [orgMode, setOrgMode] = useState<'direct' | 'internal_review'>('direct');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [processingReview, setProcessingReview] = useState(false);

  useEffect(() => {
    async function checkPartner() {
      if (isPartner && user?.company_id && project) {
        try {
          const engagements = await engagementService.getCompanyEngagements(user.company_id);
          const eng = engagements.find(e => e.project_id === project.id);
          if (eng) setHasNda(eng.status !== 'INTRO_SENT' && eng.status !== 'INTRO_ACCEPTED');
        } catch {}
      }
    }
    checkPartner();
  }, [isPartner, user, project]);

  // Check if current user is the designated internal reviewer
  useEffect(() => {
    async function checkInternalReviewer() {
      if (!user?.company_id || !project) return;
      try {
        const { settings } = await apiClient.get<{ settings: { project_submission_mode?: string; internal_reviewer_id?: string } }>('/org/settings');
        const mode = settings.project_submission_mode === 'internal_review' ? 'internal_review' : 'direct';
        setOrgMode(mode);
        if (mode === 'internal_review' && settings.internal_reviewer_id) {
          setIsInternalReviewer(settings.internal_reviewer_id === user.id);
        }
      } catch {}
    }
    checkInternalReviewer();
  }, [user, project]);

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
      const { file_url, storage_path } = await storageService.uploadProjectDocument(project.id, file, file.name);
      const newDoc = await projectService.addProjectDocument({ project_id: project.id, document_type: file.name, file_url, storage_path });
      setProject({ ...project, documents: [...(project.documents || []), newDoc] });
      toast.success('Document uploaded');
    } catch {
      toast.error('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string, storagePath: string) => {
    try {
      await projectService.deleteProjectDocument(docId, storagePath, project!.id);
      setProject({ ...project!, documents: project!.documents?.filter(d => d.id !== docId) });
      toast.success('Document removed');
    } catch {
      toast.error('Failed to delete document');
    }
  };

  const runAIAnalysis = async () => {
    if (!project?.documents?.length) { toast.error('Upload documents first'); return; }
    setAnalyzing(true);
    try {
      const responseData = await apiClient.post<{ success: boolean; data: any }>(`/projects/${project.id}/analyze`, {});
      if (!responseData.success || !responseData.data) throw new Error('AI scoring failed');

      const s = responseData.data;
      const regulatory = Math.round(s.breakdown?.regulatory?.score ?? 0);
      const financial = Math.round(s.breakdown?.financial?.score ?? 0);
      const developer = Math.round(s.breakdown?.developer?.score ?? 0);
      const totalScore = Math.round(s.total_score ?? (regulatory + financial + developer));

      const updatedScores = await projectService.saveProjectScores({
        project_id: project.id,
        capital_readiness_score: totalScore,
        regulatory_score: regulatory,
        financial_score: financial,
        developer_score: developer,
        breakdown: s.breakdown,
        risk_flags: (s.risk_signals || []).map((r: any) => `${r.level}: ${r.text}`),
        recommendations: s.recommendations || [],
        summary: s.summary || 'Analysis complete.'
      });

      setProject({ ...project, scores: updatedScores });
      toast.success('AI analysis complete');
    } catch (err: any) {
      toast.error(`AI analysis failed: ${err.message || 'Unknown error'}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    setLoading(true);
    try {
      await projectService.deleteProject(project.id);
      toast.success('Project deleted');
      router.push('/dashboard/developer');
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.message}`);
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!project) return;
    setSubmitting(true);
    try {
      const result = await projectService.submitProject(project.id);
      // Refetch full project to get accurate status
      const updated = await projectService.getProjectDetails(project.id);
      setProject(updated);
      if (result.status === 'pending_internal_review') {
        toast.success('Project sent to your internal reviewer for approval.');
      } else {
        toast.success('Project submitted to the platform for review.');
      }
    } catch (err: any) {
      toast.error(`Failed to submit: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInternalReview = async (action: 'approve' | 'reject') => {
    if (!project) return;
    if (action === 'reject' && !reviewComment.trim()) {
      toast.error('Please provide a reason for returning this project');
      return;
    }
    setProcessingReview(true);
    try {
      await projectService.internalReviewProject(project.id, action, reviewComment.trim() || undefined);
      // Refetch full project to get accurate status
      const updated = await projectService.getProjectDetails(project.id);
      setProject(updated);
      setReviewAction(null);
      setReviewComment('');
      if (action === 'approve') {
        toast.success('Project approved and submitted to the platform for final review.');
      } else {
        toast.success('Project returned to the developer with your feedback.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Review action failed');
    } finally {
      setProcessingReview(false);
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

  const handleReviewAction = async (action: 'under_review' | 'validated' | 'rejected' | 'archived') => {
    if (!project) return;
    const recommendation = getReviewRecommendation(project.scores);
    if ((action === 'validated' || action === 'rejected') && !project.scores) {
      toast.error('Run AI analysis before completing project review.');
      return;
    }
    if (action === 'validated' && !recommendation.canValidate) {
      toast.error(recommendation.message);
      return;
    }
    const endpoint = action === 'archived' ? 'archive' : action === 'under_review' ? 'review' : action === 'validated' ? 'validate' : 'reject';
    try {
      await apiClient.post(`/projects/${project.id}/${endpoint}`, {});
      // Refetch full project to get accurate status
      const updated = await projectService.getProjectDetails(project.id);
      setProject(updated);
      const messages: Record<string, string> = {
        validated: 'Project validated — developer has been notified.',
        rejected: 'Project rejected — developer has been notified.',
        archived: 'Project archived.',
        under_review: 'Review started.',
      };
      toast.success(messages[action]);
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
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
  const st = STATUS_CONFIG[project.status || 'draft'] || STATUS_CONFIG.draft;
  const readinessScore = project.scores?.capital_readiness_score || 0;
  const canEdit = isCreator && (project.status === 'draft' || project.status === 'rejected' || project.status === 'returned');
  // Direct mode: show submit only when draft
  const showSubmitBtn = isCreator && !isInternalReviewer && project.status === 'draft' && orgMode === 'direct';
  // Internal review mode: show submit when draft (new) or returned (after rework)
  const showSendToReviewerBtn = isCreator && !isInternalReviewer && (project.status === 'draft' || project.status === 'returned') && orgMode === 'internal_review';
  // Internal reviewer sees action buttons only when project is pending their review
  const showInternalReviewBtns = isInternalReviewer && project.status === 'pending_internal_review' && orgMode === 'internal_review';
  const showStartReview = isPlatformAdmin && project.status === 'submitted';
  const showValidateReject = isPlatformAdmin && project.status === 'under_review';
  const showArchive = isPlatformAdmin && project.status === 'validated';
  const canSeeMatching = project.status === 'validated' && (user?.is_org_admin || user?.is_platform_admin);
  const reviewRecommendation = getReviewRecommendation(project.scores);

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

            {/* Return / Rejection Reason — only show when actually returned or rejected, not after resubmit */}
            {project.rejection_reason && (project.status === 'rejected' || project.status === 'returned') && (
              <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100">
                <div className="flex items-start gap-2.5">
                  <Icons.close className="size-4 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-1">
                      {project.status === 'rejected' ? 'Rejection Reason' : 'Returned for Rework'}
                    </p>
                    <p className="text-sm text-red-700 font-medium leading-relaxed">{project.rejection_reason}</p>
                  </div>
                </div>
              </div>
            )}

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
            {/* Submit checklist — owner + draft/returned only */}
            {isOwner && (project.status === 'draft' || project.status === 'returned') && (
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

        {/* Action Bar */}
        {(showSubmitBtn || showSendToReviewerBtn || showInternalReviewBtns || showStartReview || showValidateReject || showArchive || canEdit) && (
          <div className="flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-slate-100">

            {/* Pending internal review info banner (developer view) */}
            {isCreator && project.status === 'pending_internal_review' && (
              <div className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl bg-purple-50 border border-purple-100">
                <Icons.eye className="size-4 text-purple-500 shrink-0" />
                <p className="text-xs font-semibold text-purple-700">Your project is awaiting review by your designated internal reviewer. You'll be notified once it's been reviewed.</p>
              </div>
            )}

            {/* Creator: Submit (direct mode) */}
            {showSubmitBtn && (
              <Button
                onClick={handleSubmitReview}
                disabled={submitting || (project.documents?.length ?? 0) === 0}
                className="h-9 px-5 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                {submitting ? <Icons.spinner className="size-3.5 animate-spin mr-1.5" /> : <Icons.send className="size-3.5 mr-1.5" />}
                Submit for Review
              </Button>
            )}

            {/* Creator: Send to internal reviewer (internal_review mode — draft or returned) */}
            {showSendToReviewerBtn && (
              <Button
                onClick={handleSubmitReview}
                disabled={submitting || (project.documents?.length ?? 0) === 0}
                className="h-9 px-5 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                {submitting ? <Icons.spinner className="size-3.5 animate-spin mr-1.5" /> : <Icons.send className="size-3.5 mr-1.5" />}
                {project.status === 'returned' ? 'Resubmit for Review' : 'Send to Internal Reviewer'}
              </Button>
            )}

            {/* Internal Reviewer: Approve / Return */}
            {showInternalReviewBtns && !reviewAction && (
              <>
                <Button onClick={() => setReviewAction('approve')} className="h-9 px-5 rounded-xl bg-emerald-600 text-white font-bold text-xs">
                  <Icons.check className="size-3.5 mr-1.5" /> Approve & Submit
                </Button>
                <Button onClick={() => setReviewAction('reject')} variant="outline" className="h-9 px-5 rounded-xl border-red-200 text-red-600 font-bold text-xs hover:bg-red-50">
                  <Icons.close className="size-3.5 mr-1.5" /> Return with Comments
                </Button>
              </>
            )}

            {/* Internal Reviewer: Comment box */}
            {showInternalReviewBtns && reviewAction && (
              <div className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {reviewAction === 'approve' ? 'Approve & Submit to Platform' : 'Return with Comments'}
                </p>
                {reviewAction === 'reject' && (
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Explain what needs to be changed..."
                    className="w-full h-24 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  />
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleInternalReview(reviewAction)}
                    disabled={processingReview || (reviewAction === 'reject' && !reviewComment.trim())}
                    className={cn(
                      "h-8 px-4 rounded-lg font-bold text-xs",
                      reviewAction === 'approve' ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                    )}
                  >
                    {processingReview ? <Icons.spinner className="size-3 animate-spin mr-1.5" /> : null}
                    {reviewAction === 'approve' ? 'Confirm Approval' : 'Return Project'}
                  </Button>
                  <Button onClick={() => { setReviewAction(null); setReviewComment(''); }} variant="ghost" className="h-8 px-4 rounded-lg text-xs font-bold text-slate-500">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Platform Admin: Start Review (submitted → under_review) */}
            {showStartReview && (
              <Button onClick={() => handleReviewAction('under_review')} className="h-9 px-5 rounded-xl bg-blue-600 text-white font-bold text-xs">
                <Icons.eye className="size-3.5 mr-1.5" /> Start Review
              </Button>
            )}

            {/* Platform Admin: Validate / Reject (under_review → validated or rejected) */}
            {showValidateReject && (
              <>
                <Button
                  onClick={() => handleReviewAction('validated')}
                  disabled={!reviewRecommendation.canValidate}
                  title={!reviewRecommendation.canValidate ? 'Run AI analysis first or review low AI score' : undefined}
                  className="h-9 px-5 rounded-xl bg-emerald-600 text-white font-bold text-xs"
                >
                  <Icons.check className="size-3.5 mr-1.5" /> {reviewRecommendation.canValidate ? 'Validate' : 'Run Analysis First'}
                </Button>
                <Button
                  onClick={() => handleReviewAction('rejected')}
                  disabled={!project.scores}
                  title={!project.scores ? 'Run AI analysis first' : undefined}
                  variant="outline"
                  className="h-9 px-5 rounded-xl border-red-200 text-red-600 font-bold text-xs hover:bg-red-50"
                >
                  <Icons.close className="size-3.5 mr-1.5" /> Reject
                </Button>
              </>
            )}

            {/* Platform Admin: Archive (validated → archived) */}
            {showArchive && (
              <Button onClick={() => handleReviewAction('archived')} variant="outline" className="h-9 px-5 rounded-xl border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50">
                <Icons.folder className="size-3.5 mr-1.5" /> Archive
              </Button>
            )}

            {/* Creator: Edit (only draft or rejected) */}
            {canEdit && (
              <Link href={`/dashboard/developer/submit?edit=${project.id}`}>
                <Button variant="outline" className="h-9 px-5 rounded-xl border-slate-200 font-bold text-xs">
                  <Icons.pencil className="size-3.5 mr-1.5" /> Edit Project
                </Button>
              </Link>
            )}

            {(isCreator || isPlatformAdmin) && (
              <Button onClick={handleDeleteProject} variant="ghost" className="h-9 px-4 rounded-xl text-red-500 hover:bg-red-50 font-bold text-xs ml-auto">
                <Icons.trash className="size-3.5 mr-1.5" /> Delete
              </Button>
            )}
            {isPlatformAdmin && project.status === 'validated' && (
              <Button variant="ghost" className="h-9 px-4 rounded-xl text-slate-400 hover:bg-slate-50 font-bold text-xs ml-auto" onClick={() => handleReviewAction('archived')}>
                Archive
              </Button>
            )}
          </div>
        )}
      </div>

      {showValidateReject && (
        <ReviewRecommendationCard recommendation={reviewRecommendation} />
      )}

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
          {(isOwner || project.status === 'validated') && (project.governance_terms || project.exit_terms || project.risk_disclosures) && (
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
                  AI readiness scoring runs automatically when the project is submitted for review.
                </p>
                {project.status === 'draft' && (
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Submit your project to trigger analysis</p>
                )}
                {isPlatformAdmin && project.status !== 'draft' && (
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
              {isOwner && (
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
                    <DocumentRow key={i} name={doc.document_type} date={new Date(doc.uploaded_at).toLocaleDateString()} canDelete={isOwner} onDelete={() => handleDeleteDocument(doc.id, doc.storage_path || '')} fileUrl={doc.file_url} />
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
                <h4 className="text-xs font-bold text-slate-700 mb-1">Locked</h4>
                <p className="text-[11px] text-slate-500 font-medium max-w-xs mx-auto">Document access requires a signed NDA.</p>
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
                <span className={cn("text-xs font-bold capitalize px-2 py-0.5 rounded-full", st.bg, st.color)}>{st.label}</span>
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
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="size-7 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-400">YOU</div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-700">Your Engagement</p>
                    <p className="text-[10px] text-slate-400 font-medium">Awaiting developer response</p>
                  </div>
                </div>
              ) : isOwner ? (
                <p className="text-[11px] font-bold text-slate-400 text-center">{capitalMatches.length + technicalMatches.length} partner{capitalMatches.length + technicalMatches.length !== 1 ? 's' : ''} matched</p>
              ) : (
                <p className="text-[11px] font-bold text-slate-400 text-center">No engagements</p>
              )}
            </div>
            <Link href="/dashboard/developer?tab=engagements">
              <div className="p-3 border-t border-slate-50 text-center">
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">Open Engagement Center</span>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Matching Section (validated projects, org admins only) ───── */}
      {canSeeMatching && (
        <MatchingSection
          projectId={project.id}
          projectTechnology={project.technology_type}
          capitalMatches={capitalMatches}
          technicalMatches={technicalMatches}
          isOrgAdmin={!!(user?.is_org_admin || user?.is_platform_admin)}
        />
      )}
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

function DocumentRow({ name, date, canDelete, onDelete, fileUrl }: { name: string; date: string; canDelete?: boolean; onDelete?: () => void; fileUrl?: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-primary/20 group transition-all" onClick={() => fileUrl && window.open(fileUrl, '_blank')}>
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

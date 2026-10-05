'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { projectService } from '@/services/projects';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { storageService } from '@/lib/storage';
import { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS, MAX_FILE_SIZE } from '@/lib/upload-constants';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  TECHNOLOGY_TYPES,
  CAPITAL_STRUCTURE_TYPES,
  LAND_TITLE_STATUSES,
  TERRAIN_COMPLEXITY,
  GRID_STATUS,
  BUDGET_PREFERENCE,
  PPA_STATUS,
  PROJECT_DOCUMENT_TYPES,
  REGULATORY_APPROVALS,
  APPROVAL_PROOF_TYPES,
  LAND_TITLE_PROOF_TYPE,
  FINANCIAL_CLOSE_PROOF_TYPE,
  PROOF_DOCUMENT_TYPES,
} from '@/lib/project-validation';
import { stageLabel } from '@/lib/project-stages';
import { isFieldLockedWhileLive, MATERIAL_TECH_FIELDS } from '@/lib/project-edit-policy';
import { YesNoField } from '@/components/ui/YesNoField';
import { InfoHint } from '@/components/ui/InfoHint';
import { AiWorkingOverlay } from '@/components/developer/AiWorkingOverlay';
import { engagementService } from '@/lib/engagement';
import { apiClient } from '@/lib/api-client';
import { COUNTRY_REGIONS, findCountry } from '@/lib/countries';
import { SearchableCountrySelect } from '@/components/ui/SearchableCountrySelect';
import type { GapItem, PartnerRecommendation } from '@/lib/gap-analysis';
import type { PartnerCandidate } from '@/lib/partner-candidates';
import type { ProjectStage, CapitalStructureType, CounterpartyType } from '@/types';

/**
 * How long the submit overlay waits for a real completion signal before letting
 * the developer continue. Generous — a full document set takes tens of seconds —
 * but bounded, because the modal is intentionally unclosable.
 */
const ANALYSIS_POLL_TIMEOUT_MS = 4 * 60_000;

/** How often the overlay asks the server whether the run finished. */
const ANALYSIS_POLL_INTERVAL_MS = 2000;

type Step = 1 | 2 | 3 | 4 | 5;

const STEP_META: Record<Step, { label: string; subtitle: string; icon: any }> = {
  1: { label: 'Project Identity', subtitle: 'Provide basic details about the infrastructure opportunity.', icon: Icons.building },
  2: { label: 'Scale & Financials', subtitle: 'Define the capacity and capital structure of the project.', icon: Icons.dollarSign },
  3: { label: 'Timeline & Status', subtitle: 'Help partners understand the current stage and expected milestones.', icon: Icons.briefcase },
  4: { label: 'Technical Requirements', subtitle: 'Specify what technical services and conditions apply to this site.', icon: Icons.settings },
  5: { label: 'Narrative & Submission', subtitle: 'Add governance details, upload documents, and submit for review.', icon: Icons.send },
};

const COUNTRY_REGIONS_LOOKUP = COUNTRY_REGIONS as Record<string, string[]>;

const inputClass = "w-full h-10 px-4 rounded-none border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 font-medium text-sm";
const selectClass = "w-full h-10 px-4 pr-10 rounded-none border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 font-medium text-sm appearance-none";
const textareaClass = "w-full px-4 py-3 rounded-none border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 resize-none text-sm font-medium";

/** Brief hover descriptions for form fields with a ? info icon. */
const FIELD_HINTS: Record<string, string> = {
  name: 'A descriptive name for your energy project, e.g. "Lusaka South Solar II".',
  technology_type: 'The primary technology used to generate or store energy.',
  location_country: 'Country where the project is located. Matching only considers partners active in the same country.',
  location_region: 'Province or district where the project site is located.',
  project_size_mw: 'Total installed capacity in megawatts (MW).',
  capital_required: 'Total capital needed for the project, in Zambian Kwacha (ZMW).',
  capex: 'Estimated capital expenditure for building the project.',
  opex: 'Estimated annual operating and maintenance expenditure.',
  funding_required: 'Amount of external funding still not committed.',
  capital_structure_type: 'How you prefer to raise capital: equity, debt, profit sharing, leasing, or grant.',
  description: 'Describe the project in detail — objectives, technology, capacity and expected impact.',
  project_stage: 'The AI verifies your stage against your documents. Be honest — inflated stages reduce credibility.',
  target_financial_close_date: 'Expected date for financial close (financing fully committed).',
  target_cod: 'Target commercial operation date — when the project starts generating.',
  governance_terms: 'Governance requirements for investors (board seat, observer rights, etc.).',
  exit_terms: 'Investor exit mechanics (buyback provisions, transfer restrictions).',
  risk_disclosures: 'Known risks and mitigation strategies — transparency builds trust with partners.',
  terrain_complexity: 'Site difficulty. Affects EPC contractor matching.',
  grid_status: 'Current status of the grid connection.',
  budget_preference: 'How you prefer to structure payments for services.',
  ppa_status: 'Status of your Power Purchase Agreement. Critical for financier matching.',
  required_services: 'Services your project needs. These drive partner recommendations.',
  documents: 'Upload at least one document. Accepted: PDF, Word, Excel, PowerPoint, images. Max 20MB each.',
  land_title_status: 'Current legal status of the land or lease on which the project will be built.',
  regulatory_approvals: 'Regulatory permits you already hold — each requires a proof document.',
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Project Name',
  technology_type: 'Technology Type',
  location_country: 'Country',
  location_region: 'Region / City',
  project_size_mw: 'Project Size (MW)',
  capital_required: 'Capital Required (ZMW)',
  capex: 'CAPEX (ZMW)',
  opex: 'OPEX (ZMW / year)',
  funding_required: 'Funding Required (ZMW)',
  capital_structure_type: 'Capital Structure Type',
  description: 'Project Description',
  project_stage: 'Project Stage',
  target_financial_close_date: 'Target Financial Close',
  target_cod: 'Target Project Go-Live',
  governance_terms: 'Governance Terms',
  exit_terms: 'Exit Terms',
  risk_disclosures: 'Risk Disclosures',
  terrain_complexity: 'Terrain Complexity',
  grid_status: 'Grid Status',
  budget_preference: 'Budget Preference',
  ppa_status: 'PPA Status',
  required_services: 'Required Services',
  documents: 'Project Documents',
  land_title_status: 'Land Title Status',
  regulatory_approvals: 'Latest Regulatory Approvals',
};

function FieldLabel({ field, required, className }: { field: keyof typeof FIELD_HINTS | string; required?: boolean; className?: string }) {
  return (
    <div className="flex items-center gap-1.5 ml-1">
      <label className={cn('text-[11px] font-bold text-slate-400 uppercase tracking-widest', className)}>
        {FIELD_LABELS[field] ?? field}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {FIELD_HINTS[field] && <InfoHint text={FIELD_HINTS[field]} />}
    </div>
  );
}

/** Readiness preview response shape. */
interface ReadinessPreview {
  preliminary: boolean;
  form_hash: string;
  stage: { value: string; number: number; label: string; description: string; recommendedServices: string[]; recommendedPartnerTypes: string[] };
  stage_rationale: string;
  recommended_services: string[];
  overall_readiness: number;
  summary: string;
  gaps: GapItem[];
  recommendedProfiles: { gapId: string; label: string; severity: string; recommendation: PartnerRecommendation; candidates: PartnerCandidate[] }[];
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-red-50 border-red-200 text-red-700',
  high: 'bg-amber-50 border-amber-200 text-amber-700',
  medium: 'bg-blue-50 border-blue-200 text-blue-700',
  low: 'bg-slate-50 border-slate-200 text-slate-600',
};

/** Derive a human-readable file name from a document row. */
function docFileName(doc: any): string {
  if (doc?.file_name) return doc.file_name;
  const path = doc?.storage_path ?? doc?.file_url ?? '';
  return path.split('/').pop()?.replace(/^\d+_/, '') || 'Attached document';
}

interface SelectedFile {
  file: File;
  type: string;
}

/** Defaults for the tech-requirements sub-form (also used for edit snapshots). */
const TECH_REQUIREMENTS_DEFAULTS = {
  required_services: [] as string[],
  terrain_complexity: 'SIMPLE',
  grid_status: 'PENDING',
  budget_preference: 'FIXED',
  ppa_status: 'NOT_APPLICABLE',
};

/** Normalize a value for snapshot comparison (numbers, booleans, sorted arrays). */
function normalizeForCompare(v: unknown): unknown {
  if (Array.isArray(v)) return JSON.stringify([...v].map(String).sort());
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v;
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return Number.isNaN(n) ? v : n;
}

/**
 * Fields that actually feed the AI stage/readiness determination. Everything
 * here is also a locked material field, but not vice versa (e.g. `name` is
 * locked yet purely cosmetic for the AI).
 */
const STAGE_DETERMINING_FIELDS = [
  'technology_type',
  'location_country',
  'location_region',
  'project_size_mw',
  'capital_required',
  'capital_structure_type',
  'capex',
  'opex',
  'funding_required',
  'has_secured_land',
  'land_title_status',
  'has_reached_financial_close',
  'regulatory_approvals',
] as const;

/**
 * Snapshot of the stage-determining inputs: the material fields that feed the
 * AI, the tech-requirements fields, and whether any document was added or
 * replaced. Narrative fields (description, terms, target dates — Tier A)
 * deliberately do NOT influence the AI stage, so editing them never
 * re-triggers the AI.
 */
function collectStageSnapshot(
  form: Record<string, unknown>,
  tech: Record<string, unknown>,
  docActivityCount: number,
): string {
  const fields: Record<string, unknown> = {};
  for (const k of STAGE_DETERMINING_FIELDS) fields[k] = normalizeForCompare(form[k]);
  const techFields: Record<string, unknown> = {};
  for (const k of MATERIAL_TECH_FIELDS) techFields[k] = normalizeForCompare(tech[k]);
  return JSON.stringify({ fields, tech: techFields, docs: docActivityCount });
}

function StepSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Proof upload slot ──────────────────────────────────────────────────────
 * A small required-upload control rendered next to a Yes/No question (or each
 * ticked regulatory approval). Stores the file client-side keyed by proof type;
 * files are uploaded to the project-documents bucket at submission.
 */
function ProofUploadSlot({
  label,
  file,
  existingName,
  error,
  onSelect,
  onRemove,
}: {
  label: string;
  file?: SelectedFile | null;
  existingName?: string | null;
  error?: string;
  onSelect: (file: File) => void;
  onRemove?: () => void;
}) {
  const attached = !!file || !!existingName;
  return (
    <div className="border border-amber-200 bg-amber-50/40 p-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn(
            "size-8 flex items-center justify-center shrink-0",
            attached ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600",
          )}>
            {attached ? <Icons.check className="size-4" /> : <Icons.alertTriangle className="size-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-700 leading-none mb-1">{label}</p>
            <p className="text-[10px] text-slate-400 font-medium truncate max-w-[160px]">
              {file ? file.file.name : existingName ? existingName : 'Required — attach proof'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {existingName && !file && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="h-8 px-2.5 border border-slate-200 bg-white text-slate-500 hover:text-red-600 hover:border-red-200 text-[10px] font-bold flex items-center gap-1 transition-colors"
            >
              <Icons.trash className="size-3.5" />
              Remove
            </button>
          )}
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              accept={ALLOWED_EXTENSIONS}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onSelect(f);
                e.target.value = '';
              }}
            />
            <div className={cn(
              "h-8 px-3 border flex items-center gap-1.5 text-[10px] font-bold transition-colors",
              attached
                ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                : "border-amber-300 bg-white text-amber-700 hover:bg-amber-50",
            )}>
              {attached ? <Icons.refreshCw className="size-3.5" /> : <Icons.upload className="size-3.5" />}
              {attached ? 'Replace' : 'Upload'}
            </div>
          </label>
        </div>
      </div>
      {error && <p className="text-[10px] text-red-500 font-medium mt-1.5">{error}</p>}
    </div>
  );
}

export default function ProjectSubmissionPage() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [projectId, setProjectId] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const editProjectId = searchParams.get('edit');
  const isEditing = !!editProjectId;
  const [isResubmission, setIsResubmission] = useState(false);
  const { user: realUser } = useAuth();

  // Gate: only org admins (OWNER/ADMIN) of a developer org can create projects
  const canCreate = !!realUser && (realUser.is_platform_admin || (
    realUser.role === 'DEVELOPER' && (realUser.org_member_role === 'OWNER' || realUser.org_member_role === 'ADMIN')
  ));

  // Tracks the inline upload status hint shown in the submit CTA.
  const [analysisPhase, setAnalysisPhase] = useState<'uploading' | 'scoring' | null>(null);
  const [stageMsgIdx, setStageMsgIdx] = useState(0);

  // The submit-time AI analysis overlay. Driven by polling the real job status
  // (GET /api/projects/[id]/analyze), NOT by a fixed timer — the previous flow
  // fired /analyze without awaiting it and navigated away immediately, so the
  // developer watched a progress bar for stage determination and then nothing at
  // all while the actual scoring ran in the background.
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisElapsed, setAnalysisElapsed] = useState(0);

  // Status of the project being edited — drives the material-field lock while
  // the project is live / under_review (see project-edit-policy.ts).
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [unlockConfirm, setUnlockConfirm] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // Engagement-based field lock — fetched when editing an existing project
  const [engagementLock, setEngagementLock] = useState<'none' | 'soft' | 'hard'>('none');

  useEffect(() => {
    if (!editProjectId) return;
    fetch(`/api/engagements?project_id=${editProjectId}`)
      .then(r => r.json())
      .then(json => {
        const statuses: string[] = (json.data ?? []).map((e: any) => e.status);
        const HARD = ['TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED'];
        const SOFT = ['NDA_SIGNED', 'DUE_DILIGENCE'];
        if (statuses.some(s => HARD.includes(s))) setEngagementLock('hard');
        else if (statuses.some(s => SOFT.includes(s))) setEngagementLock('soft');
      })
      .catch(() => {});
  }, [editProjectId]);

  // Fields locked at soft-lock (NDA+): capacity, capital, structure, technology, location
  const engagementSoftLock = engagementLock === 'soft' || engagementLock === 'hard';
  // Full lock at hard-lock (Term Sheet+): everything
  const fullLocked = engagementLock === 'hard';

  // Material-field lock — live/under_review projects only allow safe narrative
  // edits. The developer can unlock via the explicit pause→resume flow below.
  const materialLocked = isEditing && !isResubmission && isFieldLockedWhileLive(editStatus);
  const coreLocked = engagementSoftLock || materialLocked;

  const STAGE_STEPS = [
    'Reading your project information...',
    'Checking land & approvals status...',
    'Evaluating project maturity...',
    'Determining your development stage...',
    'Recommending next-step services...',
  ];

  /**
   * The submit-time analysis overlay's step list. Deliberately coarse: the server
   * reports whether a run is queued/running/done but not per-document progress,
   * and a rotating caption must never imply a completion percentage it cannot
   * know. The header shows the real elapsed time instead.
   */
  const ANALYSIS_STEPS = [
    'Queueing your analysis...',
    'Reading every uploaded document...',
    'Verifying documents belong to this project...',
    'Scoring your readiness against the evidence...',
    'Writing your analysis brief...',
    'Finishing up...',
  ];

  // Edit mode: fetch existing project and pre-fill form
  useEffect(() => {
    if (!editProjectId) { setPageLoading(false); return; }
    projectService.getProjectDetails(editProjectId).then((p: any) => {
      setProjectId(p.id);
      setIsResubmission(!!p.rejection_reason);
      setEditStatus(p.status ?? null);
      setExistingDocs(p.documents ?? []);
      setExistingProofs(
        (p.documents ?? []).reduce((acc: Record<string, any>, d: any) => {
          if (PROOF_DOCUMENT_TYPES.includes(d.document_type)) acc[d.document_type] = d;
          return acc;
        }, {})
      );
      const loadedForm = {
        name: p.name || '',
        technology_type: p.technology_type || 'PHOTOVOLTAIC',
        location_country: p.location_country || '',
        location_region: p.location_region || '',
        project_size_mw: p.project_size_mw || 0,
        capital_required: p.capital_required || 0,
        capital_structure_type: p.capital_structure_type || 'EQUITY',
        capex: p.capex || 0,
        opex: p.opex || 0,
        funding_required: p.funding_required || 0,
        description: p.description || '',
        project_stage: p.project_stage || 'CONCEPT',
        target_financial_close_date: p.target_financial_close_date || '',
        target_cod: p.target_cod || '',
        governance_terms: p.governance_terms || '',
        exit_terms: p.exit_terms || '',
        risk_disclosures: p.risk_disclosures || '',
        has_secured_land: p.has_secured_land || false,
        land_title_status: p.land_title_status || 'Not Applicable',
        has_reached_financial_close: p.has_reached_financial_close || false,
        regulatory_approvals: p.regulatory_approvals || [],
      };
      setFormData(loadedForm);
      const tech = p.tech_requirements;
      const loadedTech = tech
        ? {
            required_services: tech.required_services || [],
            terrain_complexity: tech.terrain_complexity || 'SIMPLE',
            grid_status: tech.grid_status || 'PENDING',
            budget_preference: tech.budget_preference || 'FIXED',
            ppa_status: tech.ppa_status || 'NOT_APPLICABLE',
          }
        : { ...TECH_REQUIREMENTS_DEFAULTS };
      setTechRequirements(loadedTech);
      // Baseline snapshot of the stage-determining inputs at load time. If the
      // developer changes none of them this session, the AI stage step and the
      // background re-analysis are skipped (see canSkipStageAi below).
      stageBaselineRef.current = collectStageSnapshot(
        loadedForm as unknown as Record<string, unknown>,
        loadedTech as unknown as Record<string, unknown>,
        0,
      );
      setPageLoading(false);
      toast.success('Loaded existing project data');
    }).catch((err) => {
      console.error('Failed to load project:', err);
      toast.error('Failed to load project for editing');
      router.push('/developer');
    });
  }, [editProjectId]);

  // ── Unlock full editing (material fields) ────────────────────────────
  // Sanctioned path to edit material fields on a live/under_review project:
  // pause it via the state machine (live → paused), then resume (paused →
  // draft). The project leaves the marketplace and must be resubmitted.
  const handleUnlockEditing = async () => {
    if (!editProjectId) return;
    setUnlocking(true);
    try {
      const pauseRes = await fetch(`/api/projects/${editProjectId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pause_reason: 'Developer requested full editing — project will be resubmitted for review' }),
      });
      if (!pauseRes.ok) {
        const d = await pauseRes.json().catch(() => ({}));
        throw new Error(d.error || 'Could not pause the project');
      }
      const resumeRes = await fetch(`/api/projects/${editProjectId}/resume`, { method: 'POST' });
      if (!resumeRes.ok) {
        const d = await resumeRes.json().catch(() => ({}));
        throw new Error(d.error || 'Project was paused but could not be resumed to draft');
      }
      setEditStatus('draft');
      setUnlockConfirm(false);
      toast.success('Full editing unlocked — the project is now a draft and must be resubmitted for review.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to unlock editing');
    } finally {
      setUnlocking(false);
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    technology_type: 'PHOTOVOLTAIC',
    location_country: '',
    location_region: '',
    project_size_mw: 0,
    capital_required: 0,
    capital_structure_type: 'EQUITY' as CapitalStructureType,
    capex: 0,
    opex: 0,
    funding_required: 0,
    description: '',
    project_stage: 'CONCEPT' as ProjectStage,
    target_financial_close_date: '',
    target_cod: '',
    governance_terms: '',
    exit_terms: '',
    risk_disclosures: '',
    has_secured_land: false,
    land_title_status: 'Not Applicable' as 'Traditional' | 'Titled' | 'Not Applicable',
    has_reached_financial_close: false,
    regulatory_approvals: [] as string[],
  });

  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [proofFiles, setProofFiles] = useState<Record<string, SelectedFile>>({});
  const [existingProofs, setExistingProofs] = useState<Record<string, any>>({});
  const existingProofDocs = existingProofs;
  const [replacedDocIds, setReplacedDocIds] = useState<string[]>([]);
  const [existingDocs, setExistingDocs] = useState<any[]>([]);

  // AI-determined project stage — fired after step 2, displayed on the stage step.
  const [aiStage, setAiStage] = useState<{ number: number; label: string; rationale: string; services: string[] } | null>(null);
  const [stageCheck, setStageCheck] = useState<'idle' | 'running' | 'failed'>('idle');

  // Readiness preview — the professional "first analysis" (stage + gaps +
  // recommended profiles) shown on the stage step so the developer can contact
  // partners before finishing the submission.
  const [readiness, setReadiness] = useState<ReadinessPreview | null>(null);
  const [engagedMap, setEngagedMap] = useState<Record<string, { id: string; status: string }>>({});
  const [contactingKey, setContactingKey] = useState<string | null>(null);
  const previewCache = useRef<Record<string, ReadinessPreview>>({});

  // ── Stage-determining-change detection (edit mode) ───────────────────────
  // Snapshot of the AI-relevant inputs taken when the project is loaded for
  // editing. If nothing in it changed, the AI stage step and the background
  // re-analysis are skipped entirely — editing a description or target date
  // never re-bills the AI nor delists a live project.
  const stageBaselineRef = useRef<string | null>(null);
  const [docRemovalCount, setDocRemovalCount] = useState(0);

  /** Current snapshot including this session's document activity. */
  const currentStageSnapshot = () =>
    collectStageSnapshot(
      formData as unknown as Record<string, unknown>,
      techRequirements as unknown as Record<string, unknown>,
      selectedFiles.length + Object.keys(proofFiles).length + replacedDocIds.length + docRemovalCount,
    );

  /** True when a stage-determining input (material/tech/docs) changed this session. */
  const hasStageDeterminingChanges = () =>
    stageBaselineRef.current !== null && currentStageSnapshot() !== stageBaselineRef.current;

  /**
   * Run the project analysis to completion, holding the unclosable overlay open
   * while it runs, and resolve with the outcome.
   *
   * Polls GET /api/projects/[id]/analyze (which reports the real `ai_jobs` state)
   * rather than awaiting the POST or sleeping for a guessed duration: the POST
   * returns as soon as the job is enqueued, and the run itself takes tens of
   * seconds. Bails out after ANALYSIS_POLL_TIMEOUT_MS so a wedged worker can
   * never strand the developer on a modal they cannot dismiss.
   */
  const runAnalysisToCompletion = useCallback(async (projectId: string): Promise<'complete' | 'failed' | 'timeout'> => {
    setAnalysisRunning(true);
    setAnalysisStep(0);
    setAnalysisElapsed(0);

    const startedAt = Date.now();
    const elapsedTimer = setInterval(() => setAnalysisElapsed(Date.now() - startedAt), 1000);
    // Caption rotation only — the "n of 6" counter therefore reads as progress
    // through a checklist, never as a completion estimate.
    const stepTimer = setInterval(
      () => setAnalysisStep(i => Math.min(i + 1, ANALYSIS_STEPS.length - 1)),
      2600,
    );

    try {
      // Give the enqueue a moment to become visible to the status endpoint.
      await new Promise(r => setTimeout(r, 700));

      while (Date.now() - startedAt < ANALYSIS_POLL_TIMEOUT_MS) {
        try {
          const res = await fetch(`/api/projects/${projectId}/analyze`);
          const json = await res.json().catch(() => ({}));
          const state = json?.data?.state as string | undefined;

          if (state === 'complete') return 'complete';
          if (state === 'failed') return 'failed';
          // 'running' and 'idle' both mean "keep waiting" — 'idle' covers the
          // window before a worker has claimed the job.
        } catch {
          // A transient poll failure is not an analysis failure; keep waiting.
        }
        await new Promise(r => setTimeout(r, ANALYSIS_POLL_INTERVAL_MS));
      }
      return 'timeout';
    } finally {
      clearInterval(elapsedTimer);
      clearInterval(stepTimer);
      setAnalysisRunning(false);
    }
  }, [ANALYSIS_STEPS.length]);

  useEffect(() => {
    if (stageCheck !== 'running') return;
    setStageMsgIdx(0);
    const interval = setInterval(() => {
      setStageMsgIdx(i => (i + 1) % STAGE_STEPS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [stageCheck]);

  const [techRequirements, setTechRequirements] = useState({
    required_services: [] as string[],
    terrain_complexity: 'SIMPLE',
    grid_status: 'PENDING',
    budget_preference: 'FIXED',
    ppa_status: 'NOT_APPLICABLE',
  });

  const creatingRef = useRef(false);

  const updateFormData = (data: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...data }));
    setErrors(prev => {
      const next = { ...prev };
      Object.keys(data).forEach(k => delete next[k]);
      return next;
    });
  };

  const updateTechData = (data: Partial<typeof techRequirements>) => {
    setTechRequirements(prev => ({ ...prev, ...data }));
  };

  /* ── Proof documents ──────────────────────────────────────────────────────
   * Required when a question is answered Yes (or an approval is ticked).
   * Keyed by proof document type; uploaded to the project-documents bucket
   * together with the general documents at submission time.
   */
  const getRequiredProofs = (): string[] => {
    const required: string[] = [];
    if (formData.has_secured_land) required.push(LAND_TITLE_PROOF_TYPE);
    if (formData.has_reached_financial_close) required.push(FINANCIAL_CLOSE_PROOF_TYPE);
    formData.regulatory_approvals.forEach((approval) => {
      const key = APPROVAL_PROOF_TYPES[approval];
      if (key) required.push(key);
    });
    return required;
  };

  const missingProofs = (): string[] =>
    getRequiredProofs().filter((key) => !proofFiles[key] && !existingProofs[key]);

  const handleProofSelect = (proofKey: string, file: File) => {
    const error = validateFile(file);
    if (error) {
      setErrors(prev => ({ ...prev, [proofKey]: error }));
      toast.error(error);
      return;
    }
    setErrors(prev => {
      const next = { ...prev };
      delete next[proofKey];
      return next;
    });
    setProofFiles(prev => ({ ...prev, [proofKey]: { file, type: proofKey } }));
    const existingDoc = existingProofDocs[proofKey];
    if (existingDoc) {
      setReplacedDocIds(prev => prev.includes(existingDoc.id) ? prev : [...prev, existingDoc.id]);
    }
    toast.success('Proof attached');
  };

  const flagMissingProofErrors = () => {
    const missing = missingProofs();
    if (missing.length === 0) return false;
    setErrors(prev => {
      const next = { ...prev };
      missing.forEach(key => { if (!next[key]) next[key] = 'Proof document required when you answer Yes.'; });
      return next;
    });
    toast.error('Please attach proof documents for the questions you answered Yes to.');
    return true;
  };

  /** Fetch existing engagements for the project to disable duplicate contacts. */
  const loadEngagements = useCallback(async (projectIdToLoad: string) => {
    try {
      const engagements = await engagementService.getProjectEngagements(projectIdToLoad);
      const map: Record<string, { id: string; status: string }> = {};
      for (const e of (engagements ?? [])) {
        if (e.status !== 'DROPPED' && e.counterparty_id && !map[e.counterparty_id]) {
          map[e.counterparty_id] = { id: e.id, status: e.status };
        }
      }
      setEngagedMap(map);
    } catch (err) {
      console.error('Failed to load engagements:', err);
    }
  }, []);

  /**
   * Fire the mid-form readiness preview (after step 2). This is the professional
   * "first analysis": AI stage determination + gap analysis + recommended partner
   * profiles, shown on the stage step so the developer can contact partners
   * before finishing the submission. The AI stage result is cached by the form
   * hash so unchanged forms never re-bill the AI API.
   */
  const runReadinessPreview = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {
    try {
      let currentProjectId = projectId;
      if (!currentProjectId) {
        creatingRef.current = true;
        try {
          const project = await projectService.createProject({
            ...formData,
            developer_id: realUser!.company_id,
          });
          currentProjectId = project.id;
          setProjectId(project.id);
        } finally {
          creatingRef.current = false;
        }
      } else {
        await projectService.updateProject(currentProjectId, formData);
      }

      const res = await apiClient.post<{ success: boolean; data: ReadinessPreview; error?: string }>(
        `/projects/${currentProjectId}/readiness`, {}
      );
      if (!res.success || !res.data?.stage) {
        return { ok: false, message: res.error || 'Could not determine your project readiness automatically.' };
      }

      // Client-side cache keyed on the form hash — an unchanged form reuses the
      // preview without a second AI call.
      previewCache.current[res.data.form_hash] = res.data;

      const data = res.data;
      setReadiness(data);
      setAiStage({
        number: data.stage.number,
        label: data.stage.label,
        rationale: data.stage_rationale,
        services: data.recommended_services,
      });

      // Mark already-engaged partners so contact buttons become "View Engagement".
      await loadEngagements(currentProjectId);
      return { ok: true };
    } catch (err: any) {
      console.error('Readiness preview failed:', err);
      const msg = err instanceof Error ? err.message : 'Could not reach the AI readiness service.';
      return { ok: false, message: msg };
    }
  }, [projectId, formData, realUser, loadEngagements]);

  /**
   * Contact a recommended partner profile while the project is still being
   * built. Creates a real (draft-project) engagement so early outreach is a
   * first-class action. Duplicate requests are handled by the API (409) and
   * simply mark the partner as engaged.
   */
  const handleContact = useCallback(async (candidate: PartnerCandidate, gap: GapItem) => {
    if (!projectId) {
      toast.error('Save your project first before contacting a partner.');
      return;
    }
    const key = `${candidate.id}-${gap.id}`;
    setContactingKey(key);
    try {
      const data = await engagementService.requestIntroduction(
        projectId,
        candidate.id,
        candidate.type as CounterpartyType,
        {
          requestOrigin: 'developer',
          requestType: 'introduction',
          gapIds: [gap.id],
          requestedService: gap.recommendation.service,
          message: `Requesting an introduction to help close the "${gap.label}" gap on our project (currently at the ${readiness?.stage.label ?? 'preliminary'} stage).`,
        }
      );
      setEngagedMap(prev => ({ ...prev, [candidate.id]: { id: data.id, status: 'INTRO_SENT' } }));
      toast.success(`Introduction sent to ${candidate.companyName}.`);
    } catch (err: any) {
      const details = err?.details;
      if (err?.status === 409 && details?.code === 'DUPLICATE_ENGAGEMENT') {
        setEngagedMap(prev => ({ ...prev, [candidate.id]: { id: details.existing_id, status: details.existing_status } }));
        toast.info(`You already have an engagement with ${candidate.companyName} — it was already requested.`);
      } else {
        toast.error(err?.message || 'Failed to send the introduction.');
      }
    } finally {
      setContactingKey(null);
    }
  }, [projectId, readiness]);

  /** Remove a previously-uploaded document during edit mode. */
  const handleRemoveDocument = useCallback(async (doc: any) => {
    try {
      await projectService.deleteProjectDocument(doc.id, doc.storage_path, projectId ?? undefined);
      setExistingDocs(prev => prev.filter(d => d.id !== doc.id));
      setDocRemovalCount(c => c + 1); // removal = evidence change → snapshot differs
      setExistingProofs(prev => {
        const next = { ...prev };
        delete next[doc.document_type];
        return next;
      });
      toast.success('Document removed.');
    } catch {
      toast.error('Failed to remove the document.');
    }
  }, [projectId]);

  const validateStep = (stepNum: Step): boolean => {
    setErrors({});
    let result;
    switch (stepNum) {
      case 1: result = step1Schema.safeParse(formData); break;
      case 2: result = step2Schema.safeParse(formData); break;
      case 3: result = step3Schema.safeParse(formData); break;
      case 4: result = step4Schema.safeParse(techRequirements); break;
      case 5: result = step5Schema.safeParse(formData); break;
    }
    if (result && !result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        const key = err.path[0] as string;
        fieldErrors[key] = err.message;
      });
      setErrors(fieldErrors);
      toast.error('Please fix the highlighted fields.');
      return false;
    }
    return true;
  };

  const handleNext = async () => {
    if (stageCheck === 'running') return; // avoid double-firing while determining
    if (!validateStep(step)) return;
    // Step 1 contains the Yes/No readiness questions — require proofs before advancing.
    if (step === 1 && flagMissingProofErrors()) return;
    // After step 2, the AI determines the project stage from the info provided
    // so far; the result is shown on the next (stage) step before continuing.
    // In edit mode this is SKIPPED when no stage-determining input (material
    // fields, tech requirements, documents) changed — the stage cannot have
    // changed, so there is nothing to re-determine and no AI call to bill.
    if (step === 2) {
      if (isEditing && !hasStageDeterminingChanges()) {
        setStep(3);
        return;
      }
      setStageCheck('running');
      const result = await runReadinessPreview();
      setStageCheck(result.ok ? 'idle' : 'failed');
      if (!result.ok) toast.error(result.message || 'Could not determine your project readiness automatically — the stage will be set at submission.');
      setStep(3);
      return;
    }
    if (step < 5) {
      toast.success(`Step ${step} complete — moving to ${STEP_META[(step + 1) as Step].label}`);
      setStep((step + 1) as Step);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  const saveDraft = useCallback(async () => {
    if (!realUser?.company_id) return;
    // Guard against concurrent creates
    if (!projectId && creatingRef.current) return;
    try {
      if (projectId) {
        await projectService.updateProject(projectId, formData);
      } else {
        creatingRef.current = true;
        const project = await projectService.createProject({
          ...formData,
          developer_id: realUser.company_id,
        });
        setProjectId(project.id);
      }
    } catch (err) {
      console.error('Auto-save failed:', err);
    } finally {
      creatingRef.current = false;
    }
  }, [projectId, formData, realUser]);

  useEffect(() => {
    if (isEditing) return; // Don't auto-save during edit mode — user saves manually
    if (!projectId && (!formData.name || formData.name.length < 3 || !formData.location_country)) return;
    const timer = setTimeout(saveDraft, 3000);
    return () => clearTimeout(timer);
  }, [formData, projectId, saveDraft, isEditing]);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return `"${file.name}" is not a supported file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, PPT, PPTX, GIF, WEBP, CSV.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `"${file.name}" exceeds the 20MB size limit.`;
    }
    return null;
  };

  const handleFileSelect = (docType: string, file: File) => {
    const error = validateFile(file);
    if (error) {
      setErrors(prev => ({ ...prev, [docType]: error }));
      toast.error(error);
      return;
    }
    setErrors(prev => {
      const next = { ...prev };
      delete next[docType];
      return next;
    });
    setSelectedFiles(prev => [...prev.filter(f => f.type !== docType), { file, type: docType }]);
    const existingDoc = existingDocs.find(d => d.document_type === docType);
    if (existingDoc) {
      setReplacedDocIds(prev => prev.includes(existingDoc.id) ? prev : [...prev, existingDoc.id]);
    }
    toast.success(`${docType} attached`);
  };

  const handleSubmit = async () => {
    if (!validateStep(5)) return;
    if (flagMissingProofErrors()) return;
    if (selectedFiles.length === 0 && Object.keys(proofFiles).length === 0 && !isEditing) {
      toast.error('At least 1 document is required.');
      return;
    }

    // A brand-new project and a returned one both go through /submit. An ordinary
    // "Save Changes" on an existing draft does NOT — it only re-analyses when a
    // stage-determining input actually moved.
    const isFirstSubmission = !isEditing;
    const willSubmit = isFirstSubmission || isResubmission;

    setLoading(true);

    try {
      let currentProjectId = projectId;

      if (!currentProjectId) {
        const project = await projectService.createProject({
          ...formData,
          developer_id: realUser!.company_id,
        });
        currentProjectId = project.id;
        setProjectId(project.id);
      } else {
        await projectService.updateProject(currentProjectId, formData);
      }

      await projectService.updateTechRequirements({
        ...techRequirements,
        project_id: currentProjectId,
      } as any);

      // Upload documents — general docs + proof attachments (stored in the
      // project-documents bucket with their own document_type, one row each).
      // Only proofs that are still required are uploaded (a proof for a
      // question the user later answered "No" to is dropped).
      setAnalysisPhase('uploading');
      const allDocuments = [
        ...selectedFiles,
        ...Object.values(proofFiles).filter((p) => getRequiredProofs().includes(p.type)),
      ];
      for (const item of allDocuments) {
        try {
          const { file_url, storage_path, file_hash, mime_type } = await storageService.uploadProjectDocument(
            currentProjectId!,
            item.file,
            item.type,
            (progress) => setUploadProgress(prev => ({ ...prev, [item.file.name]: progress }))
          );
          await projectService.addProjectDocument({
            project_id: currentProjectId!,
            document_type: item.type,
            file_url,
            storage_path,
            file_hash,
            mime_type: mime_type ?? item.file.type,
          });
        } catch (err: any) {
          if (err?.status === 409) {
            toast.warning(`Skipped duplicate: ${item.file.name}`);
          } else {
            throw err;
          }
        }
      }

      // Clean up replaced docs
      if (isEditing) {
        for (const id of replacedDocIds) {
          try {
            const doc = existingDocs.find(d => d.id === id);
            if (doc) await projectService.deleteProjectDocument(doc.id, doc.storage_path, currentProjectId ?? undefined);
          } catch { /* best-effort cleanup */ }
        }
      }

      // ── Final submission: /submit is the ONLY door into the review pipeline ──
      // It moves draft → scoring (clearing any rejection reason and notifying the
      // reviewers); the AI analysis that follows completes scoring → under_review.
      // Nothing else in the app may create that state.
      //
      // This must run for a FIRST submission too, not just a resubmission.
      // Previously only `isResubmission` hit this branch, so a brand-new project
      // was analysed while still a `draft`: it never left draft, never entered
      // the review queue, and the reviewer had nothing to review — the exact
      // "stage was set but no analysis was done" symptom.
      if (willSubmit) {
        const submitRes = await fetch(`/api/projects/${currentProjectId}/submit`, { method: 'POST' });
        if (!submitRes.ok) {
          const d = await submitRes.json().catch(() => ({}));
          throw new Error(d.error || (isResubmission ? 'Resubmission failed' : 'Submission failed'));
        }
      }

      if (isResubmission || isFirstSubmission) {
        // Trigger the analysis, then HOLD the overlay until it actually finishes.
        // The POST returns as soon as the job is enqueued, so the run is polled
        // for a real completion signal — the developer must never be navigated to
        // a project page that says "wasn't analysed" while the AI is still working.
        const trigger = apiClient
          .post<{ success: boolean; data: any }>(`/projects/${currentProjectId}/analyze`, { preview_stage: readiness?.stage?.value })
          .catch((err) => {
            console.error('[Submit] analyze trigger failed:', err);
            return null;
          });

        await trigger;
        const outcome = await runAnalysisToCompletion(currentProjectId!);

        if (outcome === 'complete') {
          toast.success(isResubmission ? 'Project resubmitted successfully!' : 'Project submitted for review!');
        } else if (outcome === 'failed') {
          toast.error('The analysis did not complete. Your project is saved — you can re-run it from the project page.', { id: 'submit' });
        } else {
          toast.warning('The analysis is taking longer than expected. Your project is saved and is already queued.', { id: 'submit' });
        }
        router.refresh();
        router.push(`/projects/${currentProjectId}`);
        return;
      }

      // Re-analysis only when a stage-determining input changed (or a brand-new
      // project). A narrative-only edit keeps the existing AI scores and stage —
      // important for live projects: /analyze would delist them (live → scoring)
      // and hide the score until re-review.
      const needsReanalysis = !isEditing || hasStageDeterminingChanges();
      const analyzePromise = needsReanalysis
        ? apiClient
            .post<{ success: boolean; data: any }>(
              `/projects/${currentProjectId}/analyze`,
              { preview_stage: readiness?.stage?.value },
            )
            .catch((err) => { console.error('[Submit] background analyze failed:', err); })
        : null;

      if (isEditing) {
        if (analyzePromise) await analyzePromise;
        toast.success(needsReanalysis ? 'Project updated and re-analysed successfully!' : 'Project updated successfully!');
        router.refresh();
        router.push(`/projects/${currentProjectId}`);
        return;
      }

      // New project: navigate immediately, no overlay.
      router.push(`/projects/${currentProjectId}`);
    } catch (error: any) {
      const msg = error?.message || 'Failed to create project';
      setErrors({ _submit: msg });
      toast.error(msg);
    } finally {
      setLoading(false);
      setAnalysisPhase(null);
    }
  };

  const progress = ((step) / 5) * 100;
  const displayErrors = Object.entries(errors).filter(([k]) => !k.startsWith('_'));

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ── AI Stage Determination Overlay (fires after step 2) ── */}
      {stageCheck === 'running' && (
        <AiWorkingOverlay
          accent="purple"
          title="AI is determining your project stage"
          subtitle={"Based on the information you've provided so far"}
          steps={STAGE_STEPS}
          activeStep={stageMsgIdx}
          hint="Concept → Pre-Feasibility → Full Feasibility → Regulatory Approval → PPA Ready → Financial Close → Construction → Operation"
        />
      )}

      {/* ── Submit-time AI analysis overlay ──
          Unclosable by design: the whole point is that the developer cannot end up
          looking at the project page before the analysis exists. It is driven by
          the real job status (polled in runAnalysisToCompletion), and the elapsed
          timer is real elapsed time — not a fake progress bar. */}
      {analysisRunning && (
        <AiWorkingOverlay
          accent="green"
          title="AI is analysing your project"
          subtitle="We're reading every document you uploaded and scoring your project's readiness. This usually takes under a minute."
          steps={ANALYSIS_STEPS}
          activeStep={analysisStep}
          hint={`Your project is saved. Submitted ${Math.floor(analysisElapsed / 60)}m ${String(Math.floor((analysisElapsed % 60_000) / 1000)).padStart(2, '0')}s ago · you can leave this page open until it finishes`}
        />
      )}

      <div className="max-w-4xl mx-auto px-6  space-y-6 animate-in fade-in duration-500">

        {/* ── Back link ── */}
        <Link href="/developer" className="inline-flex items-center justify-center size-9 border border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors">
          <Icons.arrowLeft className="size-4" />
        </Link>

        {/* ── Access guard ── */}
        {!canCreate && (
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-8 text-center">
            <div className="size-12 bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
              <Icons.lock className="size-5 text-red-500" />
            </div>
            <p className="text-sm font-bold text-slate-900 mb-1">Access Restricted</p>
            <p className="text-xs text-slate-500">Only organisation owners and admins of a developer account can create projects.</p>
          </div>
        )}

        {canCreate && (<>

        {/* ── Unlock-confirmation modal (material-field editing) ── */}
        {unlockConfirm && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 shadow-2xl max-w-md w-full p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="size-10 bg-amber-100 flex items-center justify-center shrink-0">
                  <Icons.alertTriangle className="size-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Unlock full editing?</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    The project is live. To change core details (size, capital, technology, location, checklist claims), it must leave the marketplace:
                  </p>
                </div>
              </div>
              <ul className="space-y-1.5 mb-5">
                {[
                  'The project is paused and removed from the marketplace',
                  'It moves to Draft — resubmission and re-review are required',
                  'Partners with active discussions are not affected',
                ].map(t => (
                  <li key={t} className="flex items-start gap-2 text-xs text-slate-600">
                    <Icons.check className="size-3.5 text-green-600 shrink-0 mt-0.5" />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setUnlockConfirm(false)} disabled={unlocking}>
                  Cancel
                </Button>
                <Button size="sm" loading={unlocking} onClick={handleUnlockEditing}>
                  Pause & unlock editing
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit / Resubmission banner ── */}
        {isEditing && (
          isResubmission ? (
            <div className="border border-rose-200 bg-rose-50 p-4 flex items-center gap-3">
              <div className="size-9 bg-rose-100 flex items-center justify-center shrink-0">
                <Icons.refreshCw className="size-4 text-rose-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-rose-800">Resubmitting Project</p>
                <p className="text-xs text-rose-600">Address the reviewer feedback, then click Resubmit at the final step.</p>
              </div>
            </div>
          ) : (
            <div className={cn(
              "border p-4 flex items-center gap-3",
              materialLocked ? "border-blue-200 bg-blue-50" : "border-amber-200 bg-amber-50"
            )}>
              <div className={cn(
                "size-9 flex items-center justify-center shrink-0",
                materialLocked ? "bg-blue-100" : "bg-amber-100"
              )}>
                <Icons.pencil className={cn("size-4", materialLocked ? "text-blue-600" : "text-amber-600")} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">Editing Project</p>
                <p className="text-xs text-slate-500">
                  {materialLocked
                    ? 'Core fields (size, capital, technology, location, checklist) are locked while the project is live. Narrative details, target dates and documents remain editable.'
                    : 'Changes will be saved when you click Save at the bottom.'}
                </p>
              </div>
              {materialLocked && (
                <Button size="sm" variant="outline" onClick={() => setUnlockConfirm(true)} icon={<Icons.lock className="size-3.5" />}>
                  Unlock full editing
                </Button>
              )}
            </div>
          )
        )}

        {/* ── Engagement lock banners ── */}
        {engagementLock === 'hard' && (
          <div className="border border-red-200 bg-red-50 p-4 flex items-center gap-3">
            <Icons.lock className="size-5 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-800">Project Locked — Active Deal Negotiations</p>
              <p className="text-xs text-red-600 mt-0.5">A Term Sheet or later engagement is in progress. Core project fields cannot be changed. Contact your partner to unlock.</p>
            </div>
          </div>
        )}
        {engagementLock === 'soft' && (
          <div className="border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
            <Icons.alertTriangle className="size-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">Partial Lock — NDA Signed</p>
              <p className="text-xs text-amber-700 mt-0.5">Core financial &amp; technical fields are locked. You can still update the project narrative, governance terms, and documents.</p>
            </div>
          </div>
        )}

        {/* ── Step indicator ── */}
        <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project Submission</p>
              <h2 className="text-sm font-bold text-slate-900 mt-0.5">Step {step} of 5</h2>
            </div>
            <span className="text-xl font-bold text-green-800 tabular-nums">{Math.round(progress)}%</span>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-1 mb-3">
              {([1, 2, 3, 4, 5] as Step[]).map((s) => (
                <div key={s} className="flex items-center flex-1">
                  <div className="flex items-center gap-2 flex-1">
                    <div
                      className={cn(
                        "size-8 flex items-center justify-center font-bold text-xs transition-all shrink-0",
                        step === s
                          ? "bg-green-800 text-white shadow-sm shadow-green-900/20"
                          : step > s
                            ? "bg-green-100 text-green-800"
                            : "bg-slate-100 text-slate-400"
                      )}
                    >
                      {step > s ? <Icons.check className="size-3.5" /> : s}
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest hidden lg:block truncate",
                      step === s ? "text-green-800" : step > s ? "text-green-700" : "text-slate-300"
                    )}>
                      {STEP_META[s].label}
                    </span>
                  </div>
                  {s < 5 && (
                    <div className={cn(
                      "w-full h-0.5 mx-2",
                      step > s ? "bg-green-300" : "bg-slate-100"
                    )} />
                  )}
                </div>
              ))}
            </div>
            <div className="w-full bg-slate-100 h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-green-800 to-green-600 h-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Main form card ── */}
        <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
          {/* Step header with dark green bar */}
          <div className="bg-[#0b3b24] px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="size-11 bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                {(() => { const StepIcon = STEP_META[step].icon; return <StepIcon className="size-5 text-emerald-200" />; })()}
              </div>
              <div>
                <p className="text-[10px] font-bold text-emerald-200/50 uppercase tracking-widest">Step {step}</p>
                <h1 className="text-lg font-bold text-white tracking-tight">
                  {STEP_META[step].label}
                </h1>
                <p className="text-xs text-emerald-100/60 font-medium mt-0.5">
                  {STEP_META[step].subtitle}
                </p>
              </div>
            </div>
          </div>
          <div className="p-6 md:p-8">

          {/* Global errors */}
          {errors._submit && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 flex items-start gap-3">
              <Icons.alertTriangle className="size-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-800">Submission failed</p>
                <p className="text-xs text-red-600 mt-0.5">{errors._submit}</p>
              </div>
            </div>
          )}

          {displayErrors.length > 0 && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-100 flex items-start gap-3">
              <Icons.alertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800 mb-1">Please fix the following:</p>
                {displayErrors.map(([key, msg]) => (
                  <p key={key} className="text-xs text-amber-600">{msg}</p>
                ))}
              </div>
            </div>
          )}

          {/* Step content */}
          <div className="space-y-6">
            {pageLoading ? <StepSkeleton /> : (
              <>
                {/* ─── Step 1: Project Identity ─── */}
                {step === 1 && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <FieldLabel field="name" required />
                        <input
                          placeholder="e.g. Lusaka South Solar II"
                          value={formData.name}
                          onChange={(e) => updateFormData({ name: e.target.value })}
                          disabled={coreLocked}
                          className={cn(inputClass, errors.name && "border-red-300 focus:ring-red-300/20 focus:border-red-400", coreLocked && "opacity-50 cursor-not-allowed bg-slate-100")}
                        />
                        {errors.name && <p className="text-[10px] text-red-500 font-medium">{errors.name}</p>}
                      </div>
                      <div className="space-y-2">
                        <FieldLabel field="technology_type" required />
                        <div className="relative">
                          <select
                            value={formData.technology_type}
                            onChange={(e) => updateFormData({ technology_type: e.target.value as any })}
                            disabled={materialLocked}
                            className={cn(selectClass, materialLocked && "opacity-50 cursor-not-allowed bg-slate-100")}
                          >
                            {TECHNOLOGY_TYPES.map(t => (
                              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                          <Icons.chevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <SearchableCountrySelect
                          value={formData.location_country}
                          onChange={(val) => updateFormData({ location_country: val, location_region: '' })}
                          label={FIELD_LABELS.location_country}
                          required
                          helperText={FIELD_HINTS.location_country}
                          error={errors.location_country}
                          disabled={materialLocked}
                        />
                      </div>
                      <div className="space-y-2">
                        <FieldLabel field="location_region" required />
                        {(() => {
                          const matched = findCountry(formData.location_country);
                          const regions = matched
                            ? COUNTRY_REGIONS_LOOKUP[matched.name]
                            : undefined;
                          if (regions && regions.length > 0) {
                            return (
                              <div className="relative">
                                <select
                                  value={formData.location_region}
                                  onChange={(e) => updateFormData({ location_region: e.target.value })}
                                  disabled={materialLocked}
                                  className={cn(selectClass, errors.location_region && "border-red-300 focus:ring-red-300/20 focus:border-red-400", materialLocked && "opacity-50 cursor-not-allowed bg-slate-100")}
                                >
                                  <option value="">Select region...</option>
                                  {regions.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                                <Icons.chevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                              </div>
                            );
                          }
                          return (
                            <input
                              placeholder="e.g. Lusaka District"
                              value={formData.location_region}
                              onChange={(e) => updateFormData({ location_region: e.target.value })}
                              disabled={materialLocked}
                              className={cn(inputClass, errors.location_region && "border-red-300 focus:ring-red-300/20 focus:border-red-400", materialLocked && "opacity-50 cursor-not-allowed bg-slate-100")}
                            />
                          );
                        })()}
                        {errors.location_region && <p className="text-[10px] text-red-500 font-medium">{errors.location_region}</p>}
                      </div>
                    </div>

                    {/* Readiness checklist */}
                    <div className="pt-6 border-t border-slate-100 space-y-5">
                      <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                        <div className="size-7 bg-green-50 border border-green-100 flex items-center justify-center">
                          <Icons.checkCircle2 className="size-3.5 text-green-800" />
                        </div>
                        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Project Readiness Checklist</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Land security — Yes requires proof */}
                        <div className="space-y-3">
                          <YesNoField
                            label="Have you secured the land?"
                            description="You must attach proof (land title or lease agreement) if you answer Yes."
                            value={formData.has_secured_land}
                            onChange={(v) => updateFormData(
                              v
                                ? { has_secured_land: true }
                                : { has_secured_land: false, land_title_status: 'Not Applicable' }
                            )}
                            required
                            error={errors.has_secured_land}
                            disabled={materialLocked}
                          />
                          {formData.has_secured_land && (
                            <>
                              <ProofUploadSlot
                                label="Land Title / Lease Proof"
                                file={proofFiles[LAND_TITLE_PROOF_TYPE]}
                                existingName={existingProofDocs[LAND_TITLE_PROOF_TYPE] ? docFileName(existingProofDocs[LAND_TITLE_PROOF_TYPE]) : null}
                                error={errors[LAND_TITLE_PROOF_TYPE]}
                                onSelect={(f) => handleProofSelect(LAND_TITLE_PROOF_TYPE, f)}
                                onRemove={() => handleRemoveDocument(existingProofDocs[LAND_TITLE_PROOF_TYPE])}
                              />
                              <div className="space-y-2 ml-1">
                                <FieldLabel field="land_title_status" />
                                <div className="relative">
                                  <select
                                    value={formData.land_title_status}
                                    onChange={(e) => updateFormData({ land_title_status: e.target.value as any })}
                                    disabled={materialLocked}
                                    className={cn(selectClass, materialLocked && "opacity-50 cursor-not-allowed bg-slate-100")}
                                  >
                                    {LAND_TITLE_STATUSES.map(s => (
                                      <option key={s} value={s}>{s}</option>
                                    ))}
                                  </select>
                                  <Icons.chevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Financial close + regulatory approvals — each Yes/tick requires proof */}
                        <div className="space-y-3">
                          <YesNoField
                            label="Have you reached financial close?"
                            description="You must attach proof (financing agreement / closing statement) if you answer Yes."
                            value={formData.has_reached_financial_close}
                            onChange={(v) => updateFormData({ has_reached_financial_close: v })}
                            required
                            error={errors.has_reached_financial_close}
                            disabled={materialLocked}
                          />
                          {formData.has_reached_financial_close && (
                            <ProofUploadSlot
                              label="Financial Close Proof"
                              file={proofFiles[FINANCIAL_CLOSE_PROOF_TYPE]}
                              existingName={existingProofDocs[FINANCIAL_CLOSE_PROOF_TYPE] ? docFileName(existingProofDocs[FINANCIAL_CLOSE_PROOF_TYPE]) : null}
                              error={errors[FINANCIAL_CLOSE_PROOF_TYPE]}
                              onSelect={(f) => handleProofSelect(FINANCIAL_CLOSE_PROOF_TYPE, f)}
                              onRemove={() => handleRemoveDocument(existingProofDocs[FINANCIAL_CLOSE_PROOF_TYPE])}
                            />
                          )}
                          <div className="space-y-2 ml-1">
                            <FieldLabel field="regulatory_approvals" />
                            <p className="text-[10px] text-slate-400 font-medium ml-1">Tick the approvals you hold — each requires its own proof document.</p>
                            <div className="space-y-2">
                              {REGULATORY_APPROVALS.map((approval) => {
                                const isTicked = formData.regulatory_approvals.includes(approval);
                                const proofKey = APPROVAL_PROOF_TYPES[approval];
                                return (
                                  <div key={approval} className="space-y-1.5">
                                    <label className={cn(
                                      "flex items-center gap-2.5 group",
                                      materialLocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                                    )}>
                                      <input
                                        type="checkbox"
                                        checked={isTicked}
                                        disabled={materialLocked}
                                        onChange={(e) => {
                                          const approvals = e.target.checked
                                            ? [...formData.regulatory_approvals, approval]
                                            : formData.regulatory_approvals.filter(a => a !== approval);
                                          updateFormData({ regulatory_approvals: approvals });
                                        }}
                                        className="size-3.5 rounded border-slate-300 text-primary focus:ring-primary/30"
                                      />
                                      <span className="text-xs font-medium text-slate-500 group-hover:text-slate-700 transition-colors">{approval}</span>
                                    </label>
                                    {isTicked && proofKey && (
                                      <div className="pl-5">
                                        <ProofUploadSlot
                                          label={`Proof — ${approval}`}
                                          file={proofFiles[proofKey]}
                                          existingName={existingProofDocs[proofKey] ? docFileName(existingProofDocs[proofKey]) : null}
                                          error={errors[proofKey]}
                                          onSelect={(f) => handleProofSelect(proofKey, f)}
                                          onRemove={() => handleRemoveDocument(existingProofDocs[proofKey])}
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* ─── Step 2: Scale & Financials ─── */}
                {step === 2 && (
                  <>
                    {coreLocked && (
                      <div className={cn(
                        "mb-4 p-3 flex items-center gap-2 border",
                        materialLocked && !engagementSoftLock
                          ? "bg-blue-50 border-blue-200 text-blue-700"
                          : "bg-amber-50 border-amber-200"
                      )}>
                        <Icons.lock className={cn("size-4 shrink-0", materialLocked && !engagementSoftLock ? "text-blue-500" : "text-amber-500")} />
                        <p className={cn("text-xs font-semibold", materialLocked && !engagementSoftLock ? "text-blue-700" : "text-amber-700")}>
                          {materialLocked && !engagementSoftLock
                            ? 'Financial fields are locked while the project is live. Use “Unlock full editing” above to change them.'
                            : 'Financial fields are locked — an NDA or later engagement is active on this project.'}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <FieldLabel field="project_size_mw" required />
                        <input
                          type="number"
                          placeholder="e.g. 50"
                          value={formData.project_size_mw || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateFormData({ project_size_mw: val === '' ? 0 : parseFloat(val) });
                          }}
                          className={cn(inputClass, errors.project_size_mw && "border-red-300 focus:ring-red-300/20 focus:border-red-400", coreLocked && "opacity-50 cursor-not-allowed bg-slate-100")}
                          disabled={coreLocked}
                        />
                        {errors.project_size_mw && <p className="text-[10px] text-red-500 font-medium">{errors.project_size_mw}</p>}
                      </div>
                      <div className="space-y-2">
                        <FieldLabel field="capital_required" required />
                        <input
                          type="number"
                          placeholder="e.g. 500000000"
                          value={formData.capital_required || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateFormData({ capital_required: val === '' ? 0 : parseFloat(val) });
                          }}
                          className={cn(inputClass, errors.capital_required && "border-red-300 focus:ring-red-300/20 focus:border-red-400", coreLocked && "opacity-50 cursor-not-allowed bg-slate-100")}
                          disabled={coreLocked}
                        />
                        {errors.capital_required && <p className="text-[10px] text-red-500 font-medium">{errors.capital_required}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <FieldLabel field="capex" />
                        <input
                          type="number"
                          placeholder="e.g. 350000000"
                          value={formData.capex || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateFormData({ capex: val === '' ? 0 : parseFloat(val) });
                          }}
                          disabled={materialLocked}
                          className={cn(inputClass, materialLocked && "opacity-50 cursor-not-allowed bg-slate-100")}
                        />
                      </div>
                      <div className="space-y-2">
                        <FieldLabel field="opex" />
                        <input
                          type="number"
                          placeholder="e.g. 5000000"
                          value={formData.opex || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateFormData({ opex: val === '' ? 0 : parseFloat(val) });
                          }}
                          disabled={materialLocked}
                          className={cn(inputClass, materialLocked && "opacity-50 cursor-not-allowed bg-slate-100")}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <FieldLabel field="funding_required" />
                      <input
                        type="number"
                        placeholder="Amount of external capital needed"
                        value={formData.funding_required || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateFormData({ funding_required: val === '' ? 0 : parseFloat(val) });
                        }}
                        disabled={materialLocked}
                        className={cn(inputClass, materialLocked && "opacity-50 cursor-not-allowed bg-slate-100")}
                      />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel field="capital_structure_type" required />
                      <div className="relative">
                        <select
                          value={formData.capital_structure_type}
                          onChange={(e) => updateFormData({ capital_structure_type: e.target.value as CapitalStructureType })}
                          disabled={materialLocked}
                          className={cn(selectClass, materialLocked && "opacity-50 cursor-not-allowed bg-slate-100")}
                        >
                          {CAPITAL_STRUCTURE_TYPES.map(t => (
                            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                        <Icons.chevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <FieldLabel field="description" />
                      <textarea
                        placeholder="Brief description of the project opportunity, objectives, and expected impact..."
                        value={formData.description}
                        onChange={(e) => updateFormData({ description: e.target.value })}
                        rows={4}
                        className={textareaClass}
                      />
                      <p className="text-[10px] text-slate-400 ml-1">{formData.description.length}/5000</p>
                    </div>
                  </>
                )}

                {/* ─── Step 3: Timeline & Status ─── */}
                {step === 3 && (
                  <>
                    <div className="space-y-2">
                      <FieldLabel field="project_stage" />
                      {aiStage ? (
                        <div className="p-4 border border-purple-200 bg-purple-50/40 flex items-start gap-3">
                          <div className="size-10 bg-purple-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                            {aiStage.number}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-extrabold text-slate-900">{aiStage.label}</p>
                              <span className="px-2 py-0.5 border border-sky-200 bg-sky-100 text-sky-700 text-[9px] font-bold uppercase tracking-wider">Preliminary estimate · based on your answers</span>
                            </div>
                            {aiStage.rationale && (
                              <p className="text-xs text-slate-600 font-medium mt-1.5 leading-relaxed">{aiStage.rationale}</p>
                            )}
                            {aiStage.services.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2.5">
                                {aiStage.services.map(s => (
                                  <span key={s} className="px-2.5 py-1 border border-purple-200 bg-white text-purple-700 text-[10px] font-bold">
                                    {s.replace(/_/g, ' ')}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p className="text-[10px] text-slate-400 font-medium mt-2.5">
                              {'This is a preliminary estimate from your answers so far. At submission, the AI reads every uploaded document and sets the verified final stage.'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 border border-primary/20 bg-primary/[0.03] flex items-start gap-3">
                          <div className="size-9 bg-primary/10 flex items-center justify-center shrink-0">
                            <Icons.cpu className="size-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800">Determined automatically by AI</p>
                            <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">
                              Based on your answers and documents, our AI places your project at the right development stage — Concept → Pre-Feasibility → Full Feasibility → Regulatory Approval → PPA Ready → Financial Close → Construction → Operation. The stage is set after submission and is read-only.
                            </p>
                            {isEditing && (
                              <span className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                                <Icons.check className="size-3" /> Current: {stageLabel(formData.project_stage)}
                              </span>
                            )}
                            {!isEditing && stageCheck === 'failed' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  setStageCheck('running');
                                  const result = await runReadinessPreview();
                                  setStageCheck(result.ok ? 'idle' : 'failed');
                                  if (!result.ok) toast.error(result.message || 'Could not determine your project readiness automatically.');
                                }}
                                className="mt-3 h-8 px-3 bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-bold hover:bg-purple-100 transition-colors inline-flex items-center gap-1.5"
                              >
                                <Icons.zap className="size-3" /> Re-run AI stage
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Readiness Report: gaps + recommended profiles ── */}
                    {readiness && (
                      <div className="pt-2 space-y-4">
                        {/* Header: stage + readiness gauge */}
                        <div className="border border-slate-200 bg-white overflow-hidden">
                          <div className="px-6 py-5 bg-[#0b3b24] flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="size-14 bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
                                <Icons.barChart2 className="size-6 text-emerald-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em] mb-1">
                                  Readiness Preview
                                </p>
                                <h3 className="text-lg font-extrabold text-white leading-tight truncate">
                                  {readiness.stage.label}
                                </h3>
                                <p className="text-[11px] text-slate-300 font-medium mt-0.5 leading-relaxed">
                                  {readiness.stage.description}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              <div className="text-right">
                                <div className="relative size-16">
                                  <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
                                    <circle cx="32" cy="32" r="26" fill="none" strokeWidth="6" className="stroke-white/10" />
                                    <circle
                                      cx="32" cy="32" r="26" fill="none" strokeWidth="6" strokeLinecap="round"
                                      className={readiness.overall_readiness >= 70 ? 'stroke-emerald-400' : readiness.overall_readiness >= 40 ? 'stroke-amber-400' : 'stroke-red-400'}
                                      strokeDasharray={`${(readiness.overall_readiness / 100) * 163.4} 163.4`}
                                    />
                                  </svg>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-sm font-black text-white">{readiness.overall_readiness}%</span>
                                  </div>
                                </div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Readiness</p>
                              </div>
                              <span className={cn(
                                'px-2.5 py-1 border text-[9px] font-bold uppercase tracking-wider',
                                readiness.overall_readiness >= 70
                                  ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300'
                                  : readiness.overall_readiness >= 40
                                    ? 'bg-amber-500/10 border-amber-400/30 text-amber-300'
                                    : 'bg-red-500/10 border-red-400/30 text-red-300',
                              )}>
                                {readiness.overall_readiness >= 70 ? 'Strong' : readiness.overall_readiness >= 40 ? 'Developing' : 'Early'}
                              </span>
                            </div>
                          </div>

                          {/* Summary strip */}
                          <div className={cn(
                            'px-6 py-3.5 border-b border-slate-100 flex items-start gap-2.5',
                            readiness.overall_readiness >= 40 ? 'bg-sky-50/60' : 'bg-amber-50/60',
                          )}>
                            <Icons.info className={cn('size-4 shrink-0 mt-0.5', readiness.overall_readiness >= 40 ? 'text-sky-500' : 'text-amber-500')} />
                            <div>
                              <p className="text-xs text-slate-700 font-semibold leading-relaxed">{readiness.summary}</p>
                              <p className="text-[10px] text-slate-400 font-medium mt-1">
                                Preliminary estimate from your answers — the AI re-verifies everything against your documents at submission.
                              </p>
                            </div>
                          </div>

                          {/* Gaps */}
                          {readiness.recommendedProfiles.length > 0 && (
                            <div className="px-6 py-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.16em]">
                                  What to address next
                                </h4>
                                <span className="text-[10px] font-bold text-slate-300">
                                  {readiness.recommendedProfiles.length} item{readiness.recommendedProfiles.length > 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {readiness.recommendedProfiles.map((rec) => (
                                  <div key={rec.gapId} className={cn(
                                    'border bg-white overflow-hidden transition-shadow',
                                    rec.severity === 'critical' ? 'border-red-200' : rec.severity === 'high' ? 'border-amber-200' : 'border-slate-200',
                                  )}>
                                    <div className={cn(
                                      'px-4 py-2.5 flex items-center justify-between gap-3 border-b',
                                      rec.severity === 'critical' ? 'bg-red-50/60 border-red-100' : rec.severity === 'high' ? 'bg-amber-50/60 border-amber-100' : 'bg-slate-50 border-slate-100',
                                    )}>
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className={cn(
                                          'size-1.5 rounded-full shrink-0',
                                          rec.severity === 'critical' ? 'bg-red-500' : rec.severity === 'high' ? 'bg-amber-500' : 'bg-sky-400',
                                        )} />
                                        <p className="text-xs font-bold text-slate-800 truncate">{rec.label}</p>
                                      </div>
                                      <span className={cn(
                                        'px-2 py-0.5 border text-[8px] font-bold uppercase tracking-wider shrink-0',
                                        SEVERITY_STYLE[rec.severity] ?? SEVERITY_STYLE.medium,
                                      )}>
                                        {rec.severity}
                                      </span>
                                    </div>

                                    <div className="px-4 py-3">
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/5 border border-primary/10 text-primary text-[9px] font-bold uppercase tracking-wider mb-3">
                                        <Icons.briefcase className="size-3" />
                                        {rec.recommendation.partnerType}
                                      </span>

                                      {rec.candidates.length === 0 ? (
                                        <div className="border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3.5 text-center">
                                          <p className="text-[11px] font-bold text-slate-500">
                                            No verified {rec.recommendation.partnerType.toLowerCase()} profiles match yet
                                          </p>
                                          <p className="text-[10px] text-slate-400 font-medium mt-1 leading-relaxed">
                                            Complete your submission — the matching engine scans every verified partner and recommends the best fit for this gap.
                                          </p>
                                        </div>
                                      ) : (
                                        <div className="space-y-2">
                                          {rec.candidates.map((candidate) => {
                                            const engagement = engagedMap[candidate.id];
                                            const isContacting = contactingKey === `${candidate.id}-${rec.gapId}`;
                                            const profileHref = (() => {
                                              const companyId =
                                                candidate.raw.company_id ??
                                                candidate.raw.capital_partner?.company_id ??
                                                candidate.raw.technical_partner?.company_id ?? '';
                                              return companyId ? `/developer/request-intro/${companyId}` : '#';
                                            })();
                                            return (
                                              <div key={candidate.id} className="flex items-center gap-3 p-2.5 border border-slate-100 bg-slate-50/60">
                                                <div className={cn(
                                                  'size-10 flex items-center justify-center shrink-0 font-black text-xs',
                                                  candidate.score >= 80
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : candidate.score >= 50
                                                      ? 'bg-amber-100 text-amber-700'
                                                      : 'bg-slate-100 text-slate-500',
                                                )}>
                                                  {candidate.companyName.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-1.5">
                                                    <p className="text-xs font-bold text-slate-800 truncate">{candidate.companyName}</p>
                                                    <span className={cn(
                                                      'shrink-0 px-1.5 py-0.5 text-[9px] font-bold',
                                                      candidate.score >= 80
                                                        ? 'bg-emerald-50 text-emerald-700'
                                                        : candidate.score >= 50
                                                          ? 'bg-amber-50 text-amber-700'
                                                          : 'bg-slate-100 text-slate-500',
                                                    )}>
                                                      {candidate.score}% match
                                                    </span>
                                                  </div>
                                                  <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{candidate.capabilityLine}</p>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                  {engagement ? (
                                                    <Link href={`/engagements/${engagement.id}`}>
                                                      <Button size="sm" variant="outline" icon={<Icons.arrowRight />}>
                                                        Engaged
                                                      </Button>
                                                    </Link>
                                                  ) : (
                                                    <Button
                                                      size="sm"
                                                      loading={isContacting}
                                                      onClick={() => handleContact(candidate, { ...rec, id: rec.gapId } as unknown as GapItem)}
                                                      icon={<Icons.send />}
                                                    >
                                                      Contact
                                                    </Button>
                                                  )}
                                                  <Link href={profileHref} title="View full profile" className="size-8 border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary/30 transition-colors">
                                                    <Icons.arrowUpRight className="size-3.5" />
                                                  </Link>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                            <Icons.clock className="size-3.5 text-slate-400" />
                            You can contact these profiles now — the request is saved to your project even before you finish submitting.
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <FieldLabel field="target_financial_close_date" />
                        <input
                          type="date"
                          value={formData.target_financial_close_date}
                          onChange={(e) => updateFormData({ target_financial_close_date: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                      <div className="space-y-2">
                        <FieldLabel field="target_cod" />
                        <input
                          type="date"
                          value={formData.target_cod}
                          onChange={(e) => updateFormData({ target_cod: e.target.value })}
                          className={cn(inputClass, errors.target_cod && "border-red-300 focus:ring-red-300/20 focus:border-red-400")}
                        />
                        {errors.target_cod && <p className="text-[10px] text-red-500 font-medium">{errors.target_cod}</p>}
                      </div>
                    </div>
                  </>
                )}

                {/* ─── Step 4: Technical Requirements ─── */}
                {step === 4 && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <FieldLabel field="terrain_complexity" required />
                        <div className="relative">
                          <select
                            value={techRequirements.terrain_complexity}
                            onChange={(e) => updateTechData({ terrain_complexity: e.target.value as any })}
                            className={selectClass}
                          >
                            {TERRAIN_COMPLEXITY.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          <Icons.chevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <FieldLabel field="grid_status" required />
                        <div className="relative">
                          <select
                            value={techRequirements.grid_status}
                            onChange={(e) => updateTechData({ grid_status: e.target.value as any })}
                            className={selectClass}
                          >
                            {GRID_STATUS.map(g => (
                              <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                          <Icons.chevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <FieldLabel field="budget_preference" required />
                        <div className="relative">
                          <select
                            value={techRequirements.budget_preference}
                            onChange={(e) => updateTechData({ budget_preference: e.target.value as any })}
                            className={selectClass}
                          >
                            {BUDGET_PREFERENCE.map(b => (
                              <option key={b} value={b}>{b === 'MILESTONE' ? 'Milestone Based' : b === 'FIXED' ? 'Fixed Price' : 'Negotiable'}</option>
                            ))}
                          </select>
                          <Icons.chevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <FieldLabel field="ppa_status" />
                        <div className="relative">
                          <select
                            value={techRequirements.ppa_status}
                            onChange={(e) => updateTechData({ ppa_status: e.target.value as any })}
                            className={selectClass}
                          >
                            {PPA_STATUS.map(s => (
                              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                          <Icons.chevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <FieldLabel field="required_services" />
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {['EPC_CONSTRUCTION', 'O_AND_M', 'FEASIBILITY_STUDY', 'ENVIRONMENTAL_ASSESSMENT', 'LEGAL_ADVISORY', 'FINANCIAL_ADVISORY', 'GRID_CONNECTION', 'LOGISTICS'].map(service => (
                          <label key={service} className="flex items-center gap-2 p-2 border border-slate-200 bg-slate-50 hover:bg-white cursor-pointer transition-all text-xs font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={techRequirements.required_services.includes(service)}
                              onChange={(e) => {
                                const current = techRequirements.required_services;
                                const next = e.target.checked
                                  ? [...current, service]
                                  : current.filter(s => s !== service);
                                updateTechData({ required_services: next });
                              }}
                              className="size-3.5 rounded border-slate-300 text-green-600 focus:ring-green-500/20"
                            />
                            {service.replace(/_/g, ' ')}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* ─── Step 5: Narrative & Submission ─── */}
                {step === 5 && (
                  <>
                    {/* ── Optional: Governance ── */}
                    <div className="space-y-5">
                      <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                        <div className="size-7 bg-slate-100 flex items-center justify-center">
                          <Icons.fileText className="size-3.5 text-slate-500" />
                        </div>
                        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Optional Details</h3>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <FieldLabel field="governance_terms" />
                          <textarea
                            placeholder="e.g. Board seat requirements, voting rights..."
                            className={textareaClass}
                            rows={3}
                            value={formData.governance_terms}
                            onChange={(e) => updateFormData({ governance_terms: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <FieldLabel field="exit_terms" />
                          <textarea
                            placeholder="e.g. Buyback provisions, transfer restrictions..."
                            className={textareaClass}
                            rows={3}
                            value={formData.exit_terms}
                            onChange={(e) => updateFormData({ exit_terms: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <FieldLabel field="risk_disclosures" />
                          <textarea
                            placeholder="e.g. Environmental concerns, local grid instability..."
                            className={textareaClass}
                            rows={3}
                            value={formData.risk_disclosures}
                            onChange={(e) => updateFormData({ risk_disclosures: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    {/* ── Documents ── */}
                    <div className="space-y-4">
                      <div>
                        <FieldLabel field="documents" />
                        <p className="text-xs text-slate-400 font-medium mt-1 ml-1">At least 1 document required. PDF, DOC, DOCX, XLS, XLSX, PNG, JPG. Max 20MB each.</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {PROJECT_DOCUMENT_TYPES.map((docType) => {
                          const existing = selectedFiles.find(f => f.type === docType);
                          const existingDoc = existingDocs.find(d => d.document_type === docType);
                          const docError = errors[docType];
                          const progressVal = existing ? uploadProgress[existing.file.name] : undefined;
                          const hasAny = !!existing || !!existingDoc;
                          return (
                            <div key={docType} className={cn(
                              "p-4 border flex flex-col gap-2 transition-all",
                              hasAny ? "border-green-200 bg-green-50/30" : "border-slate-100 bg-slate-50/50",
                              docError && "border-red-200 bg-red-50/30"
                            )}>
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={cn(
                                    "size-9 flex items-center justify-center shrink-0",
                                    hasAny ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"
                                  )}>
                                    <Icons.fileText className="size-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-700 leading-none mb-1">{docType}</p>
                                    <p className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">
                                      {existing ? existing.file.name : existingDoc ? docFileName(existingDoc) : 'Optional'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {existingDoc && !existing && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveDocument(existingDoc)}
                                      className="size-8 border border-slate-200 bg-white text-slate-400 hover:text-red-600 hover:border-red-200 flex items-center justify-center transition-colors"
                                      title="Remove document"
                                    >
                                      <Icons.trash className="size-3.5" />
                                    </button>
                                  )}
                                  <label className="cursor-pointer">
                                    <input
                                      type="file"
                                      className="hidden"
                                      accept={ALLOWED_EXTENSIONS}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileSelect(docType, file);
                                        e.target.value = '';
                                      }}
                                    />
                                    <div className={cn(
                                      "size-8 border flex items-center justify-center transition-colors",
                                      hasAny
                                        ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                        : "border-slate-200 text-slate-400 hover:text-green-700 hover:border-green-200"
                                    )}>
                                      {existing ? <Icons.check className="size-4" /> : hasAny ? <Icons.refreshCw className="size-3.5" /> : <Icons.plus className="size-4" />}
                                    </div>
                                  </label>
                                </div>
                              </div>
                              {typeof progressVal === 'number' && progressVal < 100 && (
                                <div className="w-full bg-slate-200 h-1 overflow-hidden">
                                  <div className="bg-primary h-full transition-all" style={{ width: `${progressVal}%` }} />
                                </div>
                              )}
                              {docError && <p className="text-[10px] text-red-500 font-medium">{docError}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── Review Summary + Submit (at the bottom) ── */}
                    <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
                      <div className="px-6 py-4 bg-[#0b3b24] flex items-center gap-3">
                        <div className="size-9 bg-white/10 border border-white/15 flex items-center justify-center">
                          <Icons.checkCircle2 className="size-5 text-emerald-200" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">{isResubmission ? 'Review & Resubmit' : isEditing ? 'Review & Save' : 'Review & Submit'}</h3>
                          <p className="text-[11px] text-emerald-200/60 font-medium">{isResubmission ? 'Address the feedback, then resubmit for review.' : isEditing ? 'Confirm your changes and save.' : 'Confirm your details and submit for review.'}</p>
                        </div>
                      </div>
                      <div className="p-6 space-y-4">
                        {/* Project name + tech type */}
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-lg font-bold text-slate-900 tracking-tight">{formData.name || 'Untitled Project'}</p>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">{formData.technology_type.replace(/_/g, ' ')} &middot; {formData.location_country || 'No country'}</p>
                          </div>
                          <span className="shrink-0 px-3 py-1 text-[10px] font-bold uppercase tracking-wider border bg-purple-50 text-purple-700 border-purple-200">
                            {isEditing ? stageLabel(formData.project_stage) : (aiStage ? `${aiStage.number} · ${aiStage.label}` : 'AI Stage')}
                          </span>
                        </div>

                        {/* Key metrics grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { label: 'Capacity', value: formData.project_size_mw ? `${formData.project_size_mw} MW` : '—' },
                            { label: 'Capital', value: formData.capital_required ? `ZMW ${(formData.capital_required / 1_000_000).toFixed(1)}M` : '—' },
                            { label: 'Structure', value: formData.capital_structure_type.replace(/_/g, ' ') },
                            { label: 'Region', value: formData.location_region || '—' },
                          ].map(item => (
                            <div key={item.label} className="p-3 bg-slate-50 border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.label}</p>
                              <p className="text-sm font-bold text-slate-800 mt-1 capitalize">{item.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Readiness tags */}
                        <div className="flex flex-wrap gap-2">
                          {formData.has_secured_land && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold uppercase tracking-wider">
                              <Icons.check className="size-3" /> Land Secured
                            </span>
                          )}
                          {formData.has_reached_financial_close && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold uppercase tracking-wider">
                              <Icons.check className="size-3" /> Financial Close
                            </span>
                          )}
                          {formData.regulatory_approvals.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                              <Icons.check className="size-3" /> {formData.regulatory_approvals.length} Approval{formData.regulatory_approvals.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {selectedFiles.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-bold uppercase tracking-wider">
                              <Icons.fileText className="size-3" /> {selectedFiles.length} Document{selectedFiles.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {getRequiredProofs().length > 0 && missingProofs().length === 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                              <Icons.shieldCheck className="size-3" /> Proofs Attached
                            </span>
                          )}
                          {missingProofs().length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
                              <Icons.alertTriangle className="size-3" /> {missingProofs().length} Proof{missingProofs().length > 1 ? 's' : ''} Required
                            </span>
                          )}
                        </div>

                        {/* Matched Partners notice */}
                        {!isEditing && (
                          <div className="flex items-start gap-3 p-3.5 bg-blue-50 border border-blue-100">
                            <Icons.users className="size-4 text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-700 font-medium leading-relaxed">
                              <span className="font-bold">Matched Partners</span> will appear on your project page once it goes live. Investors are matched automatically based on your project profile.
                            </p>
                          </div>
                        )}

                        {/* Submit CTA */}
                        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="text-xs text-slate-500 font-medium">
                            {analysisPhase === 'uploading' && <p className="text-green-800 font-bold">Uploading documents...</p>}
                            {!analysisPhase && (
                              <p>Your project will be analysed by AI, then reviewed by the platform team and regulators before going live.</p>
                            )}
                          </div>
                          <Button
                            onClick={handleSubmit}
                            disabled={loading || !canCreate}
                            className="h-11 px-10 bg-green-800 hover:bg-green-700 text-white font-bold shadow-none text-sm flex gap-2 disabled:opacity-50 shrink-0"
                          >
                            {loading ? <Icons.spinner className="size-4 animate-spin" /> : <Icons.zap className="size-4" />}
                            {isResubmission ? 'Resubmit Project' : isEditing ? 'Save Changes' : analysisPhase ? 'Processing...' : 'Create Project'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* ── Navigation footer ── */}
          {!pageLoading && (
            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={step === 1 || loading}
                className="h-10 px-5 border-slate-200 font-bold text-slate-600 hover:bg-slate-50 text-sm"
              >
                <Icons.arrowLeft className="size-4 mr-1.5" />
                Back
              </Button>

              {step < 5 && (
                <Button
                  onClick={handleNext}
                  className="h-10 px-8 bg-green-800 hover:bg-green-700 text-white font-bold shadow-none text-sm flex gap-2"
                >
                  Continue
                  <Icons.arrowRight className="size-4" />
                </Button>
              )}
            </div>
          )}
          </div>
        </div>
      </>)}
      </div>
    </div>
  );
}



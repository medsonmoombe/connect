'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { Project, ProjectScore } from '@/types';
import { Icons } from '@/components/ui/icons';
import { stageLabel, getStageRecommendations, STAGE_BY_VALUE } from '@/lib/project-stages';
import { readinessBandStyle } from '@/lib/readiness-thresholds';

/* ─── Props ────────────────────────────────────────────────────────────────── */

export interface AiInsightsPanelProps {
  project: Project;
  scores: ProjectScore | null;
  loading?: boolean;
  className?: string;
  /** Called when user wants to re-run analysis. */
  onReanalyze?: () => void;
  /** Whether reanalysis is currently running. */
  analyzing?: boolean;
  /**
   * Overrides the "no analysis" copy. The same panel is rendered on the developer
   * project page and on the admin review page, and "Run AI document analysis to
   * generate readiness scores" is wrong for a reviewer — nobody there runs it by
   * hand, the submission does.
   */
  emptyCopy?: { title: string; hint: string };
}

/* ─── Rating insight (why each rating holds) ───────────────────────────────── */

/**
 * One milestone inside a pillar, as recorded by the scoring engine's ledger.
 * These are the hard facts behind a rating: `points` is what the milestone
 * actually won. Always present, independent of whether the AI produced prose.
 */
interface ContributionRow {
  key: string;
  label: string;
  points: number;
  maxPoints: number;
  status: string;
  excerpt?: string;
}

interface LedgerPillar {
  key: string;
  label: string;
  earned: number;
  max: number;
  contributions: ContributionRow[];
}

/** The narrative brief, split into paragraphs for rendering. */
function splitBrief(brief: string): string[] {
  return brief
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

interface RatingInsightBlock {
  /** The narrative account of the analysis, split into paragraphs. */
  brief: string[];
  strengths: string[];
  weaknesses: string[];
  overall: string;
  stage: string;
  /** pillar key → one-line reason */
  pillars: Record<string, string>;
  /** evidence key → one-line reason */
  evidence: Record<string, string>;
  ledger: LedgerPillar[];
}

/**
 * Status → what the developer is told. The distinction matters: "claim only" and
 * "weak evidence" are different problems with different fixes, so they must not
 * collapse into a single "missing".
 */
const CONTRIBUTION_STATUS: Record<string, { label: string; cls: string }> = {
  documented:    { label: 'Proven',        cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  self_reported: { label: 'Claim only',     cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  contested:     { label: 'Disputed',       cls: 'bg-red-50 border-red-200 text-red-700' },
  weak_evidence: { label: 'Weak evidence',  cls: 'bg-orange-50 border-orange-200 text-orange-700' },
  absent:        { label: 'Not proven',     cls: 'bg-slate-50 border-slate-200 text-slate-500' },
};

/** ─── Breakdown dimension labels ──────────────────────────────────────────── */

const DIMENSION_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  site_rights:        { label: 'Site Rights & Land', icon: <Icons.mapPin className="size-3.5" /> },
  environmental:     { label: 'Environmental Approval', icon: <Icons.sun className="size-3.5" /> },
  grid_readiness:    { label: 'Grid Readiness', icon: <Icons.zap className="size-3.5" /> },
  feasibility:       { label: 'Feasibility Study', icon: <Icons.fileText className="size-3.5" /> },
  ppa_status:        { label: 'PPA / Offtake', icon: <Icons.handshake className="size-3.5" /> },
  construction_ready: { label: 'Construction Ready', icon: <Icons.hardHat className="size-3.5" /> },
  licensing:         { label: 'Licensing', icon: <Icons.shield className="size-3.5" /> },
  compliance:        { label: 'Compliance', icon: <Icons.checkCircle2 className="size-3.5" /> },
  capex_benchmarking: { label: 'CAPEX Benchmarking', icon: <Icons.dollarSign className="size-3.5" /> },
  opex_sustainability: { label: 'OPEX Sustainability', icon: <Icons.dollarSign className="size-3.5" /> },
  firr:              { label: 'FIRR', icon: <Icons.barChart className="size-3.5" /> },
  fnpv:              { label: 'FNPV', icon: <Icons.barChart className="size-3.5" /> },
  payback_period:    { label: 'Payback Period', icon: <Icons.clock className="size-3.5" /> },
  sensitivity_analysis: { label: 'Sensitivity Analysis', icon: <Icons.lineChart className="size-3.5" /> },
  legal_compliance:  { label: 'Legal Compliance', icon: <Icons.shieldCheck className="size-3.5" /> },
  track_record_dev:  { label: 'Track Record (Dev.)', icon: <Icons.briefcase className="size-3.5" /> },
  track_record_ops:  { label: 'Track Record (Ops.)', icon: <Icons.briefcase className="size-3.5" /> },
  epc_partnerships:  { label: 'EPC Partnerships', icon: <Icons.users className="size-3.5" /> },
  equity_commitment: { label: 'Equity Commitment', icon: <Icons.dollarSign className="size-3.5" /> },
  funding_readiness: { label: 'Funding Readiness', icon: <Icons.dollarSign className="size-3.5" /> },
  company_strength:  { label: 'Company Strength', icon: <Icons.building className="size-3.5" /> },
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  regulatory: { label: 'Regulatory & Readiness', icon: <Icons.shieldCheck className="size-4" />, color: 'text-blue-600', bg: 'from-blue-50 to-transparent' },
  financial:  { label: 'Financial Viability', icon: <Icons.dollarSign className="size-4" />, color: 'text-emerald-600', bg: 'from-emerald-50 to-transparent' },
  developer:  { label: 'Developer Strength', icon: <Icons.building className="size-4" />, color: 'text-primary', bg: 'from-primary/[0.04] to-transparent' },
  // Evidence-engine pillars (SCORING_V2) — each measured out of its own max.
  land:         { label: 'Land & Site Control', icon: <Icons.mapPin className="size-4" />, color: 'text-amber-600', bg: 'from-amber-50 to-transparent' },
  technical:    { label: 'Technical Readiness', icon: <Icons.settings className="size-4" />, color: 'text-violet-600', bg: 'from-violet-50 to-transparent' },
  grid:         { label: 'Grid Readiness', icon: <Icons.zap className="size-4" />, color: 'text-sky-600', bg: 'from-sky-50 to-transparent' },
  construction: { label: 'Construction Readiness', icon: <Icons.hardHat className="size-4" />, color: 'text-orange-600', bg: 'from-orange-50 to-transparent' },
};

/* Partner profile → Find Partners tab section (auto-scroll target). */
const PARTNER_REFERRAL_TYPE: Record<string, 'CAPITAL' | 'TECHNICAL'> = {
  Financial: 'CAPITAL',
  Consultant: 'TECHNICAL',
  EPC: 'TECHNICAL',
  EP: 'TECHNICAL',
  'O&M': 'TECHNICAL',
};

/* Partner profile cards shown against the AI-determined stage. */
const PARTNER_PROFILE_CONFIG: Record<string, { label: string; description: string; icon: React.ReactNode }> = {
  Consultant: {
    label: 'Development Consultant',
    description: 'Feasibility studies, environmental & social assessments, permitting, and project structuring.',
    icon: <Icons.users className="size-3.5" />,
  },
  Financial: {
    label: 'Financial Advisory / Capital',
    description: 'Financial modelling, deal structuring, and raising debt or equity to financial close.',
    icon: <Icons.dollarSign className="size-3.5" />,
  },
  EPC: {
    label: 'EPC Contractor',
    description: 'Engineering, procurement and construction of the plant.',
    icon: <Icons.hardHat className="size-3.5" />,
  },
  EP: {
    label: 'Engineering & Procurement',
    description: 'Engineering design and equipment procurement ahead of construction.',
    icon: <Icons.settings className="size-3.5" />,
  },
  'O&M': {
    label: 'Operations & Maintenance',
    description: 'Long-term O&M, performance optimisation and asset management.',
    icon: <Icons.zap className="size-3.5" />,
  },
};

/* ─── Score bar ────────────────────────────────────────────────────────────── */

function ScoreBar({ label, score, max = 100 }: { label: string; score: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  const color = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-600">{label}</span>
        <span className="text-[10px] font-bold text-slate-400">{score}/{max}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ─── Skeleton ─────────────────────────────────────────────────────────────── */

function AiInsightSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-200 overflow-hidden">
          <div className="h-10 bg-[#0b3b24]/80" />
          <div className="p-5 space-y-3">
            <div className="h-3 bg-slate-100" />
            <div className="h-3 bg-slate-100 w-3/4" />
            <div className="h-3 bg-slate-100 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Empty / No analysis ──────────────────────────────────────────────────── */

function NoAnalysis({
  onReanalyze,
  analyzing,
  title = 'No AI Analysis Yet',
  hint = 'Run AI document analysis to generate readiness scores, risk assessment, and recommendations.',
}: {
  onReanalyze?: () => void;
  analyzing?: boolean;
  title?: string;
  hint?: string;
}) {
  return (
    <div className="border border-dashed border-slate-200 p-12 text-center">
      <div className="size-12 bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-4">
        <Icons.cpu className="size-6 text-slate-300" />
      </div>
      <h3 className="text-sm font-bold text-slate-700 mb-1">{title}</h3>
      <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto mb-5">{hint}</p>
      {onReanalyze && (
        <button
          onClick={onReanalyze}
          disabled={analyzing}
          className="h-9 px-5 bg-[#0b3b24] text-white text-xs font-bold hover:bg-[#0b3b24]/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
        >
          {analyzing ? <Icons.spinner className="size-3.5 animate-spin" /> : <Icons.zap className="size-3.5" />}
          Run AI Analysis
        </button>
      )}
    </div>
  );
}

/* ─── Risk badge ────────────────────────────────────────────────────────────── */

function RiskBadge({ level }: { level: string }) {
  const color = level === 'HIGH' ? 'bg-red-50 text-red-700 border-red-200'
    : level === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-slate-50 text-slate-600 border-slate-200';
  return (
    <span className={cn('px-2 py-0.5 rounded text-[9px] font-bold border', color)}>
      {level}
    </span>
  );
}

/* ─── Document relevance badge ─────────────────────────────────────────────── */

function RelevanceBadge({ relevance }: { relevance: string }) {
  const color = relevance === 'HIGH' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : relevance === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-red-50 text-red-600 border-red-200';
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold border', color)}>
      {relevance} relevance
    </span>
  );
}

/**
 * One document's AI verdict, normalised.
 *
 * The two analysis paths write DIFFERENT shapes for `breakdown.document_analysis`:
 *
 * - the evidence engine (orchestrator.ts, the default) writes
 *   `{ doc_id, summary, key_findings, document_type, authenticity:{assessment,notes},
 *      risk_flags, project_match:{status,reason,identity} }`
 * - the legacy LLM path (ai-analysis.ts, rollback only) writes
 *   `{ file_name, content_summary, key_facts, detected_type, relevance,
 *      authenticity_concerns, belongs_to_project, matchStatus }`
 *
 * This component used to read only the legacy names, so on the default path every
 * field resolved to undefined and each document rendered as "Not yet reviewed by
 * AI" — the AI's summaries and findings were silently invisible. Both shapes are
 * mapped here so the report is populated whichever path produced it.
 */
interface DocVerdict {
  /** Present on the evidence-engine path; the join key back to project.documents. */
  docId: string | null;
  /** File name, when the legacy path recorded one. */
  fileName: string;
  detectedType: string;
  summary: string;
  /** Concrete facts the AI extracted. */
  findings: string[];
  relevance: string;
  /** Verdict on the document itself: authentic, likely_authentic, uncertain, suspicious. */
  authenticity: string;
  /** Why it is not trustworthy, when something is wrong with it. */
  concerns: string | null;
  matchStatus: 'match' | 'mismatch' | 'unverifiable' | 'unreviewed';
  matchReason: string | null;
  /** What the document itself names — shown so a verdict can be checked. */
  identity: {
    project_name?: string | null;
    capacity_mw?: number | null;
    location?: string | null;
    parties?: string[] | null;
  } | null;
}

const MATCH_STATUSES = new Set(['match', 'mismatch', 'unverifiable', 'unreviewed']);

function normaliseDocVerdict(raw: any): DocVerdict {
  const pm = raw?.project_match ?? null;
  const ident = pm?.identity ?? raw?.project_identity ?? null;

  const status = MATCH_STATUSES.has(pm?.status) ? pm.status
    : MATCH_STATUSES.has(raw?.matchStatus) ? raw.matchStatus
    : raw?.belongs_to_project === true ? 'match'
    : raw?.belongs_to_project === false ? 'mismatch'
    : raw?.supports_project_claims === false ? 'unverifiable'
    : 'match';

  return {
    docId: typeof raw?.doc_id === 'string' ? raw.doc_id : null,
    fileName: typeof raw?.file_name === 'string' ? raw.file_name : '',
    detectedType: String(raw?.document_type ?? raw?.detected_type ?? ''),
    summary: String(raw?.summary ?? raw?.content_summary ?? '').trim(),
    findings: Array.isArray(raw?.key_findings) ? raw.key_findings
      : Array.isArray(raw?.key_facts) ? raw.key_facts : [],
    relevance: String(raw?.relevance ?? ''),
    authenticity: String(raw?.authenticity?.assessment ?? ''),
    concerns: (typeof raw?.authenticity?.notes === 'string' && raw.authenticity.notes.trim())
      || (typeof raw?.authenticity_concerns === 'string' && raw.authenticity_concerns.trim())
      || null,
    matchStatus: status as DocVerdict['matchStatus'],
    matchReason: (typeof pm?.reason === 'string' && pm.reason)
      || (status === 'match' ? null : 'No identity signals tying this document to the project.'),
    identity: ident && typeof ident === 'object' ? ident : null,
  };
}

/** Mirror of the label the AI receives in ai-analysis.ts (documentLabel). */
function analysisLabelForDoc(doc: { document_type?: string; storage_path?: string }): string {
  if (doc.document_type) return doc.document_type.replace(/_/g, ' ');
  const fileName = doc.storage_path?.split('/').pop() ?? '';
  return fileName.replace(/^\d+_/, '') || doc.document_type || '';
}

/** Loose label matching used only when a verdict carries no `doc_id`. */
function normaliseLabel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/* ─── Section card wrapper ─────────────────────────────────────────────────── */

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 shadow-[0_20px_60px_rgba(15,23,42,0.06)] overflow-hidden">
      <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
        <span className="flex items-center justify-center size-6 rounded bg-white/10 text-black shrink-0">{icon}</span>
        <h3 className="text-[10px] font-bold text-black uppercase tracking-widest">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export function AiInsightsPanel({
  project,
  scores,
  loading = false,
  className,
  onReanalyze,
  analyzing = false,
  emptyCopy,
}: AiInsightsPanelProps) {
  // Parse breakdown dimensions from the AI analysis
  const breakdown = useMemo(() => {
    if (!scores?.breakdown) return null;
    try {
      const raw = typeof scores.breakdown === 'string' ? JSON.parse(scores.breakdown) : scores.breakdown;

      // Orchestrator path A: pillars stored as array [{ key, label, earned, max }].
      // Pillar keys are kept verbatim — Land is Land. It was previously mapped
      // onto `developer`, which rendered land control as "Developer 10/25" and
      // invented a developer-strength dimension the engine never measured.
      if (Array.isArray(raw?.pillars)) {
        const normalised: Record<string, any> = {};
        for (const p of raw.pillars as { key: string; earned: number; max: number }[]) {
          normalised[p.key] = { score: p.earned, max: p.max, details: {} };
        }
        for (const [k, v] of Object.entries(raw)) {
          if (k !== 'pillars' && !(k in normalised)) normalised[k] = v;
        }
        return normalised as Record<string, any>;
      }

      // Orchestrator path B: keys exist but use `earned` instead of `score`
      const PILLAR_KEYS = ['regulatory', 'financial', 'developer'];
      const needsNorm = PILLAR_KEYS.some(k => raw[k] && typeof raw[k].earned === 'number' && typeof raw[k].score !== 'number');
      if (needsNorm) {
        const normalised = { ...raw };
        for (const k of PILLAR_KEYS) {
          if (normalised[k] && typeof normalised[k].earned === 'number') {
            normalised[k] = { ...normalised[k], score: normalised[k].earned };
          }
        }
        return normalised as Record<string, any>;
      }

      return raw as Record<string, any>;
    } catch {
      return null;
    }
  }, [scores?.breakdown]);

  // AI-determined project stage (8-stage taxonomy) — from the score columns,
  // with a fallback to the stored breakdown for older analyses.
  const aiStageInfo = useMemo(() => {
    const fallback = (breakdown as any)?.ai_stage as
      | { number?: number; label?: string; rationale?: string; recommended_services?: string[] }
      | null
      | undefined;
    const determined = (scores?.determined_stage as string | undefined) || null;
    const label = determined
      ? stageLabel(determined)
      : (fallback?.label ?? null);
    const number = (determined ? STAGE_BY_VALUE[determined]?.number : undefined) ?? fallback?.number ?? null;
    const stored = scores?.stage_rationale || fallback?.rationale || null;
    // The stored rationale is suffixed with provenance ("...determined by
    // evidence-based scoring engine v2"), which is noise in a report read by a
    // developer. It is stripped here so the stage reads as prose, not a log line.
    const rationale = stored
      ? stored.replace(/\s*Determined by evidence-based scoring engine[^.]*\.\s*/i, ' ').trim()
      : null;
    const services = (fallback?.recommended_services?.length
      ? fallback.recommended_services
      : (determined ? getStageRecommendations(determined).services : []));
    const partnerTypes = determined ? getStageRecommendations(determined).partnerTypes : [];
    return { label, number, rationale, services, partnerTypes };
  }, [scores, breakdown]);

  /**
   * The dimensions actually behind this score, each with its own maximum.
   *
   * Never hardcode a maximum here: an evidenced score carries its pillar maxima
   * in the breakdown, and a legacy score carries the 40/35/25 it was measured
   * against. Rendering a score against a maximum from another model is exactly
   * how "Developer 10/25" (really land control out of 10) reached the screen.
   */
  const dimensions = useMemo(() => {
    const pillarsRaw = (breakdown as any)?.pillars;
    if (Array.isArray(pillarsRaw) && pillarsRaw.length > 0) {
      const V2_MAX: Record<string, number> = { land: 10, technical: 20, regulatory: 20, grid: 15, financial: 20, construction: 15 };
      return (pillarsRaw as any[]).map((p) => ({
        key: String(p.key),
        label: CATEGORY_CONFIG[p.key]?.label ?? p.label ?? String(p.key).replace(/_/g, ' '),
        score: Math.round(Number(p.earned ?? p.score ?? 0)),
        max: Number(p.max ?? p.weight ?? V2_MAX[p.key] ?? 100),
        details: {} as Record<string, number>,
      }));
    }

    // Legacy AI breakdown: regulatory 40 / financial 35 / developer 25.
    const LEGACY: Record<string, number> = { regulatory: 40, financial: 35, developer: 25 };
    return (['regulatory', 'financial', 'developer'] as const)
      .map((k) => ({
        key: k,
        label: CATEGORY_CONFIG[k]?.label ?? k,
        score: Math.round(Number(breakdown?.[k]?.score ?? (scores as any)?.[`${k}_score`] ?? 0)),
        max: Number(breakdown?.[k]?.max ?? LEGACY[k]),
        details: (breakdown?.[k]?.details ?? {}) as Record<string, number>,
      }))
      .filter((d) => d.score > 0 || d.max > 0);
  }, [breakdown, scores]);

  /**
   * Provenance + stage band recorded when the score was written. Lets the panel
   * say what the number is based on and whether it agrees with the stage.
   */
  const readinessMeta = useMemo(() => {
    const r = (breakdown as any)?.readiness as Record<string, any> | undefined;
    const evidenced = Array.isArray((breakdown as any)?.pillars);
    if (!r && !evidenced) return null;
    const band = (r?.stage_band ?? null) as { min: number; max: number; rationale?: string } | null;
    return {
      evidenced,
      model: typeof r?.model === 'string' ? (r.model as string) : null,
      version: typeof r?.version === 'number' ? (r.version as number) : null,
      band,
      consistent: r ? r.stage_consistent !== false : true,
      note: typeof r?.consistency_note === 'string' ? (r.consistency_note as string) : null,
      reconciled: r?.reconciled === true,
    };
  }, [breakdown]);

  // Parse risk flags — stored as "LEVEL: text" strings
  const riskFlags = useMemo(() => {
    if (!scores?.risk_flags || scores.risk_flags.length === 0) return [];
    return scores.risk_flags.map((flag: string) => {
      const [level, ...rest] = flag.split(':');
      return { level: level.trim(), text: rest.join(':').trim() || flag };
    });
  }, [scores?.risk_flags]);

  // Per-document AI review — stored inside breakdown.document_analysis, in either shape.
  const documentAnalysis = useMemo<DocVerdict[]>(() => {
    if (!breakdown) return [];
    const list = (breakdown as any)?.document_analysis;
    return Array.isArray(list) ? list.map(normaliseDocVerdict) : [];
  }, [breakdown]);

  /**
   * Every uploaded document paired with its AI verdict.
   *
   * The evidence engine keys its verdicts by `doc_id`, so that is the primary
   * join. The legacy path keyed by file name and carries no id, so the label
   * comparison remains as a fallback — but it can only ever succeed for entries
   * that recorded a file name, which is why the id join has to come first.
   */
  const documentsWithVerdicts = useMemo(() => {
    const byDocId = new Map<string, DocVerdict>();
    for (const v of documentAnalysis) if (v.docId) byDocId.set(v.docId, v);

    const docs = project.documents ?? [];
    const pairs = docs.map((doc: any) => {
      const verdict = byDocId.get(doc.id) ?? null;
      return { doc, verdict, label: analysisLabelForDoc(doc) };
    });

    // Fallback: still claim entries with no id by comparing labels.
    const unmatchedEntries = documentAnalysis.filter((v) => !v.docId && v.fileName);
    for (const entry of unmatchedEntries) {
      const nameNorm = normaliseLabel(entry.fileName);
      if (nameNorm.length < 3) continue;
      const hit = pairs.find(
        ({ label, verdict }) => !verdict && normaliseLabel(label) === nameNorm,
      );
      if (hit) hit.verdict = entry;
    }

    // Verdicts whose document is no longer attached still carry findings worth showing.
    const orphanVerdicts = documentAnalysis.filter((v) => {
      if (!v.findings.length && !v.summary) return false;
      return !pairs.some((p) => p.verdict === v);
    });

    return { pairs, orphanVerdicts };
  }, [project.documents, documentAnalysis]);

  /**
   * The AI's extracted facts pooled across every document, so the findings are
   * readable in one place instead of being buried inside per-document cards.
   * Deduplicated case-insensitively while keeping first-seen order.
   */
  const keyFindings = useMemo(() => {
    const seen = new Set<string>();
    const out: { text: string; source: string }[] = [];

    const add = (text: unknown, source: string) => {
      const clean = typeof text === 'string' ? text.trim() : '';
      if (!clean || clean.length < 3) return;
      const key = clean.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ text: clean, source });
    };

    const labelOf = (doc: any) =>
      analysisLabelForDoc(doc) || doc.storage_path?.split('/').pop() || 'Uploaded document';

    for (const { doc, verdict, label } of documentsWithVerdicts.pairs) {
      if (!verdict) continue;
      const src = label || labelOf(doc);
      for (const f of verdict.findings) add(f, src);
    }
    for (const v of documentsWithVerdicts.orphanVerdicts) {
      const src = v.fileName || v.detectedType || 'Unattached document';
      for (const f of v.findings) add(f, src);
    }

    return out;
  }, [documentsWithVerdicts]);

  // Why the AI placed the project at this stage — evidence for / missing / drivers
  const stageJustification = useMemo(() => {
    const j = (breakdown as any)?.stage_justification;
    if (!j || typeof j !== 'object') return null;
    return {
      evidence_for: Array.isArray(j.evidence_for) ? (j.evidence_for as string[]) : [],
      evidence_missing: Array.isArray(j.evidence_missing) ? (j.evidence_missing as string[]) : [],
      key_drivers: Array.isArray(j.key_drivers) ? (j.key_drivers as string[]) : [],
    };
  }, [breakdown]);

  // Per-dimension professional rationale — stored inside breakdown.dimension_analysis
  const dimensionAnalysis = useMemo<any[]>(() => {
    if (!breakdown) return [];
    const list = (breakdown as any)?.dimension_analysis;
    return Array.isArray(list) ? (list as any[]) : [];
  }, [breakdown]);

  /**
   * Why each rating holds — the score ledger plus the model's short prose over it.
   *
   * The ledger and the prose are kept apart on purpose. The ledger is the
   * engine's own record of which milestone won how many points and is always
   * there; the prose may be absent on a run where the explanation call failed.
   * Splitting them means a missing explanation degrades to a bare point
   * breakdown instead of leaving the rating unexplained.
   */
  const ratingInsight = useMemo<RatingInsightBlock | null>(() => {
    const block = (breakdown as any)?.rating_insight;
    if (!block || typeof block !== 'object') return null;

    // `{ key, why }[]` → lookup map, first non-empty entry per key wins.
    const whyByKey = (list: unknown): Record<string, string> => {
      const map: Record<string, string> = {};
      if (!Array.isArray(list)) return map;
      for (const line of list as { key?: unknown; why?: unknown }[]) {
        const key = typeof line?.key === 'string' ? line.key : '';
        const why = typeof line?.why === 'string' ? line.why.trim() : '';
        if (key && why && !(key in map)) map[key] = why;
      }
      return map;
    };

    const ledger: LedgerPillar[] = Array.isArray(block.ledger)
      ? (block.ledger as LedgerPillar[]).filter((p) => p && typeof p.key === 'string')
      : [];

    const insight = block.insight && typeof block.insight === 'object' ? block.insight : null;
    const overall = typeof insight?.overall === 'string' ? insight.overall.trim() : '';
    const stage = typeof insight?.stage === 'string' ? insight.stage.trim() : '';
    // The brief lives on the insight. It is prose the model wrote about the
    // ledger, and it is stored alongside it so the two can never disagree.
    const brief = typeof insight?.brief === 'string' ? insight.brief : '';
    const strList = (v: unknown): string[] => (Array.isArray(v)
      ? v.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      : []);

    if (!ledger.length && !overall && !stage && !brief) return null;

    return {
      brief: splitBrief(brief),
      strengths: strList(insight?.strengths),
      weaknesses: strList(insight?.weaknesses),
      overall,
      stage,
      pillars: whyByKey(insight?.pillars),
      evidence: whyByKey(insight?.evidence),
      ledger,
    };
  }, [breakdown]);

  // Referral link into the developer dashboard's Find Partners tab. When all
  // recommended partner types map to one section (CAPITAL vs TECHNICAL) we
  // auto-scroll there; matching only runs for live projects, so the CTA is
  // gated on the project being live.
  const referralHref = useMemo(() => {
    if (aiStageInfo.partnerTypes.length === 0) return null;
    const types = [...new Set(aiStageInfo.partnerTypes.map((pt) => PARTNER_REFERRAL_TYPE[pt]).filter(Boolean))];
    const typeParam = types.length === 1 ? `&type=${types[0]}` : '';
    return `/developer/find-partners?project=${project.id}${typeParam}`;
  }, [aiStageInfo.partnerTypes, project.id]);

  // An analysis exists if a score row was written — NOT if the score is greater
  // than zero. The engine writes a real 0 when reconciliation withholds the score
  // because no document belongs to the project, and that is a completed analysis
  // that the reviewer must be shown. Keying off `score > 0` reported "No AI
  // Analysis Yet" for a project that had in fact been fully analysed, which is
  // exactly the state this panel was misreporting.
  const hasAnalysis =
    !!scores
    && (scores.capital_readiness_score != null || riskFlags.length > 0);

  if (loading) return <AiInsightSkeleton />;

  if (!hasAnalysis) {
    return (
      <NoAnalysis
        onReanalyze={onReanalyze}
        analyzing={analyzing}
        title={emptyCopy?.title}
        hint={emptyCopy?.hint}
      />
    );
  }

  const totalScore = scores?.capital_readiness_score ?? 0;

  return (
    <div className={cn('space-y-5', className)}>
      {/* ══ The AI's narrative brief — read first ═══════════════════════════ */}
      {(ratingInsight?.brief.length || scores?.summary) && (
        <SectionCard title="Analysis Brief" icon={<Icons.fileText className="size-4" />}>
          {scores?.summary && (
            <p className="text-[13px] font-semibold text-slate-900 leading-relaxed mb-4 pb-4 border-b border-slate-100">
              {scores.summary}
            </p>
          )}
          {ratingInsight?.brief.map((para, i) => (
            <p key={i} className="text-[12px] font-medium text-slate-700 leading-relaxed mb-3 last:mb-0">
              {para}
            </p>
          ))}
        </SectionCard>
      )}

      {/* ══ Strengths and weaknesses — the two-sided read ═════════════════ */}
      {(ratingInsight?.strengths.length || ratingInsight?.weaknesses.length) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {ratingInsight!.strengths.length > 0 && (
            <SectionCard title="Strengths" icon={<Icons.checkCircle2 className="size-4" />}>
              <ul className="space-y-2">
                {ratingInsight!.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[11px] font-medium text-slate-700 leading-relaxed">
                    <Icons.checkCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    {s}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
          {ratingInsight!.weaknesses.length > 0 && (
            <SectionCard title="Weaknesses" icon={<Icons.alertTriangle className="size-4" />}>
              <ul className="space-y-2">
                {ratingInsight!.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[11px] font-medium text-slate-700 leading-relaxed">
                    <Icons.alertTriangle className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
                    {w}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      )}

      {/* ══ Readiness score and its six pillars ════════════════════════════ */}
      <SectionCard title="Readiness Score" icon={<Icons.shieldCheck className="size-4" />}>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Score block */}
          <div className="shrink-0 text-center border border-slate-200 px-6 py-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Score</p>
            <p className={cn('text-4xl font-black leading-none', readinessBandStyle(totalScore).text)}>{totalScore}<span className="text-lg">%</span></p>
            <div className="w-full h-1 bg-slate-100 mt-3 overflow-hidden">
              <div className={cn('h-full transition-all duration-700', readinessBandStyle(totalScore).bar)} style={{ width: `${totalScore}%` }} />
            </div>
          </div>
          {/* Score pillars — label and maximum come from the score itself */}
          <div className={cn(
            'flex-1 grid grid-cols-1 gap-3 w-full',
            dimensions.length > 3 ? 'sm:grid-cols-3 lg:grid-cols-3' : 'sm:grid-cols-3',
          )}>
            {dimensions.map(({ key, label, score, max }) => {
              const why = ratingInsight?.pillars[key];
              return (
              <div key={key} className="border border-slate-100 px-3 py-2.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
                <p className="text-lg font-black text-slate-900">{score}<span className="text-xs text-slate-400 font-bold">/{max}</span></p>
                <div className="h-1 bg-slate-100 mt-2 overflow-hidden">
                  <div className="h-full bg-[#0b3b24] transition-all duration-700" style={{ width: `${max > 0 ? Math.min(100, (score / max) * 100) : 0}%` }} />
                </div>
                {/* One line per rating: what earned the points, what did not. */}
                {why && (
                  <p className="mt-2 text-[10px] font-medium text-slate-500 leading-snug">{why}</p>
                )}
              </div>
              );
            })}
          </div>
        </div>

        {/* Why this score — the model's account of what drives the number */}
        {ratingInsight?.overall && (
          <div className="mt-4 p-3 bg-[#0b3b24]/[0.04] border border-[#0b3b24]/15 flex items-start gap-2.5">
            <Icons.cpu className="size-3.5 text-[#0b3b24] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[9px] font-bold text-[#0b3b24] uppercase tracking-widest mb-1">Why this score</p>
              <p className="text-[11px] font-medium text-slate-700 leading-relaxed">{ratingInsight.overall}</p>
            </div>
          </div>
        )}

        {/* Provenance + stage band — the score must explain how it relates to the stage */}
        {(readinessMeta || scores?.determined_stage) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={cn(
              'px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border',
              readinessMeta?.evidenced
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-amber-50 border-amber-200 text-amber-700',
            )}>
              {readinessMeta?.evidenced ? 'Evidence-scored' : 'Assessed from documents'}
            </span>
            {readinessMeta?.band && (
              <span className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 text-[9px] font-bold uppercase tracking-widest">
                {aiStageInfo.label ?? 'Stage'} band {readinessMeta.band.min}–{readinessMeta.band.max}
              </span>
            )}
          </div>
        )}
        {readinessMeta?.note && (
          <div className={cn(
            'mt-3 p-3 border flex items-start gap-2',
            readinessMeta.consistent ? 'bg-slate-50 border-slate-100' : 'bg-amber-50 border-amber-200',
          )}>
            <Icons.alertTriangle className={cn('size-3.5 shrink-0 mt-0.5', readinessMeta.consistent ? 'text-slate-400' : 'text-amber-600')} />
            <p className="text-[11px] font-medium text-slate-700 leading-relaxed">{readinessMeta.note}</p>
          </div>
        )}
        </SectionCard>

      {/* ══ Detailed findings, extracted fact by fact ═════════════════════ */}
      {keyFindings.length > 0 && (
        <SectionCard title="Detailed Findings" icon={<Icons.search className="size-4" />}>
          <p className="text-[10px] text-slate-500 font-medium mb-3">
            Every fact the AI pulled out of your documents, with the document it came from.
          </p>
          <ul className="space-y-2">
            {keyFindings.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5 border-l-2 border-slate-100 pl-3 py-0.5">
                <Icons.checkCircle2 className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-[11px] text-slate-700 leading-relaxed min-w-0">
                  {f.text}
                  <span className="mt-0.5 block text-[9px] font-bold text-slate-400 uppercase tracking-wider">{f.source}</span>
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* ══ Stage: where it sits and what would move it up ═════════════════ */}
      <SectionCard title="Project Stage" icon={<Icons.layers className="size-4" />}>
        {aiStageInfo.label ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-[#0b3b24] text-white flex items-center justify-center font-black text-sm shrink-0">
                {aiStageInfo.number ?? '—'}
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-900">{aiStageInfo.label}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI-determined · read-only</p>
              </div>
            </div>
            {/* Why this stage and not the next — stated before the engine's provenance line. */}
            {ratingInsight?.stage && (
              <div className="flex items-start gap-2.5 p-3 bg-[#0b3b24]/[0.04] border border-[#0b3b24]/15">
                <Icons.cpu className="size-3.5 text-[#0b3b24] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[9px] font-bold text-[#0b3b24] uppercase tracking-widest mb-1">Why this stage</p>
                  <p className="text-[11px] font-medium text-slate-700 leading-relaxed">{ratingInsight.stage}</p>
                </div>
              </div>
            )}
            {aiStageInfo.rationale && (
              <p className="text-xs text-slate-600 font-medium leading-relaxed bg-slate-50 border border-slate-100 p-3">
                {aiStageInfo.rationale}
              </p>
            )}

            {/* Why this stage? — professional analyst explanation */}
            {stageJustification && (stageJustification.evidence_for.length > 0 || stageJustification.evidence_missing.length > 0 || stageJustification.key_drivers.length > 0) && (
              <div className="space-y-3">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Why this stage?</p>
                {stageJustification.evidence_for.length > 0 && (
                  <div>
                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1.5">Evidence supporting this stage</p>
                    <ul className="space-y-1">
                      {stageJustification.evidence_for.map((e, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[10px] font-medium text-slate-600">
                          <Icons.checkCircle2 className="size-3 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{e}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {stageJustification.evidence_missing.length > 0 && (
                  <div>
                    <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest mb-1.5">Missing — would move it to the next stage</p>
                    <ul className="space-y-1">
                      {stageJustification.evidence_missing.map((e, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[10px] font-medium text-slate-600">
                          <Icons.alertTriangle className="size-3 text-amber-500 shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{e}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {stageJustification.key_drivers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {stageJustification.key_drivers.map((d, i) => (
                      <span key={i} className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 text-[9px] font-bold">
                        {d}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {aiStageInfo.services.length > 0 && (
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Recommended next services</p>
                <div className="flex flex-wrap gap-1.5">
                  {aiStageInfo.services.map((s) => (
                    <span key={s} className="px-2.5 py-1 bg-[#0b3b24]/[0.06] border border-[#0b3b24]/15 text-[#0b3b24] text-[10px] font-bold">
                      {s.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended referral — the profile(s) to engage at this stage, with a path to matching */}
            {aiStageInfo.partnerTypes.length > 0 && (
              <div className="border border-[#0b3b24]/15 bg-[#0b3b24]/[0.03] p-3">
                <p className="text-[9px] font-bold text-[#0b3b24] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Icons.handshake className="size-3" /> Recommended referral — partners to engage at {aiStageInfo.label}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {aiStageInfo.partnerTypes.map((pt) => {
                    const cfg = PARTNER_PROFILE_CONFIG[pt] ?? { label: pt, description: '', icon: <Icons.users className="size-3.5" /> };
                    return (
                      <div key={pt} className="flex items-start gap-2.5 p-2.5 border border-slate-100 bg-white">
                        <span className="size-7 bg-[#0b3b24]/10 text-[#0b3b24] flex items-center justify-center shrink-0">{cfg.icon}</span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-slate-800">{cfg.label}</p>
                          {cfg.description && <p className="text-[10px] text-slate-400 font-medium leading-snug mt-0.5">{cfg.description}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {referralHref && project.status === 'live' ? (
                  <Link href={referralHref} className="mt-3 inline-flex items-center gap-1.5 h-8 px-4 bg-[#0b3b24] text-white text-[10px] font-bold hover:bg-[#0b3b24]/90 transition-colors">
                    <Icons.users className="size-3.5" /> Find matching partners for this project
                  </Link>
                ) : (
                  <p className="mt-3 text-[10px] text-slate-400 font-medium leading-relaxed">
                    Partner matching unlocks once your project goes live — check back shortly after submission.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400 font-medium">Stage not yet determined by AI.</p>
        )}
      </SectionCard>

      {/* ── Score breakdown: what earned each rating ───────────────────── */}
      {(() => {
        const pillars = dimensions
          .filter((d) => CATEGORY_CONFIG[d.key])
          .map((d) => ({ ...d, cfg: CATEGORY_CONFIG[d.key] }));

        // An all-zero score is exactly when the developer most needs to know why,
        // so the section stays when there is a ledger or a reason to show.
        if (pillars.every(p => p.score === 0) && !ratingInsight) return null;

        return (
          <SectionCard title="Why Each Rating" icon={<Icons.barChart className="size-4" />}>
            <div className="space-y-4">
              {pillars.map(({ key, cfg, score, max, details }) => {
                const normalizeDim = (s?: string) => (s ?? '').toLowerCase().replace(/\s+/g, '');
                const dim = dimensionAnalysis.find((d: any) => normalizeDim(d?.dimension) === normalizeDim(key));
                const pct = max > 0 ? Math.min(100, (score / max) * 100) : 0;
                const subCriteria: any[] = dim?.sub_criteria ?? [];

                // Fallback: build sub-criteria from details object if AI didn't return sub_criteria
                const detailEntries = details ? Object.entries(details).filter(([k]) => DIMENSION_LABELS[k]) : [];
                const hasSubCriteria = subCriteria.length > 0 || detailEntries.length > 0;

                // The evidence-engine ledger for this pillar: every milestone and
                // the points it did or didn't win.
                const ledgerPillar = ratingInsight?.ledger.find((p) => p.key === key);
                const pillarWhy = ratingInsight?.pillars[key];

                return (
                  <div key={key} className="border border-slate-200 overflow-hidden">
                    {/* Dimension header */}
                    <div className={`px-5 py-4 bg-gradient-to-r ${cfg.bg} border-b border-slate-100`}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`size-7 bg-white border border-slate-200 flex items-center justify-center shrink-0 ${cfg.color}`}>
                          {cfg.icon}
                        </span>
                        <span className="text-sm font-bold text-slate-800 flex-1">{cfg.label}</span>
                        <span className={`text-lg font-black ${cfg.color}`}>{score}<span className="text-xs text-slate-400 font-bold">/{max}</span></span>
                      </div>
                      <div className="h-2 bg-white/70 border border-slate-100 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-700 ${cfg.color.replace('text-', 'bg-')}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Why this pillar holds this rating */}
                      {pillarWhy && (
                        <div className="flex items-start gap-2.5 p-3 bg-[#0b3b24]/[0.04] border border-[#0b3b24]/15">
                          <Icons.cpu className="size-3.5 text-[#0b3b24] shrink-0 mt-0.5" />
                          <p className="text-[11px] font-medium text-slate-700 leading-relaxed">{pillarWhy}</p>
                        </div>
                      )}

                      {/* Every milestone behind the rating: points won or lost, and why */}
                      {ledgerPillar && ledgerPillar.contributions.length > 0 && (
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                            What produced {score}/{max}
                          </p>
                          <div className="space-y-1.5">
                            {ledgerPillar.contributions.map((c) => {
                              const status = CONTRIBUTION_STATUS[c.status]
                                ?? { label: c.status, cls: 'bg-slate-50 border-slate-200 text-slate-600' };
                              const why = ratingInsight?.evidence[c.key];
                              return (
                                <div key={c.key} className="border border-slate-100 bg-white">
                                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50/80 border-b border-slate-100">
                                    <span className="flex-1 text-[10px] font-bold text-slate-700 truncate">{c.label}</span>
                                    <span className="text-[10px] font-black text-slate-900 tabular-nums">
                                      {c.points > 0 ? '+' : ''}{c.points}
                                      <span className="text-slate-400 font-normal">/{c.maxPoints}</span>
                                    </span>
                                    <span className={`px-1.5 py-0.5 text-[8px] font-bold border shrink-0 ${status.cls}`}>
                                      {status.label}
                                    </span>
                                  </div>
                                  {(why || c.excerpt) && (
                                    <div className="px-2.5 py-2 space-y-1">
                                      {why && (
                                        <p className="text-[10px] font-medium text-slate-600 leading-relaxed">{why}</p>
                                      )}
                                      {c.excerpt && (
                                        <p className="text-[9px] text-slate-400 font-medium leading-relaxed border-l-2 border-slate-200 pl-2 italic">
                                          {c.excerpt}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Overall dimension rationale (legacy LLM path) */}
                      {dim?.rationale && (
                        <div className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-100">
                          <Icons.cpu className="size-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <p className="text-[11px] font-medium text-slate-600 leading-relaxed">{dim.rationale}</p>
                        </div>
                      )}

                      {/* Strengths & Weaknesses */}
                      {(dim?.strengths?.length > 0 || dim?.weaknesses?.length > 0) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {dim?.strengths?.length > 0 && (
                            <div>
                              <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-2">Strengths</p>
                              <div className="space-y-1">
                                {dim.strengths.map((s: string, i: number) => (
                                  <div key={i} className="flex items-start gap-1.5">
                                    <Icons.checkCircle2 className="size-3 text-emerald-500 shrink-0 mt-0.5" />
                                    <span className="text-[10px] font-medium text-slate-600 leading-relaxed">{s}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {dim?.weaknesses?.length > 0 && (
                            <div>
                              <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest mb-2">Weaknesses</p>
                              <div className="space-y-1">
                                {dim.weaknesses.map((w: string, i: number) => (
                                  <div key={i} className="flex items-start gap-1.5">
                                    <Icons.alertTriangle className="size-3 text-red-400 shrink-0 mt-0.5" />
                                    <span className="text-[10px] font-medium text-slate-600 leading-relaxed">{w}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Per-sub-criterion breakdown */}
                      {hasSubCriteria && (
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Sub-criterion breakdown</p>
                          <div className="space-y-2">
                            {(subCriteria.length > 0 ? subCriteria : detailEntries.map(([k, val]) => ({
                              key: k,
                              label: DIMENSION_LABELS[k]?.label ?? k,
                              score: typeof val === 'number' ? val : 0,
                              max: null,
                              verdict: null,
                              reason: null,
                            }))).map((sub: any, si: number) => {
                              const verdict = sub.verdict ?? (sub.score === 0 ? 'MISSING' : sub.max && (sub.score / sub.max) >= 0.8 ? 'STRONG' : sub.max && (sub.score / sub.max) >= 0.4 ? 'PARTIAL' : 'WEAK');
                              const verdictStyle = {
                                STRONG:  'bg-emerald-50 border-emerald-200 text-emerald-700',
                                PARTIAL: 'bg-amber-50 border-amber-200 text-amber-700',
                                WEAK:    'bg-orange-50 border-orange-200 text-orange-700',
                                MISSING: 'bg-red-50 border-red-200 text-red-600',
                              }[verdict as string] ?? 'bg-slate-50 border-slate-200 text-slate-600';
                              const dimIcon = DIMENSION_LABELS[sub.key]?.icon;
                              return (
                                <div key={si} className="border border-slate-100 bg-white overflow-hidden">
                                  <div className="flex items-center gap-2.5 px-3 py-2 bg-slate-50/80 border-b border-slate-100">
                                    {dimIcon && <span className="text-slate-400 shrink-0">{dimIcon}</span>}
                                    <span className="flex-1 text-[10px] font-bold text-slate-700">{sub.label ?? DIMENSION_LABELS[sub.key]?.label ?? sub.key}</span>
                                    <span className="text-[10px] font-black text-slate-900">
                                      {sub.score}{sub.max != null ? <span className="text-slate-400 font-normal">/{sub.max}</span> : ''}
                                    </span>
                                    <span className={`px-1.5 py-0.5 text-[8px] font-bold border ${verdictStyle}`}>{verdict}</span>
                                  </div>
                                  {sub.reason && (
                                    <p className="px-3 py-2 text-[10px] font-medium text-slate-500 leading-relaxed">{sub.reason}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        );
      })()}

      {/* ── Risks ─────────────────────────────────────────────────────── */}
      <SectionCard title="Risk Assessment" icon={<Icons.alertTriangle className="size-4" />}>
        {riskFlags.length > 0 ? (
          <div className="space-y-2">
            {riskFlags.map((flag, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-100">
                <div className={cn(
                  'size-7 flex items-center justify-center shrink-0',
                  flag.level === 'HIGH' ? 'bg-red-100 text-red-600' :
                  flag.level === 'MEDIUM' ? 'bg-amber-100 text-amber-600' :
                  'bg-slate-100 text-slate-500',
                )}>
                  <Icons.alert className="size-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <RiskBadge level={flag.level} />
                  </div>
                  <p className="text-xs font-medium text-slate-600">{flag.text}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center border border-dashed border-slate-200">
            <div className="size-10 bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-2">
              <Icons.checkCircle2 className="size-5 text-emerald-500" />
            </div>
            <p className="text-xs font-bold text-emerald-700">No risk signals detected</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Documents were analyzed and no material risks were flagged.</p>
          </div>
        )}
      </SectionCard>

      {/* ── Recommendations ───────────────────────────────────────────── */}
      {scores?.recommendations && scores.recommendations.length > 0 && (
        <SectionCard title="Recommendations" icon={<Icons.lightbulb className="size-4" />}>
          <ul className="space-y-2">
            {scores.recommendations.map((rec: string, i: number) => (
              <li key={i} className="flex items-start gap-2.5 text-[11px] font-medium text-slate-700 leading-relaxed">
                <span className="size-4 bg-[#0b3b24] text-white flex items-center justify-center text-[8px] font-black shrink-0 mt-0.5">{i + 1}</span>
                {rec}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* ── Document Checker ──────────────────────────────────────────── */}
      <SectionCard title="Document Checker" icon={<Icons.fileText className="size-4" />}>
        {project.documents && project.documents.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{project.documents.length} document{project.documents.length !== 1 ? 's' : ''} uploaded</span>
              <span className="text-[10px] font-bold text-[#0b3b24] flex items-center gap-1">
                <Icons.checkCircle2 className="size-3" /> Submitted
              </span>
            </div>
            <div className="space-y-2">
              {documentsWithVerdicts.pairs.map(({ doc, verdict, label }) => {
                const analysis = verdict;
                return (
                  <div key={doc.id} className="border border-slate-100 overflow-hidden">
                    <div className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 border-b border-slate-100">
                      <Icons.fileText className="size-3.5 text-primary shrink-0" />
                      <span className="flex-1 text-[11px] font-semibold text-slate-700 truncate">{label}</span>
                      {analysis?.relevance ? <RelevanceBadge relevance={analysis.relevance} /> : null}
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                        {doc.classification ?? 'RESTRICTED'}
                      </span>
                    </div>
                    {analysis ? (
                      <div className="px-3 py-2.5 space-y-2 bg-white">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-800">
                            {analysis.detectedType || 'Content not identified'}
                          </span>
                          {/* Project-match verdict — the document↔project identity check */}
                          {(() => {
                            const st = analysis.matchStatus;
                            if (st === 'match') {
                              return (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold">
                                  ✓ Matches this project
                                </span>
                              );
                            }
                            if (st === 'mismatch') {
                              return (
                                <span className="px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-600 text-[9px] font-bold">
                                  ✗ Not this project — excluded from scoring
                                </span>
                              );
                            }
                            if (st === 'unreviewed') {
                              return (
                                <span className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-500 text-[9px] font-bold">
                                  Not reviewed
                                </span>
                              );
                            }
                            return (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-bold">
                                ? Cannot verify identity — not scored
                              </span>
                            );
                          })()}
</div>
                        {/* What the document itself names — so the developer can see WHY it matched or not */}
                        {analysis.matchStatus !== 'match' && analysis.matchReason && (
                          <p className="text-[10px] text-amber-700 bg-amber-50/60 border border-amber-100 px-2.5 py-2 leading-relaxed">
                            {analysis.matchReason}
                          </p>
                        )}
                        {analysis.identity && (analysis.identity.project_name || analysis.identity.capacity_mw != null || analysis.identity.location || (analysis.identity.parties?.length ?? 0) > 0) && (
                          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                            Document names:{' '}
                            {[
                              analysis.identity.project_name,
                              analysis.identity.capacity_mw != null ? `${analysis.identity.capacity_mw} MW` : null,
                              analysis.identity.location,
                              ...(analysis.identity.parties ?? []),
                            ].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {analysis.authenticity && (
                          <p className="text-[10px] font-semibold text-slate-600">
                            Document integrity: {analysis.authenticity.replace(/_/g, ' ')}
                          </p>
                        )}
                        {analysis.summary && (
                          <p className="text-[10px] font-medium text-slate-500 leading-relaxed">{analysis.summary}</p>
                        )}
                        {analysis.findings.length > 0 && (
                          <ul className="space-y-1">
                            {analysis.findings.map((fact, fi) => (
                              <li key={fi} className="flex items-start gap-1.5 text-[10px] text-slate-600">
                                <Icons.checkCircle2 className="size-3 text-emerald-500 shrink-0 mt-0.5" />
                                <span className="leading-relaxed">{fact}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {analysis.concerns && (
                          <p className="flex items-start gap-1.5 text-[10px] font-semibold text-red-600 bg-red-50/60 border border-red-100 rounded-none px-2.5 py-2 leading-relaxed">
                            <Icons.alertTriangle className="size-3 shrink-0 mt-0.5" />
                            {analysis.concerns}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="px-3 py-2 text-[10px] text-slate-400 font-medium">Not yet reviewed by AI.</p>
                    )}
                  </div>
                );
              })}
            </div>
            {documentsWithVerdicts.orphanVerdicts.length > 0 && (
              <p className="text-[10px] text-slate-400 font-medium">
                {documentsWithVerdicts.orphanVerdicts.length} analyzed document
                {documentsWithVerdicts.orphanVerdicts.length !== 1 ? 's are' : ' is'} no longer attached
                to this project, but {documentsWithVerdicts.orphanVerdicts.length !== 1 ? 'their' : 'its'} findings
                {documentsWithVerdicts.orphanVerdicts.length !== 1 ? ' are' : ' is'} included above.
              </p>
            )}
          </div>
        ) : (
          <div className="p-6 text-center border border-dashed border-slate-200">
            <Icons.folder className="size-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">No documents uploaded</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Upload project documents to enable AI analysis.</p>
          </div>
        )}
      </SectionCard>

      {/* Re-analyze button */}
      {onReanalyze && (
        <div className="flex justify-center pt-2">
          <button
            onClick={onReanalyze}
            disabled={analyzing}
            className="h-9 px-5 border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {analyzing ? <Icons.spinner className="size-3.5 animate-spin" /> : <Icons.refreshCw className="size-3.5" />}
            Re-run Analysis
          </button>
        </div>
      )}
    </div>
  );
}

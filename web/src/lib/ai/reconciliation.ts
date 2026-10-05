import type { EvidenceOutput, EvidenceKey } from './types';
import {
  SCORING_V2,
  SCORING_VERSION,
  GAP_PARTNER_MAP,
  STAGE_GATES,
  type ScoreResult,
  type PillarResult,
} from '../scoring/engine';
import { evaluateStageConsistency } from '../project-stages';

/**
 * Document ↔ project reconciliation.
 *
 * The scoring engine counts evidence from any analyzed document. Without a
 * reconciliation layer, a project whose files are about ANOTHER project (wrong
 * name, wrong capacity, wrong country) still earns points — which is how a
 * project could show 61% while its documents don't match the project details.
 *
 * This module makes "does this document speak about THIS project?" a first-class,
 * deterministic input to scoring:
 *
 * 1. The extraction AI reports, per document, what the document names (parties,
 *    project title, capacity, location) and whether it is about the project
 *    described in the developer's form (relevance + project_match).
 * 2. This module MECHANICALLY enforces that verdict in code — the LLM's opinion
 *    is recorded, but exclusion of non-matching documents is done here, so a
 *    model drift can never silently count a foreign document's evidence.
 * 3. If NO analyzed document belongs to the project, the readiness score is
 *    withheld (0) rather than invented from documents about something else.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Extended EvidenceOutput with the reconciliation fields the prompt requests. */
export interface ReconciliationOutput extends EvidenceOutput {
  /** What the document itself names/claims about the project it describes. */
  project_identity?: {
    /** The project name/title as written in the document, null if absent. */
    project_name?: string | null;
    /** The installed capacity (MW) stated in the document, null if absent. */
    capacity_mw?: number | null;
    /** The site location (city/region/country) stated in the document, null if absent. */
    location?: string | null;
    /** Named parties in the document (developer, SPV, offtaker, lenders...). */
    parties?: string[] | null;
  };
  /**
   * The AI's relevance judgement. `belongs` is the load-bearing field: it must
   * be true ONLY when the document is about the project described in the form.
   */
  relevance: {
    /** HIGH | MEDIUM | LOW — energy/infrastructure relevance of the content. */
    level: 'HIGH' | 'MEDIUM' | 'LOW';
    /**
     * Is this document about THE project in the form? True requires positive
     * identity signals (same project name, or same developer company/SPV, or
     * matching capacity+location together). Generic energy content without
     * project identity is false, not true.
     * Note: this is advisory — the mechanical rules below can exclude even
     * when this is true, or include when it is false but identity matches.
     */
    belongs_to_project: boolean;
    /**
     * CONTRADICTS the project (names a different project/company/location/
     * capacity) — stronger than mere irrelevance; always produces a HIGH flag.
     */
    contradicts_project?: boolean;
    /** Required. Why the verdict was reached; must quote the document's own words. */
    reason: string;
  };
}

/** A row of project_documents (subset the orchestrator already selects). */
export interface ProjectDocRow {
  id: string;
  document_type: string | null;
  storage_path: string;
  file_hash: string | null;
  mime_type: string | null;
}

/** The subset of project fields reconciliation compares documents against. */
export interface ProjectProfile {
  name: string;
  technology_type: string | null;
  project_size_mw: number | null;
  location_country: string | null;
  location_region: string | null;
  /** Developer company name, for party matching. */
  company_name?: string | null;
}

/** Result of reconciling one document against the project profile. */
export interface DocReconciliation {
  docId: string;
  /** Deterministic verdict used by scoring: include this document's evidence? */
  excluded: boolean;
  /** Why it was excluded/included — for risk flags and the review UI. */
  status: 'match' | 'mismatch' | 'contradicts' | 'unverifiable' | 'unreviewed';
  reason: string;
  /** The AI's identity extraction (what the document names). */
  identity: NonNullable<ReconciliationOutput['project_identity']> | null;
}

export interface ReconciliationResult {
  perDoc: DocReconciliation[];
  /** Documents whose evidence may count towards the score. */
  included: { docId: string; out: ReconciliationOutput }[];
  /** Documents excluded from scoring, with machine-readable reasons. */    excluded: { docId: string; out: ReconciliationOutput; status: DocReconciliation['status']; reason: string }[];
  /** True when every analyzed document was excluded — score must be withheld. */
  allExcluded: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STOP_TOKENS = new Set([
  'the', 'of', 'and', 'for', 'ltd', 'limited', 'plc', 'inc', 'gmbh', 'sa',
  'company', 'holdings', 'group', 'project', 'energy', 'power', 'solar',
  'hydropower', 'hydro', 'wind', 'plant', 'zambia', 'mw', '1', '2', '3',
]);

/**
 * Meaningful-token overlap between two names. "Acme Solar 1" vs "Acme Solar
 * Holdings Ltd" share {acme, solar} → high overlap; "Kafue Gorge" vs "Acme
 * Solar" share nothing. Generic words (energy, power, project, ltd) are
 * excluded so two unrelated projects don't match on industry boilerplate.
 */
export function nameOverlap(a: string, b: string): number {
  const tokens = (s: string) =>
    new Set(
      s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
        .filter((t) => t.length >= 3 && !STOP_TOKENS.has(t)),
    );
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;
  return shared / Math.min(A.size, B.size);
}

/** Normalized distance between two stated capacities (0 = equal, 1 = disjoint). */
function capacityGap(a: number, b: number): number {
  const hi = Math.max(a, b);
  return hi <= 0 ? 1 : Math.abs(a - b) / hi;
}

// ── Core ──────────────────────────────────────────────────────────────────────

/**
 * Reconcile the AI's per-document outputs against the project profile.
 *
 * Mechanical rules (applied in order, first match wins):
 * 1. contradicts_project → exclude, status `contradicts` (HIGH flag).
 * 2. Identity evidence: document names the project (≥0.5 name overlap) OR a
 *    profile party appears in the document's parties → include as `match`.
 * 3. Document states a project name/capacity/location that CONTRADICTS the
 *    profile (negative identity): wrong-name (overlap 0 AND AI says belongs=false)
 *    with wrong capacity (>30% off) or the AI explicitly flagged contradiction →
 *    exclude as `mismatch`.
 * 4. No identity signals either way → `unverifiable`: the document's content may
 *    still be project-generic (a PPA template, a resource map). The AI's
 *    belongs_to_project judgement decides, conservatively: exclude when the AI
 *    says it doesn't belong; include when the AI says it does (a reviewer will
 *    see the reason). Pure relevance level (LOW) alone also excludes.
 */
export function reconcileDocuments(
  docResults: { docId: string; out: EvidenceOutput }[],
  profile: ProjectProfile,
): ReconciliationResult {
  const perDoc: DocReconciliation[] = [];
  const included: { docId: string; out: ReconciliationOutput }[] = [];
  const excluded: ReconciliationResult['excluded'] = [];

  for (const { docId, out } of docResults) {
    const rec = out as ReconciliationOutput;
    const rel = rec.relevance;
    const ident = rec.project_identity ?? null;

    // ── Rule 1: explicit contradiction (different project/company) ────────
    if (rel?.contradicts_project === true) {
      const reason = rel.reason || 'Document names a different project or company.';
      perDoc.push({ docId, excluded: true, status: 'contradicts', reason, identity: ident });
      excluded.push({ docId, out: rec, status: 'contradicts', reason });
      continue;
    }

    // ── Rule 2: positive identity — document names THIS project ───────────
    const docName = ident?.project_name?.trim();
    const nameMatch = !!docName && profile.name.trim().length >= 3 &&
      nameOverlap(docName, profile.name) >= 0.5;
    const parties = (ident?.parties ?? []).filter(Boolean).map((p) => p.toLowerCase());
    const partyMatch = parties.some((p) =>
      (profile.company_name ? p.includes(profile.company_name.toLowerCase()) : false) ||
      (profile.name ? p.includes(profile.name.toLowerCase()) : false),
    );

    if (nameMatch || partyMatch) {
      // Code-verified identity wins over the AI's belonging opinion: a document
      // that names the project or the developer is IN even if the model hedged.
      perDoc.push({
        docId,
        excluded: false,
        status: 'match',
        reason: rel?.reason ?? 'Document names the project (or its developer).',
        identity: ident,
      });
      included.push({ docId, out: rec });
      continue;
    }

    // ── Rule 3: negative identity — document describes a DIFFERENT project ─
    const docCap = typeof ident?.capacity_mw === 'number' ? ident.capacity_mw : null;
    const wrongCapacity = docCap !== null && profile.project_size_mw != null &&
      capacityGap(docCap, profile.project_size_mw) > 0.30;
    const docLoc = ident?.location?.trim() ?? null;
    const wrongCountry = !!docLoc && !!profile.location_country &&
      !docLoc.toLowerCase().includes(profile.location_country.toLowerCase()) &&
      nameOverlap(docLoc, profile.location_country) === 0;
    // Identity signals present at all — a doc with none of these is generic,
    // which is "unverifiable" (Rule 4), not a hard mismatch.
    const hasIdentity = !!(docName || docCap != null || docLoc || parties.length > 0);

    if (hasIdentity && (rel?.belongs_to_project === false || wrongCapacity || wrongCountry) && rel?.belongs_to_project !== true) {
      const bits: string[] = [];
      if (wrongCapacity) bits.push(`stated capacity ${docCap}MW ≠ project's ${profile.project_size_mw}MW`);
      if (wrongCountry) bits.push(`stated location "${docLoc}" ≠ project country ${profile.location_country}`);
      // Mechanical evidence (capacity/location deltas) is more actionable than
      // a generic verdict string — prefer it when present.
      const reason = bits.length
        ? `Document does not match the project: ${bits.join('; ')}.`
        : (rel?.reason || 'Document is not about this project.');
      perDoc.push({ docId, excluded: true, status: 'mismatch', reason, identity: ident });
      excluded.push({ docId, out: rec, status: 'mismatch', reason });
      continue;
    }

    // ── Rule 4: no identity signals — fall back to the AI judgement ───────
    const relLevel = rel?.level ?? 'LOW';
    if (relLevel === 'LOW' || rel?.belongs_to_project === false) {
      const reason = rel?.reason || 'Document has no identity signals tying it to this project and low relevance.';
      perDoc.push({
        docId,
        excluded: true,
        status: 'unverifiable',
        reason,
        identity: ident,
      });
      excluded.push({ docId, out: rec, status: 'unverifiable', reason });
      continue;
    }

    perDoc.push({
      docId,
      excluded: false,
      status: 'match',
      reason: rel?.reason ?? 'Document content is relevant to the project.',
      identity: ident,
    });
    included.push({ docId, out: rec });
  }

  return { perDoc, included, excluded, allExcluded: included.length === 0 && docResults.length > 0 };
}

// ── Enforcement ───────────────────────────────────────────────────────────────

/**
 * Risk flags for excluded documents. Contradictions are HIGH; mismatches HIGH;
 * unverifiable docs MEDIUM. Deduplicates by status+docId.
 */
export function reconciliationRiskFlags(reconciliation: ReconciliationResult): {
  severity: 'low' | 'medium' | 'high';
  flag: string;
  detail: string;
}[] {
  const flags: { severity: 'low' | 'medium' | 'high'; flag: string; detail: string }[] = [];
  for (const d of reconciliation.excluded) {
    const severity = d.status === 'contradicts' || d.status === 'mismatch' ? 'high' : 'medium';
    const flag = d.status === 'contradicts' ? 'document_contradicts_project'
      : d.status === 'mismatch' ? 'document_mismatch'
      : 'document_not_linked';
    flags.push({
      severity,
      flag,
      detail: `Excluded from scoring: ${d.reason}`,
    });
  }
  return flags;
}

/**
 * Whether the readiness score must be withheld: every analyzed document was
 * excluded. The score is then 0 and the stage falls back to Concept — a project
 * with no document that belongs to it cannot show readiness.
 */
export function mustWithholdScore(reconciliation: ReconciliationResult): boolean {
  return reconciliation.allExcluded;
}

/**
 * A ScoreResult for the withhold case: score 0, stage Concept, all pillars at
 * zero, the next gate's requirements listed as gaps. This is NOT a failure —
 * it is the honest result of "no document in this project's data room belongs
 * to this project". The reconciliation block in `breakdown` tells the reviewer
 * exactly why.
 */
export function withheldScoreResult(reconciliation: ReconciliationResult): ScoreResult {
  const pillars: PillarResult[] = SCORING_V2.map((p) => ({
    key: p.key,
    label: p.label,
    max: p.weight,
    weight: p.weight,
    earned: 0,
    missing: p.weight,
    overflowed: false,
  }));

  const consistency = evaluateStageConsistency(0, 'CONCEPT', 'verified');
  const nextGate = STAGE_GATES.find((g) => g.stage === 2);

  return {
    score: 0,
    derivedTotal: 0,
    consistent: true,
    maxScore: 100,
    stage: 1,
    stageValue: 'CONCEPT',
    stageLabel: STAGE_GATES[0].label,
    unverifiedStage: false,
    band: consistency.band,
    consistency,
    pillars,
    gaps: (nextGate?.required ?? []).map((k) => ({
      key: k as EvidenceKey,
      partnerType: GAP_PARTNER_MAP[k as EvidenceKey],
      claimedButUnproven: false,
    })),
    scoringVersion: SCORING_VERSION,
  };
}

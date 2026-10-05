/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * analysis-guard.ts — Cache invalidation AND anti-abuse gate for AI project analysis.
 *
 * PROBLEM (pre-fix):
 *   1. The analysis cache was keyed ONLY on the document set. A developer editing
 *      score-relevant form fields (approvals, PPA/grid status, land) without changing
 *      a file got the STALE cached score forever.
 *   2. A blanket 24-hour re-analysis cap blocked genuine updates, yet still allowed a
 *      determined user to re-run analysis by repeatedly changing unrelated fields.
 *
 * DESIGN:
 *   - A SIGNAL HASH covers BOTH the document set AND the score-relevant form fields.
 *     Any real change invalidates the cache; an exact revert to a previously-analysed
 *     state resolves to the exact-hash cache at ZERO AI cost.
 *   - A MIN-INTERVAL COOLDOWN throttles genuine (non-cached) runs per project so a
 *     user cannot burn the AI budget by editing in a loop. Combined with the exact-
 *     revert cache this defeats the "toggle a field constantly" exploit.
 *
 * This module is pure and dependency-free so it is trivially unit-testable.
 */
import { createHash } from 'node:crypto';

/** Score-relevant subset of the project that must invalidate an analysis when it changes. */
export interface AnalysisFormSignal {
  technology_type?: string;
  location_country?: string;
  location_region?: string;
  project_size_mw?: number | null;
  capital_required?: number | null;
  capital_structure_type?: string;
  funding_required?: number | null;
  description?: string | null;
  has_secured_land?: boolean | null;
  land_title_status?: string;
  has_reached_financial_close?: boolean | null;
  regulatory_approvals?: string[];
  governance_terms?: string;
  risk_disclosures?: string;
  tech_requirements?: {
    grid_status?: string;
    ppa_status?: string;
    required_services?: string[];
  } | null;
}

/** Deterministic JSON — stable key order, undefined dropped, no whitespace variance. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
  return `{${entries.join(',')}}`;
}

/**
 * Extract only the score-relevant fields from a raw project row + tech requirements.
 * Fields with no bearing on the evidence/readiness score are excluded so innocent
 * edits (name, description wording, dates) do not force a costly re-analysis.
 */
export function analysisFormSignal(
  project: Record<string, any>,
  techReq: Record<string, any> | null | undefined,
): AnalysisFormSignal {
  const approvals = Array.isArray(project.regulatory_approvals)
    ? [...project.regulatory_approvals].sort()
    : project.regulatory_approvals;
  const requiredServices = Array.isArray(techReq?.required_services)
    ? [...techReq.required_services].sort()
    : techReq?.required_services;
  return {
    technology_type: project.technology_type,
    location_country: project.location_country,
    location_region: project.location_region,
    project_size_mw: project.project_size_mw == null ? null : Number(project.project_size_mw),
    capital_required: project.capital_required == null ? null : Number(project.capital_required),
    capital_structure_type: project.capital_structure_type,
    funding_required: project.funding_required == null ? null : Number(project.funding_required),
    has_secured_land: project.has_secured_land ?? null,
    land_title_status: project.land_title_status,
    has_reached_financial_close: project.has_reached_financial_close ?? null,
    regulatory_approvals: approvals,
    governance_terms: project.governance_terms,
    risk_disclosures: project.risk_disclosures,
    description: project.description,
    tech_requirements: techReq
      ? { grid_status: techReq.grid_status, ppa_status: techReq.ppa_status, required_services: requiredServices }
      : null,
  };
}

/**
 * sha256 over the sorted document hashes joined with the canonical form signal.
 * A change to either input changes the hash. Exact same content => exact same hash.
 */
export function computeAnalysisSignalHash(docHashes: string[], formSignal: unknown): string {
  const docs = [...(docHashes ?? [])].filter(Boolean).sort();
  const payload = `${docs.join(',')}|${canonicalJson(formSignal ?? null)}`;
  return createHash('sha256').update(payload).digest('hex');
}

export type AnalysisDecision = 'cached' | 'proceed' | 'throttled';

export interface AnalysisGuardOptions {
  docHashes: string[];
  formSignal: unknown;
  /** analysis_signal_hash of the last stored analysis (null if never analysed). */
  storedHash?: string | null;
  /** projects.last_actual_analysis_at - when the last real (non-cached) run happened. */
  lastAnalysisAt?: string | null;
  /** Minimum spacing between genuine (non-cached) runs for the same project. */
  minIntervalMs: number;
  now?: number;
}

export interface AnalysisGuardResult {
  decision: AnalysisDecision;
  /** The current signal hash (persist it when a run completes). */
  hash: string;
  /** True when content (docs or scored form fields) differs from the last stored analysis. */
  contentChanged: boolean;
  /** ms until a fresh run is allowed - non-null only when decision === "throttled". */
  retryAfterMs: number | null;
}

/**
 * Decide whether to (a) serve the cached score, (b) run a fresh analysis, or (c) refuse
 * a fresh run because one happened too recently (anti-abuse).
 *
 *   - Content identical to the last stored analysis => cached (0 AI cost).
 *   - Content changed AND enough time since last real run => proceed.
 *   - Content changed BUT within the cooldown window     => throttled (no AI burn).
 */
export function evaluateAnalysisGuard(opts: AnalysisGuardOptions): AnalysisGuardResult {
  const now = opts.now ?? Date.now();
  const hash = computeAnalysisSignalHash(opts.docHashes, opts.formSignal);

  const needsRun = !opts.storedHash || opts.storedHash !== hash;
  const contentChanged = Boolean(opts.storedHash) && opts.storedHash !== hash;

  if (!needsRun) {
    return { decision: 'cached', hash, contentChanged: false, retryAfterMs: null };
  }

  if (opts.lastAnalysisAt) {
    const t = new Date(opts.lastAnalysisAt).getTime();
    if (Number.isFinite(t)) {
      const elapsed = now - t;
      if (elapsed > 0 && elapsed < opts.minIntervalMs) {
        return { decision: 'throttled', hash, contentChanged: true, retryAfterMs: opts.minIntervalMs - elapsed };
      }
    }
  }

  return { decision: 'proceed', hash, contentChanged, retryAfterMs: null };
}

/**
 * Configurable cooldown between genuine (non-cached) analyses of the same project.
 * Default 15 minutes. Override with AI_ANALYSIS_MIN_INTERVAL_MS.
 */
export function analysisMinIntervalMs(): number {
  if (typeof process === 'undefined') return 15 * 60_000;
  const raw = process.env.AI_ANALYSIS_MIN_INTERVAL_MS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 15 * 60_000;
}

/** Shape a stored score row into a plain cached response payload. */
export function cachedPayload(row: Record<string, any>) {
  return {
    success: true,
    data: row,
    cached: true,
    message: 'No change in documents or score-relevant information since the last analysis. Showing the stored scores.',
  };
}

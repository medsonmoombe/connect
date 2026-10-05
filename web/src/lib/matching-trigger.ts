/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * matching-trigger.ts — THE single place that fires the matching engine, plus the
 * run log that makes those runs observable.
 *
 * Before this module the recompute trigger was copy-pasted into ~6 routes
 * (analyze, admin/authority org verification, project decision, activation, admin
 * manual). Centralising it means the trigger policy (PRD 5.2) can be audited and
 * tested in one place.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type MatchingPartnerType = 'capital_partners' | 'technical_partners' | 'consultants' | 'power_traders' | 'grant_providers';

export interface MatchingTriggerParams {
  projectId?: string;
  runAll?: boolean;
  partnerId?: string;
  /** Partner table name, e.g. 'capital_partners', 'technical_partners', 'consultants', 'power_traders', 'grant_providers'. */
  partnerType?: string;
}

export interface MatchingRunLogEntry {
  scope: 'project' | 'partner' | 'all';
  status: 'started' | 'success' | 'error';
  projectId?: string | null;
  scopeRef?: string | null;
  triggeredBy?: string | null;
  error?: string | null;
  matchedProjects?: number;
  capitalMatches?: number;
  technicalMatches?: number;
  consultantMatches?: number;
  traderMatches?: number;
}

/** Resolve the internal base URL (works on Vercel and locally). */
function appBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

/**
 * Fire-and-forget matching recomputation. Never throws and never blocks the
 * caller. Uses the service-role key so internal callers are trusted.
 */
export async function triggerMatchingRuns(params: MatchingTriggerParams): Promise<void> {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const body = params.projectId
      ? { project_id: params.projectId }
      : params.partnerId && params.partnerType
        ? { run_for_partner: true, partner_id: params.partnerId, partner_type: params.partnerType }
        : { run_all: true };

    await fetch(`${appBaseUrl()}/api/matching/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(serviceKey ? { Authorization: `Bearer ${serviceKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Matching is a background best-effort concern — never fail the caller over it.
  }
}

/** Persist a matching-run outcome for observability. Best-effort, never throws. */
export async function recordMatchingRun(sb: SupabaseClient | any, entry: MatchingRunLogEntry): Promise<void> {
  try {
    await sb.from('matching_run_log').insert({
      scope: entry.scope,
      status: entry.status,
      project_id: entry.projectId ?? null,
      scope_ref: entry.scopeRef ?? null,
      triggered_by: entry.triggeredBy ?? null,
      error: entry.error ?? null,
      matched_projects: entry.matchedProjects ?? 0,
      capital_matches: entry.capitalMatches ?? 0,
      technical_matches: entry.technicalMatches ?? 0,
      consultant_matches: entry.consultantMatches ?? 0,
      trader_matches: entry.traderMatches ?? 0,
    });
  } catch {
    // best-effort
  }
}

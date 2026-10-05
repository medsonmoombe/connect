import type { EvidenceKey, EvidenceOutput } from '../ai/types';
import {
  GATED_KEYS,
  SELF_REPORT_DISCOUNT,
  type EvidenceEntry,
  type ResolvedEvidence,
} from './engine';

/** Canonical aliases: site_lease is treated as land_secured evidence. */
const ALIASES: Partial<Record<EvidenceKey, EvidenceKey>> = {
  site_lease: 'land_secured',
};

/**
 * Merge per-document AI evidence + self-reported form claims into a single
 * ResolvedEvidence map.
 *
 * Rules:
 * - Documents win over self-reported claims.
 * - Gated keys (land, approvals, financial close, etc.) are ignored when
 *   source is self_reported — they must come from a document.
 * - When two documents disagree on the same key and neither is clearly
 *   stronger (confidence delta < 0.15), the entry is marked contested and
 *   excluded from scoring.
 * - Best-confidence document entry wins otherwise.
 */
export function mergeEvidence(
  docResults: { docId: string; out: EvidenceOutput }[],
  formClaims: { key: EvidenceKey; value: boolean }[],
): ResolvedEvidence {
  const resolved: ResolvedEvidence = {};

  const consider = (rawKey: EvidenceKey, entry: EvidenceEntry) => {
    const key = ALIASES[rawKey] ?? rawKey;

    // Gated keys must come from documents
    if (GATED_KEYS.includes(key) && entry.source === 'self_reported') return;

    const existing = resolved[key];
    if (!existing) {
      resolved[key] = { ...entry, key };
      return;
    }

    // Both documents disagree and neither is clearly stronger → contested
    if (
      entry.satisfied !== existing.satisfied &&
      Math.abs(entry.confidence - existing.confidence) < 0.15
    ) {
      resolved[key] = { ...existing, satisfied: false, contested: true };
      return;
    }

    // Both agree it's satisfied — keep the higher-confidence one
    if (existing.satisfied && entry.satisfied) {
      if (entry.confidence > existing.confidence) resolved[key] = { ...entry, key };
      return;
    }

    // New entry is satisfied and more confident than the existing negative
    if (!existing.satisfied && entry.satisfied && entry.confidence > existing.confidence) {
      resolved[key] = { ...entry, key };
    }
  };

  // Document evidence first (higher trust)
  for (const { docId, out } of docResults) {
    for (const ev of out.evidence) {
      if (typeof ev.value !== 'boolean') continue;
      consider(ev.key, {
        key: ALIASES[ev.key] ?? ev.key,
        satisfied: ev.value === true,
        confidence: ev.confidence,
        source: 'document',
        documentId: docId,
        excerpt: ev.excerpt,
      });
    }
  }

  // Self-reported claims (lower trust, discounted confidence)
  for (const claim of formClaims) {
    consider(claim.key, {
      key: ALIASES[claim.key] ?? claim.key,
      satisfied: claim.value,
      confidence: SELF_REPORT_DISCOUNT,
      source: 'self_reported',
    });
  }

  return resolved;
}

/**
 * Map the project's form fields to evidence key/value pairs.
 * Wire these to your actual DB column names.
 */
export function formClaimsFromProject(
  p: Record<string, unknown>,
): { key: EvidenceKey; value: boolean }[] {
  const approvals = (p.regulatory_approvals as string[] | null) ?? [];
  return [
    { key: 'land_secured',                value: p.has_secured_land === true },
    { key: 'financial_close',             value: p.has_reached_financial_close === true },
    { key: 'eia_completed',               value: approvals.includes('ZEMA') || approvals.includes('ZEMA_EIA') },
    { key: 'generation_licence',          value: approvals.includes('ERB') || approvals.includes('ERB_GENERATION_LICENCE') },
    { key: 'grid_application_submitted',  value: (p as any).tech_requirements?.grid_status === 'PENDING' },
    { key: 'grid_connection_agreement',   value: (p as any).tech_requirements?.grid_status === 'CONNECTED' },
    { key: 'ppa_signed',                  value: (p as any).tech_requirements?.ppa_status === 'SECURED' },
    { key: 'ppa_under_negotiation',       value: (p as any).tech_requirements?.ppa_status === 'IN_PROGRESS' },
    { key: 'permits_general',             value: approvals.some((a) => !['ZEMA', 'ZEMA_EIA', 'ERB', 'ERB_GENERATION_LICENCE'].includes(a)) },
  ];
}

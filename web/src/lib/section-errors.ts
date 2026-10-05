/**
 * Shared helpers for per-section data-fetch errors in the portal data hooks
 * (useFinancierData / useTechnicalData / useGrantData / useTraderData).
 *
 * Each hook tracks a SectionErrorMap keyed by its section names; pages render
 * the messages via <ErrorState /> so a failed request is never mistaken for
 * an empty dataset.
 */

/** Map of section name → user-friendly error message (null = loaded OK). */
export type SectionErrorMap = Record<string, string | null>;

const RATE_LIMITED =
  'You\u2019re moving quickly \u2014 too many requests reached the server. Please wait about a minute, then retry.';
const NETWORK =
  'We couldn\u2019t reach the server. Check your connection and try again.';
const GENERIC =
  'This section failed to load on our side. Retrying usually fixes it \u2014 if it keeps happening, contact support.';

/** Translate a thrown error into calm, actionable copy for end users. */
export function describeError(e: unknown): string {
  const msg = String((e as { message?: unknown })?.message ?? e ?? '');

  if (/429|too many|rate.?limit/i.test(msg)) return RATE_LIMITED;
  if (/failed to fetch|networkerror|network error|load failed|fetch failed|timed?\s?out/i.test(msg)) {
    return NETWORK;
  }
  return GENERIC;
}

/** True when any section in the map currently has an error. */
export function hasAnyError(errors: SectionErrorMap): boolean {
  for (const key of Object.keys(errors)) {
    if (errors[key]) return true;
  }
  return false;
}

/** First error message in the map (insertion order), for single-banner display. */
export function firstErrorMessage(errors: SectionErrorMap): string | null {
  for (const key of Object.keys(errors)) {
    if (errors[key]) return errors[key];
  }
  return null;
}

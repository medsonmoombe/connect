/**
 * project-edit-policy.ts — SINGLE SOURCE OF TRUTH for which project fields may
 * be edited while a project is `live` or `under_review`.
 *
 * Rationale (PRD §C):
 *  - Tier A ("safe") fields are narrative/scheduling only. Changing them does
 *    not alter what the AI verified or what partners matched against, so they
 *    stay editable while the project is visible on the marketplace.
 *  - Tier B ("material") fields describe the deal itself — capacity, capital,
 *    technology, location, checklist claims. They drive AI scoring and the
 *    matching engine, so they are LOCKED while live/under_review. To change
 *    them the developer pauses the project (live → paused → draft via the
 *    state machine) and resubmits it for review.
 *  - Tier C ("system") fields are owned by the AI/reviewers and are never
 *    developer-editable via PATCH.
 *
 * Server enforcement lives in PATCH /api/projects/[id]; the edit wizard uses
 * the same lists to disable inputs. Keep both importing from here.
 */

/** Tier A — safe to edit while the project is live / under review. */
export const SAFE_EDIT_FIELDS = [
  'description',
  'governance_terms',
  'exit_terms',
  'risk_disclosures',
  'target_financial_close_date',
  'target_cod',
] as const;

/** Tier B — material: locked while live / under_review (developer edits). */
export const MATERIAL_FIELDS = [
  'name',
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
 * Material columns of `project_tech_requirements` — locked on the
 * `_resource: 'tech_requirements'` sub-resource under the same rule.
 */
export const MATERIAL_TECH_FIELDS = [
  'required_services',
  'terrain_complexity',
  'grid_status',
  'budget_preference',
  'ppa_status',
] as const;

/** Tier C — system/reviewer-owned; developers can never PATCH these. */
export const SYSTEM_FIELDS = [
  'project_stage',   // AI-determined
  'rejection_reason', // set by reviewers only (also gates score visibility)
] as const;

/** Statuses where the material-field lock applies (non-admin editors). */
export const FIELD_LOCK_STATUSES = ['live', 'under_review'] as const;

export function isFieldLockedWhileLive(status: string | null | undefined): boolean {
  return !!status && (FIELD_LOCK_STATUSES as readonly string[]).includes(status);
}

/** True if `field` is locked while the project is live / under review. */
export function isMaterialField(field: string): boolean {
  return (MATERIAL_FIELDS as readonly string[]).includes(field);
}

/** Loose equality across JSON types (numbers, strings, booleans, arrays). */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // Numeric coercion ('50' vs 50, 50 vs 50.0)
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && a !== '' && b !== '' && a !== null && b !== null) {
    return na === nb;
  }
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export interface PartitionResult<T> {
  /** Fields safe to write: safe-tier fields plus material fields whose value is unchanged. */
  accepted: T;
  /** Material fields whose value would actually change — the caller must 403. */
  blockedFields: string[];
}

/**
 * Partition a PATCH payload for a project in a lock status.
 *
 * - Safe-tier fields always pass.
 * - Material fields pass ONLY when the new value equals the stored value
 *   (the wizard round-trips the whole form, so unchanged material fields
 *   must not trip the lock).
 * - Everything else is reported in `blockedFields`.
 *
 * `current` is the existing DB row (may be null → every provided material
 * field counts as changed).
 */
export function partitionEditablePayload<T extends Record<string, unknown>>(
  payload: T,
  current: Record<string, unknown> | null | undefined,
  isPlatformAdmin: boolean,
): PartitionResult<T> {
  if (isPlatformAdmin) return { accepted: payload, blockedFields: [] };

  const accepted = { ...payload } as T;
  const blockedFields: string[] = [];

  for (const key of Object.keys(payload)) {
    if (!isMaterialField(key)) continue; // safe field → keep
    const changed = !current || !valuesEqual(payload[key], current[key]);
    if (changed) {
      blockedFields.push(key);
      delete accepted[key];
    }
    // unchanged material field → drop from the update (no-op write)
  }

  return { accepted, blockedFields };
}

/** Same partitioning for the `project_tech_requirements` sub-resource. */
export function partitionTechPayload<T extends Record<string, unknown>>(
  payload: T,
  current: Record<string, unknown> | null | undefined,
  isPlatformAdmin: boolean,
): PartitionResult<T> {
  if (isPlatformAdmin) return { accepted: payload, blockedFields: [] };

  const accepted = { ...payload } as T;
  const blockedFields: string[] = [];

  for (const key of Object.keys(payload)) {
    if (!(MATERIAL_TECH_FIELDS as readonly string[]).includes(key)) continue;
    const changed = !current || !valuesEqual(payload[key], current[key]);
    if (changed) {
      blockedFields.push(key);
      delete accepted[key];
    }
  }

  return { accepted, blockedFields };
}

export const MATERIAL_FIELDS_LOCKED_MESSAGE =
  'These fields are locked while the project is live or under review: {fields}. ' +
  'Pause the project from the project page (or use “Unlock full editing” in the editor) to change them — ' +
  'it will be removed from the marketplace and must be resubmitted for review.';

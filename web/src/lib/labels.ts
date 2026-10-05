/**
 * labels.ts — User-friendly display labels for controlled DB vocabularies.
 *
 * Raw enum values (PHOTOVOLTAIC, RUN_OF_RIVER, …) are storage values: they must
 * never be shown to users. Everything user-facing renders through these maps so
 * the wording is identical everywhere (cards, dashboards, marketplaces,
 * notifications).
 *
 * Adding a value: add it to the controlled vocabulary in project-validation.ts
 * AND to the matching map here — unknown values fall back to Title Cased
 * ("Some_New_Value" → "Some New Value") so a forgotten entry degrades
 * gracefully instead of leaking SCREAMING_CASE to the UI.
 */

/** Project technology_type vocabulary (lib/project-validation.ts). */
const PROJECT_TECHNOLOGY_LABELS: Record<string, string> = {
  PHOTOVOLTAIC: 'Solar Photovoltaic (PV)',
  CONCENTRATED_SOLAR: 'Concentrated Solar Power (CSP)',
  ONSHORE_WIND: 'Onshore Wind',
  RUN_OF_RIVER: 'Run-of-River Hydro',
  LITHIUM_ION: 'Lithium-Ion Battery Storage',
  VANADIUM_FLOW: 'Vanadium Redox-Flow Battery',
  OTHER: 'Other / Hybrid',
};

/** Partner-profile sector vocabulary (onboarding SECTORS, sector_focus…). */
const SECTOR_LABELS: Record<string, string> = {
  SOLAR: 'Solar',
  WIND: 'Wind',
  HYDRO: 'Hydro',
  STORAGE: 'Battery Storage',
  BIOMASS: 'Biomass',
  GEOTHERMAL: 'Geothermal',
  GRID_INFRA: 'Grid Infrastructure',
};

const ALL_LABELS: Record<string, string> = { ...PROJECT_TECHNOLOGY_LABELS, ...SECTOR_LABELS };

/**
 * Friendly label for a technology OR sector value. Accepts the raw DB value in
 * any casing; unknown values degrade to Title Case instead of raw SCREAMING_CASE.
 */
export function technologyLabel(value?: string | null): string {
  if (!value) return '—';
  const key = String(value).trim().toUpperCase();
  if (ALL_LABELS[key]) return ALL_LABELS[key];
  return String(value)
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Option list for <select>/<MultiSelect> inputs over a raw value array. */
export function technologyOptions(values: readonly string[]): { value: string; label: string }[] {
  return values.map((v) => ({ value: v, label: technologyLabel(v) }));
}

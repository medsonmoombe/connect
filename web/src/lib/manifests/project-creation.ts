/**
 * project-creation.ts — Manifest for the 5-step project creation form.
 *
 * Modify this manifest and the DynamicFormRenderer adjusts automatically.
 * Fields marked `schema: 'jsonb'` are stored in the projects.extra_data column.
 */

import type { FormManifest } from '@/lib/form-manifest';
import {
  TECHNOLOGY_TYPES,
  CAPITAL_STRUCTURE_TYPES,
  LAND_TITLE_STATUSES,
  TERRAIN_COMPLEXITY,
  GRID_STATUS,
  BUDGET_PREFERENCE,
  PPA_STATUS,
  REGULATORY_APPROVALS,
  PROJECT_DOCUMENT_TYPES,
} from '@/lib/project-validation';
import { COUNTRY_REGIONS, findCountry } from '@/lib/countries';

const TECHNOLOGY_OPTIONS = TECHNOLOGY_TYPES.map((t) => ({
  value: t,
  label: t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
}));

const CAPITAL_OPTIONS = CAPITAL_STRUCTURE_TYPES.map((t) => ({
  value: t,
  label: t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
}));

const LAND_TITLE_OPTIONS = LAND_TITLE_STATUSES.map((t) => ({ value: t, label: t }));

const TERRAIN_OPTIONS = TERRAIN_COMPLEXITY.map((t) => ({
  value: t,
  label: t.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
}));

const GRID_OPTIONS = GRID_STATUS.map((t) => ({
  value: t,
  label: t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
}));

const BUDGET_OPTIONS = BUDGET_PREFERENCE.map((t) => ({
  value: t,
  label: t.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
}));

const PPA_OPTIONS = PPA_STATUS.map((t) => ({
  value: t,
  label: t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
}));

const REGULATORY_OPTIONS = REGULATORY_APPROVALS.map((a) => ({ value: a, label: a }));

const DOCUMENT_OPTIONS = PROJECT_DOCUMENT_TYPES.map((d) => ({ value: d, label: d }));

/**
 * Build region options based on selected country. Resolves the country via
 * findCountry so legacy stored values (e.g. ISO code "ZM" or a typo'd
 * "south africa") still produce the right list. Returns [] for countries
 * without a curated region list — the renderer should fall back to a free-
 * text input in that case.
 */
export function getRegionOptions(country: string): { value: string; label: string }[] {
  if (!country) return [];
  const matched = findCountry(country);
  const name = matched?.name ?? country;
  const regions = COUNTRY_REGIONS[name];
  if (!regions) return [];
  return regions.map((r) => ({ value: r, label: r }));
}

/** True if the country has a curated region list. */
export function hasRegionList(country: string): boolean {
  return getRegionOptions(country).length > 0;
}

export const projectCreationManifest: FormManifest = {
  id: 'project-creation',
  name: 'Create Project',
  version: 1,
  steps: [
    // ── Step 1: Project Identity ────────────────────────────────────────
    {
      title: 'Project Identity',
      subtitle: 'Provide basic details about the infrastructure opportunity.',
      icon: 'building',
      validationSchema: 'step1',
      fields: [
        {
          name: 'name',
          label: 'Project Name',
          type: 'text',
          placeholder: 'e.g. Kafue Gorge Solar Farm',
          required: true,
          validation: { minLength: 3, maxLength: 200, message: 'Project name must be 3-200 characters' },
          helperText: 'A clear, descriptive name for your project.',
          width: 'full',
        },
        {
          name: 'technology_type',
          label: 'Technology Type',
          type: 'select',
          options: TECHNOLOGY_OPTIONS,
          required: true,
          helperText: 'The primary energy technology for this project.',
          width: 'half',
        },
        {
          name: 'location_country',
          label: 'Country',
          type: 'country',
          required: true,
          helperText: 'Where is the project located? Type to search the full country list.',
          width: 'half',
        },
        {
          name: 'location_region',
          label: 'Region / Province',
          type: 'select',
          options: [], // Fallback when dynamicOptions returns []
          placeholder: 'Select country first',
          helperText: 'Specific region or province within the country. For countries without a curated list, type any region name.',
          width: 'half',
          dependsOn: { field: 'location_country', operator: 'isNotEmpty', value: '' },
          dynamicOptions: (formData) => getRegionOptions(String(formData.location_country ?? '')),
          fallbackType: 'text',
        },
        {
          name: 'description',
          label: 'Project Description',
          type: 'textarea',
          placeholder: 'Describe the project opportunity, target market, and key value proposition...',
          validation: { maxLength: 5000, message: 'Description must be under 5,000 characters' },
          helperText: 'A brief overview of the project (max 5,000 characters).',
          width: 'full',
        },
      ],
    },
    // ── Step 2: Scale & Financials ─────────────────────────────────────
    {
      title: 'Scale & Financials',
      subtitle: 'Define the capacity and capital structure of the project.',
      icon: 'dollarSign',
      validationSchema: 'step2',
      fields: [
        {
          name: 'project_size_mw',
          label: 'Project Size (MW)',
          type: 'number',
          placeholder: '50',
          required: true,
          validation: { min: 0.1, message: 'Project size must be greater than 0' },
          helperText: 'Total installed capacity in megawatts.',
          width: 'half',
        },
        {
          name: 'capital_required',
          label: 'Capital Required (USD)',
          type: 'currency',
          currencyCode: 'USD',
          placeholder: '50000000',
          required: true,
          validation: { min: 1, message: 'Capital required must be greater than 0' },
          helperText: 'Total capital needed for the project.',
          width: 'half',
        },
        {
          name: 'capital_structure_type',
          label: 'Capital Structure',
          type: 'select',
          options: CAPITAL_OPTIONS,
          required: true,
          helperText: 'Primary capital structure type.',
          width: 'half',
        },
        {
          name: 'capex',
          label: 'CAPEX (USD)',
          type: 'currency',
          currencyCode: 'USD',
          placeholder: '40000000',
          validation: { min: 0, message: 'CAPEX cannot be negative' },
          helperText: 'Capital expenditure estimate (optional).',
          width: 'half',
          schema: 'jsonb',
        },
        {
          name: 'opex',
          label: 'OPEX (USD/year)',
          type: 'currency',
          currencyCode: 'USD',
          placeholder: '2000000',
          validation: { min: 0, message: 'OPEX cannot be negative' },
          helperText: 'Annual operating expenditure (optional).',
          width: 'half',
          schema: 'jsonb',
        },
        {
          name: 'funding_required',
          label: 'Funding Required (USD)',
          type: 'currency',
          currencyCode: 'USD',
          placeholder: '30000000',
          validation: { min: 0, message: 'Funding required cannot be negative' },
          helperText: 'Amount still needed to close financing (optional).',
          width: 'half',
          schema: 'jsonb',
        },
      ],
    },
    // ── Step 3: Timeline & Status ──────────────────────────────────────
    {
      title: 'Timeline & Status',
      subtitle: 'Help partners understand the current stage and expected milestones.',
      icon: 'briefcase',
      validationSchema: 'step3',
      fields: [
        {
          name: 'has_secured_land',
          label: 'Land Secured',
          type: 'yesno',
          helperText: 'Do you have secured land rights for this project?',
          width: 'half',
        },
        {
          name: 'land_title_status',
          label: 'Land Title Status',
          type: 'select',
          options: LAND_TITLE_OPTIONS,
          helperText: 'Type of land title held.',
          width: 'half',
          dependsOn: { field: 'has_secured_land', operator: 'equals', value: true },
        },
        {
          name: 'has_reached_financial_close',
          label: 'Financial Close Reached',
          type: 'yesno',
          helperText: 'Has financial close been achieved?',
          width: 'half',
        },
        {
          name: 'regulatory_approvals',
          label: 'Regulatory Approvals Obtained',
          type: 'multiselect',
          options: REGULATORY_OPTIONS,
          helperText: 'Select all approvals already secured.',
          width: 'full',
        },
        {
          name: 'target_financial_close_date',
          label: 'Target Financial Close Date',
          type: 'date',
          helperText: 'Expected date for financial close.',
          width: 'half',
        },
        {
          name: 'target_cod',
          label: 'Target Commercial Operation Date',
          type: 'date',
          helperText: 'Expected date for commercial operation.',
          width: 'half',
        },
      ],
    },
    // ── Step 4: Technical Requirements ─────────────────────────────────
    {
      title: 'Technical Requirements',
      subtitle: 'Specify what technical services and conditions apply to this site.',
      icon: 'settings',
      validationSchema: 'step4',
      fields: [
        {
          name: 'terrain_complexity',
          label: 'Terrain Complexity',
          type: 'select',
          options: TERRAIN_OPTIONS,
          required: true,
          helperText: 'Physical terrain complexity of the site.',
          width: 'half',
        },
        {
          name: 'grid_status',
          label: 'Grid Connection Status',
          type: 'select',
          options: GRID_OPTIONS,
          required: true,
          helperText: 'Current status of grid connection.',
          width: 'half',
        },
        {
          name: 'budget_preference',
          label: 'Budget Preference',
          type: 'select',
          options: BUDGET_OPTIONS,
          required: true,
          helperText: 'Preferred budget arrangement for technical services.',
          width: 'half',
        },
        {
          name: 'ppa_status',
          label: 'PPA Status',
          type: 'select',
          options: PPA_OPTIONS,
          helperText: 'Status of Power Purchase Agreement.',
          width: 'half',
        },
        {
          name: 'required_services',
          label: 'Required Technical Services',
          type: 'multiselect',
          options: [
            { value: 'FEASIBILITY_STUDY', label: 'Feasibility Study' },
            { value: 'ENVIRONMENTAL_ASSESSMENT', label: 'Environmental Assessment' },
            { value: 'GRID_CONNECTION', label: 'Grid Connection' },
            { value: 'EPC_CONSTRUCTION', label: 'EPC / Construction' },
            { value: 'O_AND_M', label: 'O&M Services' },
            { value: 'FINANCIAL_ADVISORY', label: 'Financial Advisory' },
            { value: 'LEGAL_ADVISORY', label: 'Legal Advisory' },
          ],
          helperText: 'Select all technical services needed for this project.',
          width: 'full',
        },
      ],
    },
    // ── Step 5: Narrative & Submission ─────────────────────────────────
    {
      title: 'Narrative & Submission',
      subtitle: 'Add governance details, upload documents, and submit for review.',
      icon: 'send',
      validationSchema: 'step5',
      fields: [
        {
          name: 'governance_terms',
          label: 'Governance Terms',
          type: 'textarea',
          placeholder: 'Describe governance requirements, board composition, voting rights...',
          validation: { maxLength: 5000 },
          helperText: 'Governance expectations for partners (optional).',
          width: 'full',
        },
        {
          name: 'exit_terms',
          label: 'Exit Terms',
          type: 'textarea',
          placeholder: 'Describe exit options, lock-up periods, transfer restrictions...',
          validation: { maxLength: 5000 },
          helperText: 'Exit strategy and terms (optional).',
          width: 'full',
        },
        {
          name: 'risk_disclosures',
          label: 'Risk Disclosures',
          type: 'textarea',
          placeholder: 'Describe key risks, mitigations, and sensitivities...',
          validation: { maxLength: 5000 },
          helperText: 'Key project risks and mitigations (optional).',
          width: 'full',
        },
        {
          name: 'documents',
          label: 'Project Documents',
          type: 'multiselect',
          options: DOCUMENT_OPTIONS,
          helperText: 'Select document types you are uploading.',
          width: 'full',
        },
      ],
    },
  ],
};

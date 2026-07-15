import { z } from 'zod';

// ─── Controlled vocabulary (PRD Section 3.1) ────────────────────────────────

export const TECHNOLOGY_TYPES = [
  'PHOTOVOLTAIC', 'CONCENTRATED_SOLAR', 'ONSHORE_WIND',
  'RUN_OF_RIVER', 'LITHIUM_ION', 'VANADIUM_FLOW', 'OTHER',
] as const;

export const PROJECT_STAGES = [
  'CONCEPT', 'FEASIBILITY', 'PERMITTING', 'FINANCIAL_CLOSE', 'CONSTRUCTION', 'OPERATIONS',
] as const;

export const CAPITAL_STRUCTURE_TYPES = ['EQUITY', 'PROFIT_SHARING', 'LEASING', 'GRANT'] as const;

export const LAND_TITLE_STATUSES = ['Traditional', 'Titled', 'Not Applicable'] as const;

export const TERRAIN_COMPLEXITY = ['SIMPLE', 'MODERATE', 'COMPLEX'] as const;

export const GRID_STATUS = ['CONNECTED', 'PENDING', 'OFF_GRID'] as const;

export const BUDGET_PREFERENCE = ['FIXED', 'MILESTONE', 'NEGOTIABLE'] as const;

// ─── Step schemas ────────────────────────────────────────────────────────────

export const step1Schema = z.object({
  name: z.string().min(3, 'Project name must be at least 3 characters').max(200, 'Project name must be at most 200 characters'),
  technology_type: z.enum(TECHNOLOGY_TYPES, { errorMap: () => ({ message: 'Select a valid technology type' }) }),
  location_country: z.string().min(1, 'Country is required'),
  location_region: z.string().optional(),
});

export const step2Schema = z.object({
  project_size_mw: z.number().positive('Project size must be greater than 0'),
  capital_required: z.number().positive('Capital required must be greater than 0'),
  capital_structure_type: z.enum(CAPITAL_STRUCTURE_TYPES, { errorMap: () => ({ message: 'Select a capital structure type' }) }),
});

export const step3Schema = z.object({
  project_stage: z.enum(PROJECT_STAGES, { errorMap: () => ({ message: 'Select a project stage' }) }),
  target_financial_close_date: z.string().optional(),
  target_cod: z.string().optional(),
}).refine(
  (data) => {
    if (data.target_financial_close_date && data.target_cod) {
      return new Date(data.target_financial_close_date) < new Date(data.target_cod);
    }
    return true;
  },
  { message: 'Financial close date must be before project go-live date', path: ['target_cod'] }
);

export const step4Schema = z.object({
  terrain_complexity: z.enum(TERRAIN_COMPLEXITY),
  grid_status: z.enum(GRID_STATUS),
  budget_preference: z.enum(BUDGET_PREFERENCE),
  required_services: z.array(z.string()).optional(),
});

export const step5Schema = z.object({
  governance_terms: z.string().optional(),
  exit_terms: z.string().optional(),
  risk_disclosures: z.string().optional(),
  has_secured_land: z.boolean().optional(),
  land_title_status: z.enum(LAND_TITLE_STATUSES).optional(),
  has_reached_financial_close: z.boolean().optional(),
  regulatory_approvals: z.array(z.string()).optional(),
});

// ─── Full project creation schema ────────────────────────────────────────────

const step3Base = step3Schema._def.schema as z.ZodObject<any>;

export const createProjectSchema = z.object({
  name: step1Schema.shape.name,
  technology_type: step1Schema.shape.technology_type,
  location_country: step1Schema.shape.location_country,
  location_region: step1Schema.shape.location_region,
  project_size_mw: step2Schema.shape.project_size_mw,
  capital_required: step2Schema.shape.capital_required,
  capital_structure_type: step2Schema.shape.capital_structure_type,
  project_stage: step3Base.shape.project_stage,
  target_financial_close_date: step3Base.shape.target_financial_close_date,
  target_cod: step3Base.shape.target_cod,
  governance_terms: step5Schema.shape.governance_terms,
  exit_terms: step5Schema.shape.exit_terms,
  risk_disclosures: step5Schema.shape.risk_disclosures,
  has_secured_land: step5Schema.shape.has_secured_land,
  land_title_status: step5Schema.shape.land_title_status,
  has_reached_financial_close: step5Schema.shape.has_reached_financial_close,
  regulatory_approvals: step5Schema.shape.regulatory_approvals,
});

// ─── Rejection reason schema ─────────────────────────────────────────────────

export const rejectProjectSchema = z.object({
  reason: z.string().min(10, 'Rejection reason must be at least 10 characters').max(2000),
});

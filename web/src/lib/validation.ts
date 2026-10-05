import { z } from 'zod';

// ── Reusable primitives ───────────────────────────────────────────────────────

export const uuid = z.string().uuid();
export const nonEmptyStr = z.string().min(1).max(1000);
export const optionalUrl = z.string().url().max(2048).optional().or(z.literal(''));
export const phone = z.string().max(30).optional().or(z.literal(''));

// ── Engagement PATCH ─────────────────────────────────────────────────────────

const ENGAGEMENT_STATUSES = [
  'INTRO_SENT', 'INTRO_ACCEPTED', 'NDA_SIGNED', 'DUE_DILIGENCE',
  'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED', 'DROPPED',
] as const;

export const engagementPatchSchema = z.object({
  status: z.enum(ENGAGEMENT_STATUSES).optional(),
  nda_signed: z.boolean().optional(),
  reason: z.string().max(500).optional(),
}).strict();

export type EngagementPatchInput = z.infer<typeof engagementPatchSchema>;

// ── Profile PATCH ────────────────────────────────────────────────────────────

export const profilePatchSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(200).optional(),
  avatar_url: z.string().max(2048).optional().nullable(),
  phone: phone,
  job_title: z.string().max(200).optional().nullable(),
  mfa_enabled: z.boolean().optional(),
  notification_preferences: z.record(z.boolean()).optional(),
}).strict();

export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;

// ── MFA verify ───────────────────────────────────────────────────────────────

export const mfaVerifySchema = z.object({
  token: z.string().length(6, 'Code must be 6 digits').regex(/^\d{6}$/, 'Code must be numeric'),
}).strict();

export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;

// ── Message send ─────────────────────────────────────────────────────────────

export const messageSendSchema = z.object({
  engagement_id: uuid,
  content: z.string().min(1, 'Message cannot be empty').max(10000),
}).strict();

export type MessageSendInput = z.infer<typeof messageSendSchema>;

// ── Partner upsert ───────────────────────────────────────────────────────────

export const capitalPartnerSchema = z.object({
  company_id: uuid,
  ticket_size_min: z.number().min(0).optional(),
  ticket_size_max: z.number().min(0).optional(),
  preferred_structures: z.array(z.string()).optional(),
  risk_tolerance: z.string().max(100).optional(),
  governance_preference: z.string().max(100).optional(),
  sector_focus: z.array(z.string()).optional(),
  geo_preference: z.array(z.string()).optional(),
}).strict();

export const technicalPartnerSchema = z.object({
  company_id: uuid,
  sector_experience: z.array(z.string()).optional(),
  min_project_size_mw: z.number().min(0).optional(),
  max_project_size_mw: z.number().min(0).optional(),
  min_ticket_size: z.number().min(0).optional(),
  max_ticket_size: z.number().min(0).optional(),
  preferred_contract_types: z.array(z.string()).optional(),
}).strict();

// ── Validate helper ──────────────────────────────────────────────────────────

export function validate<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
): { ok: true; data: z.infer<T> } | { ok: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  const msg = result.error.issues.map(i => i.message).join('; ');
  return { ok: false, error: msg };
}

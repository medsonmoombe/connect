import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser, forbidden, badRequest, handleRouteError, writeAuditLog, serverError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

/**
 * POST /api/profile/partner-preferences
 *
 * Validated, server-side save for partner profiles (trader / grant / consultant
 * / technical). Previously each portal editor wrote straight to Supabase from
 * the browser, so no validation ran and any authenticated member could write
 * arbitrary columns. The table is derived from the caller's own company role —
 * never from the request body.
 */

const num = z.number().min(0);
const strArr = z.array(z.string());

const traderSchema = z.object({
  license_type: z.string().trim().min(1, 'License type is required'),
  max_offtake_capacity_mw: num,
  preferred_technology_types: strArr.default([]),
  regions_of_interest: strArr.default([]),
  min_ppa_duration_years: z.number().int().min(0),
  credit_rating_equivalent: z.string().optional().default(''),
});

const grantSchema = z.object({
  grant_types: strArr,
  min_grant_size: num,
  max_grant_size: num,
  focus_sectors: strArr,
  geographic_focus: strArr,
  eligibility_criteria: z.string().optional().default(''),
  application_process: z.string().optional().default(''),
  typical_timeline_months: z.number().int().min(0).optional().default(0),
}).refine((d) => d.max_grant_size >= d.min_grant_size, {
  message: 'Max grant size must be greater than or equal to min grant size',
  path: ['max_grant_size'],
});

const consultantSchema = z.object({
  service_categories: strArr.default([]),
  sector_experience: strArr.default([]),
  specializations: strArr.default([]),
  regions_operated: strArr.default([]),
  certifications: strArr.default([]),
  years_of_experience: z.number().int().min(0).default(0),
  total_projects_completed: z.number().int().min(0).default(0),
  largest_project_mw: num.default(0),
  availability: z.string().optional().default(''),
  hourly_rate_range: z.string().optional().default(''),
  project_rate_range: z.string().optional().default(''),
  company_experience_doc_url: z.string().optional().default(''),
  portfolio_doc_url: z.string().optional().default(''),
});

const technicalSchema = z.object({
  service_categories: strArr.default([]),
  sector_experience: strArr.default([]),
  min_mw_capacity: num.default(0),
  max_mw_capacity: num.default(0),
  regions_operated: strArr.default([]),
  annual_delivery_capacity_mw: num.default(0),
  total_mw_delivered: num.default(0),
  largest_project_mw: num.default(0),
  average_delivery_time_months: z.number().int().min(0).default(0),
  bonding_capacity: num.default(0),
  delivery_models: strArr.default([]),
  payment_terms: z.string().optional().default(''),
  project_type_experience: strArr.default([]),
  min_ticket_size_zmw: num.default(0),
  max_ticket_size_zmw: num.default(0),
  years_of_experience: z.number().int().min(0).default(0),
  company_experience_doc_url: z.string().optional().default(''),
});

type PartnerRole = 'POWER_TRADER' | 'GRANT_PROVIDER' | 'CONSULTANT' | 'TECHNICAL_PARTNER';

const ROLE_CONFIG: Record<PartnerRole, { table: string; schema: z.ZodTypeAny }> = {
  POWER_TRADER: { table: 'power_traders', schema: traderSchema },
  GRANT_PROVIDER: { table: 'grant_providers', schema: grantSchema },
  CONSULTANT: { table: 'consultants', schema: consultantSchema },
  TECHNICAL_PARTNER: { table: 'technical_partners', schema: technicalSchema },
};

/** Map a company's primary_role / type onto a partner role. */
function resolvePartnerRole(primaryRole?: string | null, type?: string | null): PartnerRole | null {
  const direct = primaryRole as PartnerRole | undefined;
  if (direct && direct in ROLE_CONFIG) return direct;
  if (type === 'TECHNICAL') return 'TECHNICAL_PARTNER';
  if (type === 'CONSULTANT') return 'CONSULTANT';
  if (type === 'GRANT_PROVIDER') return 'GRANT_PROVIDER';
  if (type === 'POWER_TRADER') return 'POWER_TRADER';
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.company_id) return forbidden('Only organisation members can save partner preferences.');

    const admin = getSupabaseAdmin();
    const { data: company } = await admin
      .from('companies')
      .select('id, primary_role, type')
      .eq('id', user.company_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!company) return badRequest('Company not found');

    const role = resolvePartnerRole(company.primary_role, company.type);
    if (!role) return forbidden('Your organisation type does not have partner preferences.');

    const { table, schema } = ROLE_CONFIG[role];
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join('; ');
      return badRequest(message || 'Invalid preferences');
    }

    // Replace the company's single preferences row.
    await admin.from(table).delete().eq('company_id', company.id);
    const { data: inserted, error: insertErr } = await admin
      .from(table)
      .insert({ company_id: company.id, ...(parsed.data as Record<string, unknown>) })
      .select()
      .single();
    if (insertErr) {
      console.error('[Profile/PartnerPreferences] insert error:', insertErr.message);
      return serverError();
    }

    await writeAuditLog({
      userId: user.id,
      action: 'ONBOARDING_SAVE_PREFERENCES',
      entityType: table,
      entityId: company.id,
      after: parsed.data,
      req,
    });

    return Response.json({ data: inserted });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendAdminNewOrgNotification, sendAdminOrgResubmittedNotification } from '@/lib/email';
import { createNotifications, notificationBuilders } from '@/lib/notify';
import { z } from 'zod';

const capitalPreferencesSchema = z.object({
  min_ticket_size: z.number().min(0, 'Min ticket size must be positive'),
  max_ticket_size: z.number().min(0, 'Max ticket size must be positive'),
  risk_tolerance: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  governance_preference: z.enum(['PASSIVE', 'BOARD_SEAT', 'ACTIVE_ROLE']),
  sector_focus: z.array(z.string()).min(1, 'Select at least one sector'),
  geographic_focus: z.array(z.string()).min(1, 'Select at least one region'),
  preferred_project_stage: z.array(z.string()).nullish().transform(v => v ?? []),
  preferred_capital_structure: z.array(z.string()).nullish().transform(v => v ?? []),
  preferred_structures: z.array(z.string()).nullish().transform(v => v ?? []),
  expected_return_profile: z.string().nullish().transform(v => v ?? ''),
}).refine((data) => data.min_ticket_size <= data.max_ticket_size, {
  message: 'Min ticket size must be less than or equal to max ticket size',
  path: ['max_ticket_size'],
});

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json();
    const supabase = getSupabaseAdmin();
    const { action } = body;

    if (action === 'join_company') {
      const { companyId } = body;
      if (!companyId) return Response.json({ error: 'companyId required' }, { status: 400 });

      // Enforce single-company membership
      const { data: anyMembership } = await supabase
        .from('company_members')
        .select('id, company_id, companies(name)')
        .is('deleted_at', null)
        .eq('user_id', user.id)
        .maybeSingle();

      if (anyMembership) {
        const companyName = (anyMembership as any).companies?.name ?? 'another organisation';
        return Response.json(
          { error: `You are already a member of ${companyName}. A user can only belong to one company at a time.` },
          { status: 400 },
        );
      }

      const { data: existing } = await supabase
        .from('company_members')
        .select('id')
        .is('deleted_at', null)
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .maybeSingle();

      if (!existing) {
        const { error: memberErr } = await supabase
          .from('company_members')
          .insert({ user_id: user.id, company_id: companyId, role: 'MEMBER' });
        if (memberErr) {
          console.error('[Onboarding] Join company error:', memberErr.message);
          return serverError();
        }
      }
      await writeAuditLog({ userId: user.id, action: 'ONBOARDING_JOIN_COMPANY', entityType: 'company_members', entityId: companyId, req });
      return Response.json({ data: { success: true } });
    }

    if (action === 'setup_company') {
      const { company } = body;

      // Guard: prevent duplicate company creation — if user already has a membership, reject
      const { data: existingMember } = await supabase
        .from('company_members')
        .select('id')
        .is('deleted_at', null)
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (existingMember) {
        return Response.json({ error: 'You already belong to a company. Please use the dashboard.' }, { status: 400 });
      }

      // Map company type to primary_role
      const typeToRole: Record<string, string> = {
        DEVELOPER: 'DEVELOPER',
        CAPITAL: 'CAPITAL_PARTNER',
        TECHNICAL: 'TECHNICAL_PARTNER',
        POWER_TRADER: 'POWER_TRADER',
      };

      const primaryRole = typeToRole[company.type] || 'DEVELOPER';

      // Insert into companies table (single source of truth)
      const companyPayload = {
        name: company.name,
        type: company.type,
        primary_role: primaryRole,
        country: company.country,
        description: company.description || '',
        website: company.website || null,
        years_operating: company.years_operating || 0,
        team_size: company.team_size || 0,
        is_new_company_with_experienced_team: company.is_new_company_with_experienced_team || false,
        management_team_experience: company.management_team_experience || {},
        status: 'pending_verification',
      };

      const { data: newCompany, error: companyError } = await supabase
        .from('companies').insert(companyPayload).select().single();
      if (companyError) {
        console.error('[Onboarding] Company insert error:', companyError.message);
        return serverError();
      }

      // Create membership
      const { error: memberError } = await supabase
        .from('company_members')
        .insert({ user_id: user.id, company_id: newCompany.id, role: 'OWNER' });

      if (memberError) {
        console.error('[Onboarding] Member insert error:', memberError.message);
        return serverError();
      }

      // Notify Platform Admins about new company registration
      await writeAuditLog({ userId: user.id, action: 'ONBOARDING_SETUP_COMPANY', entityType: 'companies', entityId: newCompany.id, after: { name: company.name, type: company.type }, req });

      try {
        // Find Platform Admins: members of orgs with is_platform_org = true
        const { data: adminMemberships } = await supabase
          .from('company_members')
          .select('user_id, companies!inner(is_platform_org)')
          .is('deleted_at', null)
          .eq('role', 'ADMIN')
          .eq('companies.is_platform_org', true);

        if (adminMemberships && adminMemberships.length > 0) {
          const adminIds = adminMemberships.map(a => a.user_id);
          const { data: adminProfiles } = await supabase
            .from('user_profiles')
            .select('email')
            .in('id', adminIds);

          if (adminProfiles && adminProfiles.length > 0) {
            const adminEmails = adminProfiles.map(p => p.email).filter(Boolean);
            await sendAdminNewOrgNotification({
              adminEmails,
              orgName: company.name,
              orgType: company.type,
              requesterName: user.full_name || user.email || '',
            });

            // In-app notifications for all Platform Admins
            await createNotifications({
              userIds: adminIds,
              payload: notificationBuilders.newOrgRegistered({
                orgName: company.name,
                orgType: company.type,
                requesterName: user.full_name || user.email || '',
              }),
            });
          }
        }
      } catch (emailErr) {
        // Don't fail the request if admin notification fails
        console.error('[Onboarding] Admin notification error:', emailErr);
      }

      return Response.json({ data: { company: newCompany } });
    }

    if (action === 'save_preferences') {
      const { role, preferences } = body;

      // company_id already points to companies(id) — use it directly
      const { data: company } = await supabase
        .from('companies').select('id').is('deleted_at', null).eq('id', user.company_id).single();

      if (!company) {
        return Response.json({ error: 'Company not found' }, { status: 404 });
      }

      const tableMap: Record<string, string> = {
        CAPITAL_PARTNER: 'capital_partners',
        TECHNICAL_PARTNER: 'technical_partners',
        POWER_TRADER: 'power_traders',
      };

      const table = tableMap[role];
      if (!table) {
        return Response.json({ data: { message: 'No preferences needed' } });
      }

      // Server-side validation for capital partner preferences
      let dataToSave = preferences;
      if (role === 'CAPITAL_PARTNER') {
        const parsed = capitalPreferencesSchema.safeParse(preferences);
        if (!parsed.success) {
          const message = parsed.error.errors.map(e => e.message).join('; ');
          return Response.json({ error: message }, { status: 400 });
        }
        dataToSave = parsed.data; // use validated+defaulted data
      }

      // Delete existing rows then insert fresh (handles missing unique constraint)
      await supabase.from(table).delete().eq('company_id', company.id);
      const { data: inserted, error: insertErr } = await supabase
        .from(table).insert({ company_id: company.id, ...dataToSave }).select().single();
      if (insertErr) {
        console.error('[Onboarding] Preferences insert error:', insertErr.message);
        return serverError();
      }
      await writeAuditLog({ userId: user.id, action: 'ONBOARDING_SAVE_PREFERENCES', entityType: table, entityId: company.id, after: dataToSave, req });
      return Response.json({ data: inserted });
    }

    if (action === 'update_profile') {
      const { full_name } = body;
      const { error } = await supabase
        .from('user_profiles').update({ full_name }).eq('id', user.id);
      if (error) {
        console.error('[Onboarding] Profile update error:', error.message);
        return serverError();
      }
      await writeAuditLog({ userId: user.id, action: 'ONBOARDING_UPDATE_PROFILE', entityType: 'user_profiles', entityId: user.id, after: { full_name }, req });
      return Response.json({ data: { success: true } });
    }

    if (action === 'get_edit_data') {
      if (!user.company_id) {
        return Response.json({ error: 'No company' }, { status: 400 });
      }
      const { data: company } = await supabase
        .from('companies').select('*').eq('id', user.company_id).is('deleted_at', null).single();
      if (!company) {
        return Response.json({ error: 'Company not found' }, { status: 404 });
      }
      let preferences: Record<string, any> = {};
      const tableMap: Record<string, string> = {
        CAPITAL: 'capital_partners',
        TECHNICAL: 'technical_partners',
        POWER_TRADER: 'power_traders',
      };
      const table = tableMap[company.type];
      if (table) {
        const { data: prefsRows } = await supabase
          .from(table).select('*').eq('company_id', user.company_id);
        const prefs = prefsRows?.[0] ?? null;
        if (prefs) {
          const { id, company_id, created_at, updated_at, ...rest } = prefs as any;
          preferences = rest;
        }
      }
      return Response.json({ data: { company, preferences } });
    }

    if (action === 'update_company') {
      const { company } = body;
      if (!user.company_id) {
        return Response.json({ error: 'No company to update' }, { status: 400 });
      }

      const updatePayload: Record<string, any> = {
        name: company.name,
        country: company.country,
        description: company.description || '',
        website: company.website || null,
        years_operating: company.years_operating || 0,
        team_size: company.team_size || 0,
        is_new_company_with_experienced_team: company.is_new_company_with_experienced_team || false,
        management_team_experience: company.management_team_experience || {},
      };

      const { data: updatedCompany, error: updateErr } = await supabase
        .from('companies').update(updatePayload).eq('id', user.company_id).select().single();
      if (updateErr) {
        console.error('[Onboarding] Company update error:', updateErr.message);
        return serverError();
      }
      await writeAuditLog({ userId: user.id, action: 'ONBOARDING_UPDATE_COMPANY', entityType: 'companies', entityId: user.company_id, after: updatePayload, req });
      return Response.json({ data: { company: updatedCompany } });
    }

    if (action === 'resubmit_company') {
      if (!user.company_id) {
        return Response.json({ error: 'No company to resubmit' }, { status: 400 });
      }

      const { data: company } = await supabase
        .from('companies').select('name, type').eq('id', user.company_id).single();

      const { error: resubmitErr } = await supabase
        .from('companies').update({ status: 'pending_verification', admin_note: null }).eq('id', user.company_id);
      if (resubmitErr) {
        console.error('[Onboarding] Resubmit error:', resubmitErr.message);
        return serverError();
      }
      await writeAuditLog({ userId: user.id, action: 'ONBOARDING_RESUBMIT_COMPANY', entityType: 'companies', entityId: user.company_id, after: { status: 'pending_verification' }, req });

      // Notify Platform Admins
      try {
        const { data: adminMemberships } = await supabase
          .from('company_members')
          .select('user_id, companies!inner(is_platform_org)')
          .is('deleted_at', null)
          .eq('role', 'ADMIN')
          .eq('companies.is_platform_org', true);

        if (adminMemberships && adminMemberships.length > 0) {
          const adminIds = adminMemberships.map(a => a.user_id);
          const { data: adminProfiles } = await supabase
            .from('user_profiles')
            .select('email')
            .in('id', adminIds);

          if (adminProfiles && adminProfiles.length > 0) {
            const adminEmails = adminProfiles.map(p => p.email).filter(Boolean);
            await sendAdminOrgResubmittedNotification({
              adminEmails,
              orgName: company?.name || '',
              orgType: company?.type || '',
              requesterName: user.full_name || user.email || '',
            });

            await createNotifications({
              userIds: adminIds,
              payload: notificationBuilders.orgResubmitted({
                orgName: company?.name || '',
                requesterName: user.full_name || user.email || '',
              }),
            });
          }
        }
      } catch (emailErr) {
        console.error('[Onboarding] Admin resubmit notification error:', emailErr);
      }

      return Response.json({ data: { success: true } });
    }

    if (action === 'complete_onboarding') {
      const { error } = await supabase
        .from('user_profiles')
        .update({ onboarding_complete: true })
        .eq('id', user.id);
      if (error) {
        console.error('[Onboarding] Complete error:', error.message);
        return serverError();
      }
      await writeAuditLog({ userId: user.id, action: 'ONBOARDING_COMPLETED', entityType: 'user_profiles', entityId: user.id, req });
      return Response.json({ data: { success: true } });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden, serverError, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

// GET /api/admin/organizations?status=pending_verification
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const status = new URL(req.url).searchParams.get('status') ?? 'pending_verification';
    const admin = getSupabaseAdmin();

    // 1. Fetch companies with the requested status
    const { data: companies, error: companyErr } = await admin
      .from('companies')
      .select('*')
      .is('deleted_at', null)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (companyErr) {
      console.error('[Admin/Orgs] Query error:', companyErr.message);
      return serverError();
    }

    if (!companies || companies.length === 0) {
      return Response.json({ data: [] });
    }

    // 2. Fetch all memberships for these companies
    const companyIds = companies.map(c => c.id);
    const { data: memberships } = await admin
      .from('company_members')
      .select('company_id, role, user_id')
      .is('deleted_at', null)
      .in('company_id', companyIds);

    // 3. Fetch user profiles for all member user_ids
    const userIds = [...new Set((memberships ?? []).map(m => m.user_id))];
    const { data: profiles } = userIds.length > 0
      ? await admin
          .from('user_profiles')
          .select('id, full_name, email, created_at, avatar_url')
          .in('id', userIds)
      : { data: [] };

    // 4. Build lookup maps and merge
    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));
    const membersByCompany = new Map<string, any[]>();

    for (const m of memberships ?? []) {
      if (!membersByCompany.has(m.company_id)) membersByCompany.set(m.company_id, []);
      membersByCompany.get(m.company_id)!.push({
        role: m.role,
        user_id: m.user_id,
        user_profiles: profileMap.get(m.user_id) ?? null,
      });
    }

    const data = companies.map(company => ({
      ...company,
      company_members: membersByCompany.get(company.id) ?? [],
    }));

    // 5. Fetch role-specific preferences for all companies
    const companyIdsForPrefs = companies.map(c => c.id);
    const prefTables = [
      { role: 'CAPITAL_PARTNER', table: 'capital_partners' },
      { role: 'TECHNICAL_PARTNER', table: 'technical_partners' },
      { role: 'POWER_TRADER', table: 'power_traders' },
    ] as const;

    for (const { role, table } of prefTables) {
      const matchingIds = companies.filter(c => c.primary_role === role).map(c => c.id);
      if (matchingIds.length === 0) continue;

      const { data: prefs } = await admin
        .from(table)
        .select('*')
        .in('company_id', matchingIds);

      if (prefs) {
        for (const pref of prefs) {
          const company = data.find(c => c.id === pref.company_id);
          if (company) company.preferences = pref;
        }
      }
    }

    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

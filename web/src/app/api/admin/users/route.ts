import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, writeAuditLog, handleRouteError, pickFields } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendAdminUserProvisionedEmail } from '@/lib/email';
import { createNotification, notificationBuilders } from '@/lib/notify';

const USER_UPDATE_FIELDS = ['full_name', 'phone', 'job_title', 'role'];

// GET /api/admin/users — paginated user list (Platform Admin only)
// Query params: page, pageSize, search, typeFilter, orgFilter, sortBy
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '10', 10)));
    const search = url.searchParams.get('search')?.trim() || '';
    const typeFilter = url.searchParams.get('typeFilter') || 'all';
    const orgFilter = url.searchParams.get('orgFilter') || 'all';
    const sortBy = url.searchParams.get('sortBy') || 'newest';
    const from = (page - 1) * pageSize;

    const supabase = getSupabaseAdmin();

    // 1. Fetch all companies for filter dropdowns (lightweight)
    const { data: allCompanies } = await supabase
      .from('companies')
      .select('id, name, primary_role, is_platform_org')
      .is('deleted_at', null)
      .order('name');

    const orgTypes = [...new Set((allCompanies ?? []).map(c => c.primary_role).filter(Boolean))].sort();
    const orgNames = (allCompanies ?? []).map(c => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name));

    // 2. Build user query with server-side search + pagination
    let query = supabase
      .from('user_profiles')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Sort
    switch (sortBy) {
      case 'name_asc':  query = query.order('full_name', { ascending: true, nullsFirst: true }); break;
      case 'name_desc': query = query.order('full_name', { ascending: false, nullsFirst: true }); break;
      case 'oldest':    query = query.order('created_at', { ascending: true }); break;
      default:          query = query.order('created_at', { ascending: false }); break;
    }

    // Paginate
    query = query.range(from, from + pageSize - 1);

    const { data: profiles, error: profilesErr, count } = await query;

    if (profilesErr) {
      console.error('[Admin/Users] Query error:', profilesErr.message);
      return Response.json({ error: `Failed to fetch users: ${profilesErr.message}` }, { status: 500 });
    }

    const total = count ?? 0;
    const userIds = (profiles ?? []).map(p => p.id);

    if (userIds.length === 0) {
      return Response.json({ data: [], total, page, pageSize, orgTypes, orgNames });
    }

    // 3. Fetch memberships for this page only
    let memberQuery = supabase
      .from('company_members')
      .select('user_id, role, company_id, companies(name, primary_role, is_platform_org)')
      .is('deleted_at', null)
      .in('user_id', userIds);

    if (orgFilter !== 'all') {
      memberQuery = memberQuery.eq('company_id', orgFilter);
    }

    if (typeFilter !== 'all') {
      memberQuery = memberQuery.eq('companies.primary_role', typeFilter);
    }

    const { data: memberships } = await memberQuery;

    // Filter: if typeFilter/orgFilter is set, only keep users that have matching memberships
    const matchingUserIds = new Set((memberships ?? []).map(m => m.user_id));
    const filteredProfiles = (typeFilter !== 'all' || orgFilter !== 'all')
      ? (profiles ?? []).filter(p => matchingUserIds.has(p.id))
      : (profiles ?? []);

    const byUser = new Map<string, typeof memberships>();
    (memberships ?? []).forEach(m => {
      if (!byUser.has(m.user_id)) byUser.set(m.user_id, []);
      byUser.get(m.user_id)!.push(m);
    });

    const data = filteredProfiles.map(p => ({
      ...p,
      company_members: byUser.get(p.id) ?? [],
    }));

    // 4. Compute summary stats (from full dataset, not paginated)
    const { count: totalActive } = await supabase
      .from('user_profiles').select('*', { count: 'exact', head: true }).is('suspended_at', null);
    const { count: totalSuspended } = await supabase
      .from('user_profiles').select('*', { count: 'exact', head: true }).not('suspended_at', 'is', null);

    const now = new Date().toISOString();
    const { count: totalLocked } = await supabase
      .from('user_profiles').select('*', { count: 'exact', head: true }).not('locked_until', 'is', null).gt('locked_until', now);

    return Response.json({
      data,
      total: (typeFilter !== 'all' || orgFilter !== 'all') ? data.length : total,
      page,
      pageSize,
      stats: { totalUsers: total, totalActive: totalActive ?? 0, totalSuspended: totalSuspended ?? 0, totalLocked: totalLocked ?? 0 },
      orgTypes,
      orgNames,
    });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

// POST /api/admin/users — provision a new user (Platform Admin only)
// Creates: auth user + user_profile + company + membership
export async function POST(req: NextRequest) {
  try {
    const adminUser = await getAuthenticatedUser(req);
    if (!adminUser.is_platform_admin) return forbidden();

    const { email, role, password, fullName, orgName, companyId: provCompanyId } = await req.json();
    const actualPassword = password || (Math.random().toString(36).slice(-12) + 'A1!');

    if (!email?.trim()) return Response.json({ error: 'Email is required' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: 'Invalid email format' }, { status: 400 });

    const supabase = getSupabaseAdmin();

    // 1. Create Supabase Auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: actualPassword,
      email_confirm: true, // Admin-provisioned users are auto-confirmed
    });

    if (authErr || !authData.user) {
      console.error('[Admin/Users] Auth create error:', authErr?.message);
      return Response.json({ error: `Failed to create auth user: ${authErr?.message || 'Unknown error'}` }, { status: 500 });
    }

    const userId = authData.user.id;

    // 2. Create user profile
    const { error: profileErr } = await supabase.from('user_profiles').insert({
      id: userId,
      email,
      full_name: fullName || email.split('@')[0],
      onboarding_complete: true, // Admin-provisioned users skip onboarding
    });

    if (profileErr) {
      console.error('[Admin/Users] Profile insert error:', profileErr.message);
      return Response.json({ error: `Failed to create user profile: ${profileErr.message}` }, { status: 500 });
    }

    // 3. Link to existing company or create one
    let companyId: string | null = null;
    if (provCompanyId) {
      companyId = provCompanyId;
    } else if (orgName) {
      const typeToRole: Record<string, string> = {
        DEVELOPER: 'DEVELOPER',
        CAPITAL: 'CAPITAL_PARTNER',
        TECHNICAL: 'TECHNICAL_PARTNER',
        POWER_TRADER: 'POWER_TRADER',
        GRANT_PROVIDER: 'GRANT_PROVIDER',
      };
      const orgType = role === 'CAPITAL_PARTNER' ? 'CAPITAL'
        : role === 'TECHNICAL_PARTNER' ? 'TECHNICAL'
        : role === 'POWER_TRADER' ? 'POWER_TRADER'
        : role === 'GRANT_PROVIDER' ? 'GRANT_PROVIDER'
        : 'DEVELOPER';
      const primaryRole = typeToRole[orgType] || 'DEVELOPER';

      const { data: company, error: companyErr } = await supabase
        .from('companies')
        .insert({
          name: orgName,
          type: orgType,
          primary_role: primaryRole,
          status: 'verified',
          country: 'Not specified',
        })
        .select()
        .single();

      if (companyErr) {
        console.error('[Admin/Users] Company insert error:', companyErr.message);
        return Response.json({ error: `Failed to create organisation: ${companyErr.message}` }, { status: 500 });
      }
      companyId = company.id;
    }

    // 4. Create membership
    if (companyId) {
      const membershipRole = role === 'ADMIN' ? 'ADMIN' : 'OWNER';
      const { error: memberErr } = await supabase
        .from('company_members')
        .insert({ user_id: userId, company_id: companyId, role: membershipRole });

      if (memberErr) {
        console.error('[Admin/Users] Membership insert error:', memberErr.message);
        return Response.json({ error: `Failed to create membership: ${memberErr.message}` }, { status: 500 });
      }
    }

    // 5. Send email + in-app notification
    const userName = fullName || email.split('@')[0];
    await sendAdminUserProvisionedEmail({
      to: email,
      email,
      generatedPassword: password ? undefined : actualPassword,
    });

    await createNotification({
      userId,
      payload: notificationBuilders.systemAnnouncement({
        title: 'Welcome to Afri Connect',
        body: `Your account has been created by an administrator. ${orgName ? `You've been added to "${orgName}".` : ''}`,
      }),
    });

    await writeAuditLog({ userId: adminUser.id, action: 'USER_PROVISIONED', entityType: 'user_profiles', entityId: userId, after: { email, company_id: companyId }, req });

    return Response.json({
      data: {
        id: userId,
        email,
        company_id: companyId,
        generated_password: password ? undefined : actualPassword,
      },
    }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

// PATCH /api/admin/users — verify or update a user (Platform Admin only)
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const { userId, ...updates } = await req.json();
    const supabase = getSupabaseAdmin();
    const safeFields = pickFields(updates, USER_UPDATE_FIELDS);

    const { data, error } = await supabase
      .from('user_profiles').update(safeFields).eq('id', userId).select().single();

    if (error) {
      console.error('[Admin/Users] Update error:', error.message);
      return Response.json({ error: `Failed to update user: ${error.message}` }, { status: 500 });
    }
    await writeAuditLog({ userId: user.id, action: 'USER_UPDATED', entityType: 'user_profiles', entityId: userId, after: safeFields, req });
    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [
      usersCount,
      usersRecent,
      usersPrevious,
      pendingCount,
      projectsCount,
      projectsRecent,
      projectsPrevious,
      companiesCount,
      companiesRecent,
      companiesPrevious,
      capitalRecent,
      capitalPrevious,
      engagementsCount,
    ] = await Promise.all([
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo.toISOString()),
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', sixtyDaysAgo.toISOString()).lt('created_at', thirtyDaysAgo.toISOString()),
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('verification_status', 'PENDING'),
      supabase.from('projects').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('projects').select('id', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', thirtyDaysAgo.toISOString()),
      supabase.from('projects').select('id', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', sixtyDaysAgo.toISOString()).lt('created_at', thirtyDaysAgo.toISOString()),
      supabase.from('companies').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('companies').select('id', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', thirtyDaysAgo.toISOString()),
      supabase.from('companies').select('id', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', sixtyDaysAgo.toISOString()).lt('created_at', thirtyDaysAgo.toISOString()),
      supabase.from('projects').select('capital_required').is('deleted_at', null).gte('created_at', thirtyDaysAgo.toISOString()),
      supabase.from('projects').select('capital_required').is('deleted_at', null).gte('created_at', sixtyDaysAgo.toISOString()).lt('created_at', thirtyDaysAgo.toISOString()),
      supabase.from('engagements').select('id', { count: 'exact', head: true }),
    ]);

    const capitalRecentTotal = (capitalRecent.data ?? []).reduce((s: number, p: any) => s + (p.capital_required || 0), 0);
    const capitalPreviousTotal = (capitalPrevious.data ?? []).reduce((s: number, p: any) => s + (p.capital_required || 0), 0);

    function trend(current: number, previous: number) {
      if (previous === 0) return current > 0 ? { pct: 100, positive: true } : { pct: 0, positive: true };
      const pct = Math.round(((current - previous) / previous) * 100);
      return { pct: Math.abs(pct), positive: pct >= 0 };
    }

    return Response.json({
      data: {
        totalUsers: usersCount.count ?? 0,
        pendingVerifications: pendingCount.count ?? 0,
        totalProjects: projectsCount.count ?? 0,
        totalCompanies: companiesCount.count ?? 0,
        totalCapital: (capitalRecent.data ?? []).reduce((s: number, p: any) => s + (p.capital_required || 0), 0)
          + (capitalPrevious.data ?? []).reduce((s: number, p: any) => s + (p.capital_required || 0), 0),
        totalEngagements: engagementsCount.count ?? 0,
        trends: {
          users: trend(usersRecent.count ?? 0, usersPrevious.count ?? 0),
          projects: trend(projectsRecent.count ?? 0, projectsPrevious.count ?? 0),
          companies: trend(companiesRecent.count ?? 0, companiesPrevious.count ?? 0),
          capital: trend(capitalRecentTotal, capitalPreviousTotal),
        },
      },
    });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

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
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Rolling 6-month window (first day of each month, oldest → newest, last = current month)
    const monthStarts: Date[] = [];
    for (let i = 5; i >= 0; i--) {
      monthStarts.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
    }
    const windowStart = monthStarts[0];

    const [
      usersCount,
      usersRecent,
      usersPrevious,
      pendingCount,
      projectsCount,
      projectsRecent,
      projectsPrevious,
      pendingReviewCount,
      companiesCount,
      companiesRecent,
      companiesPrevious,
      capitalRecent,
      capitalPrevious,
      engagementsCount,
      roleRows,
      dauRows,
      wauRows,
      usersInWindow,
      projectsInWindow,
      engagementsInWindow,
    ] = await Promise.all([
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo.toISOString()),
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', sixtyDaysAgo.toISOString()).lt('created_at', thirtyDaysAgo.toISOString()),
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('verification_status', 'PENDING'),
      supabase.from('projects').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('projects').select('id', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', thirtyDaysAgo.toISOString()),
      supabase.from('projects').select('id', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', sixtyDaysAgo.toISOString()).lt('created_at', thirtyDaysAgo.toISOString()),
      supabase.from('projects').select('id', { count: 'exact', head: true }).is('deleted_at', null).in('status', ['scoring', 'pending_live']),
      supabase.from('companies').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('companies').select('id', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', thirtyDaysAgo.toISOString()),
      supabase.from('companies').select('id', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', sixtyDaysAgo.toISOString()).lt('created_at', thirtyDaysAgo.toISOString()),
      supabase.from('projects').select('capital_required').is('deleted_at', null).gte('created_at', thirtyDaysAgo.toISOString()),
      supabase.from('projects').select('capital_required').is('deleted_at', null).gte('created_at', sixtyDaysAgo.toISOString()).lt('created_at', thirtyDaysAgo.toISOString()),
      supabase.from('engagements').select('id', { count: 'exact', head: true }),
      supabase.from('company_members').select('companies(primary_role)').not('companies', 'is', null),
      supabase.from('audit_logs').select('user_id').gte('timestamp', oneDayAgo.toISOString()).not('user_id', 'is', null),
      supabase.from('audit_logs').select('user_id').gte('timestamp', sevenDaysAgo.toISOString()).not('user_id', 'is', null),
      supabase.from('user_profiles').select('created_at').gte('created_at', windowStart.toISOString()),
      supabase.from('projects').select('created_at').is('deleted_at', null).gte('created_at', windowStart.toISOString()),
      supabase.from('engagements').select('created_at').gte('created_at', windowStart.toISOString()),
    ]);

    const capitalRecentTotal = (capitalRecent.data ?? []).reduce((s: number, p: any) => s + (p.capital_required || 0), 0);
    const capitalPreviousTotal = (capitalPrevious.data ?? []).reduce((s: number, p: any) => s + (p.capital_required || 0), 0);

    function trend(current: number, previous: number) {
      if (previous === 0) return current > 0 ? { pct: 100, positive: true } : { pct: 0, positive: true };
      const pct = Math.round(((current - previous) / previous) * 100);
      return { pct: Math.abs(pct), positive: pct >= 0 };
    }

    // Role breakdown — from company primary_role via company_members
    const roleCounts: Record<string, number> = {};
    for (const row of (roleRows.data ?? [])) {
      const r = (row as any).companies?.primary_role as string | undefined;
      if (r) roleCounts[r] = (roleCounts[r] ?? 0) + 1;
    }

    // Active users — unique user_ids
    const dau = new Set((dauRows.data ?? []).map((r: any) => r.user_id)).size;
    const wau = new Set((wauRows.data ?? []).map((r: any) => r.user_id)).size;

    // Monthly growth — REAL cumulative counts at each month end.
    // cumulative(end of month N) = total rows − rows created after that month end.
    const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    function cumulativeAtMonthEnds(total: number, rows: { created_at: string }[]): number[] {
      return monthStarts.map((start, i) => {
        const monthEnd = i < monthStarts.length - 1 ? monthStarts[i + 1] : new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const createdAfter = rows.filter((r) => new Date(r.created_at) >= monthEnd).length;
        return Math.max(0, total - createdAfter);
      });
    }
    const usersCumulative = cumulativeAtMonthEnds(usersCount.count ?? 0, (usersInWindow.data ?? []) as any);
    const projectsCumulative = cumulativeAtMonthEnds(projectsCount.count ?? 0, (projectsInWindow.data ?? []) as any);
    const engagementsCumulative = cumulativeAtMonthEnds(engagementsCount.count ?? 0, (engagementsInWindow.data ?? []) as any);
    const monthlyGrowth = monthStarts.map((start, i) => ({
      month: MONTH_LABELS[start.getMonth()],
      users: usersCumulative[i],
      projects: projectsCumulative[i],
      engagements: engagementsCumulative[i],
    }));

    return Response.json({
      data: {
        totalUsers: usersCount.count ?? 0,
        pendingVerifications: pendingCount.count ?? 0,
        pendingReviewCount: pendingReviewCount.count ?? 0,
        totalProjects: projectsCount.count ?? 0,
        totalCompanies: companiesCount.count ?? 0,
        totalCapital: (capitalRecent.data ?? []).reduce((s: number, p: any) => s + (p.capital_required || 0), 0)
          + (capitalPrevious.data ?? []).reduce((s: number, p: any) => s + (p.capital_required || 0), 0),
        totalEngagements: engagementsCount.count ?? 0,
        roleBreakdown: roleCounts,
        activeUsers: { dau, wau },
        monthlyGrowth,
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

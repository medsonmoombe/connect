import { NextRequest } from 'next/server';
import { getAuthenticatedUser, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

function ok(data: unknown) {
  return Response.json({ success: true, data });
}
function fail(status: number, code: string, message: string) {
  return Response.json({ success: false, error: { code, message } }, { status });
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return fail(403, 'FORBIDDEN', 'Platform admin only');

    const url = new URL(req.url);
    const months = Math.min(Number(url.searchParams.get('months') ?? 6), 24);

    const sb = getSupabaseAdmin();

    const [{ data: monthly }, { data: topProjects }, { data: budget }] = await Promise.all([
      sb
        .from('ai_spend_monthly')
        .select('*')
        .order('month', { ascending: false })
        .limit(months),
      sb
        .from('ai_top_projects_monthly')
        .select('*, projects(name)')
        .gte('month', startOfMonth().toISOString())
        .order('cost_usd', { ascending: false })
        .limit(10),
      sb
        .from('ai_provider_config')
        .select('platform_monthly_budget_usd')
        .eq('id', 1)
        .single(),
    ]);

    // Current month spend
    const { data: currentMonthRows } = await sb
      .from('ai_usage_logs')
      .select('estimated_cost')
      .gte('created_at', startOfMonth().toISOString());

    const spentThisMonth = (currentMonthRows ?? []).reduce(
      (s, r) => s + Number(r.estimated_cost),
      0,
    );

    return ok({
      monthly,
      topProjects,
      budgetUsd: Number(budget?.platform_monthly_budget_usd ?? 0),
      spentThisMonthUsd: spentThisMonth,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}

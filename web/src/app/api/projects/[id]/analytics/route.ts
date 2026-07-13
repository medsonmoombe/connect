import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export type FunnelStage = {
  count: number;
  rate: number; // conversion rate from previous stage (0–100)
};

export type ProjectAnalyticsResponse = {
  views: {
    total: number;
    unique: number;
    dataroom: number;
  };
  velocity: { date: string; count: number }[]; // last 7 days, gaps filled with 0
  matches: {
    total: number;
    capital: number;
    technical: number;
  };
  funnel: {
    intro:        FunnelStage;
    nda:          FunnelStage;
    dueDiligence: FunnelStage;
    termSheet:    FunnelStage;
    closed:       FunnelStage;
  };
};

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    await getAuthenticatedUser(req);
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    // Single parallel round-trip — all data fetched simultaneously
    const [analyticsRow, dailyRows, engagementRows] = await Promise.all([
      supabase
        .from('project_analytics')
        .select('total_views, unique_viewers, dataroom_accesses, capital_matches, technical_matches')
        .eq('project_id', id)
        .single(),

      supabase
        .from('project_views_daily')
        .select('view_date, view_count')
        .eq('project_id', id)
        .gte('view_date', sevenDaysAgoStr)
        .order('view_date', { ascending: true }),

      supabase
        .from('engagements')
        .select('status')
        .eq('project_id', id),
    ]);

    // ── Views ────────────────────────────────────────────────
    const a = analyticsRow.data;
    const views = {
      total:    a?.total_views       ?? 0,
      unique:   a?.unique_viewers    ?? 0,
      dataroom: a?.dataroom_accesses ?? 0,
    };

    // ── Velocity: fill missing days with 0 ───────────────────
    const dailyMap = new Map<string, number>();
    for (const row of dailyRows.data ?? []) {
      dailyMap.set(row.view_date, row.view_count);
    }
    const velocity: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      velocity.push({ date: key, count: dailyMap.get(key) ?? 0 });
    }

    // ── Matches ──────────────────────────────────────────────
    const matches = {
      capital:   a?.capital_matches   ?? 0,
      technical: a?.technical_matches ?? 0,
      total:     (a?.capital_matches ?? 0) + (a?.technical_matches ?? 0),
    };

    // ── Funnel: server-side computation from engagement statuses
    // PRD engagement states: INTRO_SENT → INTRO_ACCEPTED → NDA_SIGNED →
    //   DUE_DILIGENCE → TERM_SHEET → CONTRACT_SIGNED → CLOSED
    const engagements = engagementRows.data ?? [];
    const NDA_STATES         = ['NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED'];
    const DUE_DILIGENCE_STATES = ['DUE_DILIGENCE', 'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED'];
    const TERM_SHEET_STATES  = ['TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED'];
    const CLOSED_STATES      = ['CLOSED', 'CAPITAL_COMMITTED'];

    const introCount        = engagements.length;
    const ndaCount          = engagements.filter(e => NDA_STATES.includes(e.status)).length;
    const dueDiligenceCount = engagements.filter(e => DUE_DILIGENCE_STATES.includes(e.status)).length;
    const termSheetCount    = engagements.filter(e => TERM_SHEET_STATES.includes(e.status)).length;
    const closedCount       = engagements.filter(e => CLOSED_STATES.includes(e.status)).length;

    const rate = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100));

    const funnel = {
      intro:        { count: introCount,        rate: 100 },
      nda:          { count: ndaCount,          rate: rate(ndaCount,          introCount) },
      dueDiligence: { count: dueDiligenceCount, rate: rate(dueDiligenceCount, ndaCount) },
      termSheet:    { count: termSheetCount,    rate: rate(termSheetCount,    dueDiligenceCount) },
      closed:       { count: closedCount,       rate: rate(closedCount,       termSheetCount) },
    };

    const response: ProjectAnalyticsResponse = { views, velocity, matches, funnel };
    return Response.json({ success: true, data: response });

  } catch (e: any) {
    return handleRouteError(e);
  }
}

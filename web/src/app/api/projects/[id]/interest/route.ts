import { NextRequest } from 'next/server';
import { getAuthenticatedUser, handleRouteError, serverError, badRequest } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { InterestSignalType } from '@/types';

type Params = { params: Promise<{ id: string }> };

const VALID_SIGNALS: InterestSignalType[] = [
  'express_interest', 'bookmark', 'view', 'dataroom_open',
  'document_download', 'message_sent', 'engagement_created',
];

/** Weight per signal type for the Interest Index computation */
const SIGNAL_WEIGHTS: Record<InterestSignalType, number> = {
  express_interest: 30,
  engagement_created: 25,
  document_download: 15,
  message_sent: 15,
  dataroom_open: 10,
  bookmark: 5,
  view: 1,
};

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: projectId } = await params;
    const body = await req.json();
    const signalType = body.signal_type as InterestSignalType;

    if (!signalType || !VALID_SIGNALS.includes(signalType)) {
      return badRequest(`Invalid signal_type. Must be one of: ${VALID_SIGNALS.join(', ')}`);
    }

    const supabase = getSupabaseAdmin();

    // Verify the project exists
    const { data: project } = await supabase
      .from('projects')
      .select('id, developer_id')
      .eq('id', projectId)
      .single();

    if (!project) return badRequest('Project not found');

    // Don't track signals from the project's own developer
    if (project.developer_id === user.company_id) {
      return Response.json({ data: { tracked: false, reason: 'own_project' } });
    }

    // Insert signal (ON CONFLICT for unique constraint types)
    const { error } = await supabase
      .from('project_interest_signals')
      .upsert({
        project_id: projectId,
        user_id: user.id,
        signal_type: signalType,
        metadata: body.metadata ?? {},
      }, {
        onConflict: 'project_id,user_id,signal_type',
        ignoreDuplicates: signalType === 'bookmark' || signalType === 'express_interest',
      });

    if (error) {
      // Unique violation means already tracked — that's fine
      if (error.code === '23505') {
        return Response.json({ data: { tracked: false, reason: 'duplicate' } });
      }
      console.error('[Interest] Insert error:', error.message);
      return serverError();
    }

    // Recompute interest score in the background (non-blocking)
    recomputeInterestScore(projectId).catch(e =>
      console.error('[Interest] Score recompute failed:', e)
    );

    return Response.json({ data: { tracked: true, signal_type: signalType } }, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}

/** GET: Return the computed interest score for this project */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await getAuthenticatedUser(_req);
    const { id: projectId } = await params;
    const supabase = getSupabaseAdmin();

    // Fetch signal counts
    const { data: signals } = await supabase
      .from('project_interest_signals')
      .select('signal_type, user_id, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (!signals || signals.length === 0) {
      return Response.json({
        data: {
          projectId,
          score: 0,
          breakdown: { express_interest: 0, bookmarks: 0, views: 0, dataroom_opens: 0, document_downloads: 0, messages: 0, engagements: 0 },
          trend: [],
          updatedAt: new Date().toISOString(),
        },
      });
    }

    // Count unique users per signal type
    const uniqueByType = new Map<string, Set<string>>();
    for (const s of signals) {
      if (!uniqueByType.has(s.signal_type)) uniqueByType.set(s.signal_type, new Set());
      uniqueByType.get(s.signal_type)!.add(s.user_id);
    }

    const breakdown = {
      express_interest: uniqueByType.get('express_interest')?.size ?? 0,
      bookmarks: uniqueByType.get('bookmark')?.size ?? 0,
      views: uniqueByType.get('view')?.size ?? 0,
      dataroom_opens: uniqueByType.get('dataroom_open')?.size ?? 0,
      document_downloads: uniqueByType.get('document_download')?.size ?? 0,
      messages: uniqueByType.get('message_sent')?.size ?? 0,
      engagements: uniqueByType.get('engagement_created')?.size ?? 0,
    };

    // Compute weighted score (0-100)
    const totalWeightedScore =
      breakdown.express_interest * SIGNAL_WEIGHTS.express_interest +
      breakdown.engagements * SIGNAL_WEIGHTS.engagement_created +
      breakdown.document_downloads * SIGNAL_WEIGHTS.document_download +
      breakdown.messages * SIGNAL_WEIGHTS.message_sent +
      breakdown.dataroom_opens * SIGNAL_WEIGHTS.dataroom_open +
      breakdown.bookmarks * SIGNAL_WEIGHTS.bookmark +
      breakdown.views * SIGNAL_WEIGHTS.view;

    // Normalize: cap at 100 (every 1 point of raw score = ~1.3 to reach 100 at ~75 raw)
    const score = Math.min(100, Math.round(totalWeightedScore * 1.33));

    // 7-day trend: group by day
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const dailyCounts = new Map<string, number>();
    for (const s of signals) {
      const day = s.created_at.split('T')[0];
      if (new Date(day) >= sevenDaysAgo) {
        dailyCounts.set(day, (dailyCounts.get(day) ?? 0) + 1);
      }
    }
    const trend: { date: string; score: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      trend.push({ date: key, score: dailyCounts.get(key) ?? 0 });
    }

    return Response.json({
      data: {
        projectId,
        score,
        breakdown,
        trend,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    return handleRouteError(e);
  }
}

/** Recompute and cache the interest score on the projects table */
async function recomputeInterestScore(projectId: string) {
  const supabase = getSupabaseAdmin();

  const { data: signals } = await supabase
    .from('project_interest_signals')
    .select('signal_type, user_id')
    .eq('project_id', projectId);

  if (!signals) return;

  const uniqueByType = new Map<string, Set<string>>();
  for (const s of signals) {
    if (!uniqueByType.has(s.signal_type)) uniqueByType.set(s.signal_type, new Set());
    uniqueByType.get(s.signal_type)!.add(s.user_id);
  }

  const breakdown = {
    express_interest: uniqueByType.get('express_interest')?.size ?? 0,
    engagements: uniqueByType.get('engagement_created')?.size ?? 0,
    document_downloads: uniqueByType.get('document_download')?.size ?? 0,
    messages: uniqueByType.get('message_sent')?.size ?? 0,
    dataroom_opens: uniqueByType.get('dataroom_open')?.size ?? 0,
    bookmarks: uniqueByType.get('bookmark')?.size ?? 0,
    views: uniqueByType.get('view')?.size ?? 0,
  };

  const totalWeightedScore =
    breakdown.express_interest * SIGNAL_WEIGHTS.express_interest +
    breakdown.engagements * SIGNAL_WEIGHTS.engagement_created +
    breakdown.document_downloads * SIGNAL_WEIGHTS.document_download +
    breakdown.messages * SIGNAL_WEIGHTS.message_sent +
    breakdown.dataroom_opens * SIGNAL_WEIGHTS.dataroom_open +
    breakdown.bookmarks * SIGNAL_WEIGHTS.bookmark +
    breakdown.views * SIGNAL_WEIGHTS.view;

  const score = Math.min(100, Math.round(totalWeightedScore * 1.33));

  await supabase
    .from('projects')
    .update({
      investor_interest_score: score,
      investor_interest_updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);
}

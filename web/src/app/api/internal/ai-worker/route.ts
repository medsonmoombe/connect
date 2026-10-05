import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { runProjectAnalysis } from '@/lib/ai/orchestrator';

function ok(data: unknown) {
  return Response.json({ success: true, data });
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const workerSecret = process.env.AI_WORKER_SECRET;

  if (!workerSecret || authHeader !== `Bearer ${workerSecret}`) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid worker secret' } },
      { status: 401 },
    );
  }

  const sb = getSupabaseAdmin();

  // Enqueue retries for scoring_retry projects (max 3 total attempts)
  try {
    await sb.rpc('enqueue_scoring_retries');
  } catch {
    // best-effort — non-fatal if the function is unavailable
  }

  // Claim up to 3 jobs atomically
  const { data: jobs } = await sb.rpc('claim_ai_jobs', {
    p_worker: crypto.randomUUID(),
    p_limit: 3,
  });

  const results = await Promise.allSettled(
    (jobs ?? []).map((j: { id: string }) => runProjectAnalysis(j.id)),
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length) {
    console.error(
      '[AI Worker] Failed jobs:',
      failed.map((r) => (r as PromiseRejectedResult).reason?.message),
    );
  }

  return ok({
    processed: jobs?.length ?? 0,
    failed: failed.length,
  });
}

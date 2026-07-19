import { NextRequest } from 'next/server';
import { activateAndNotify } from '@/lib/activation-notify';

/**
 * POST /api/projects/[id]/activate
 * Called by pg_cron via pg_net to activate a project and send notifications.
 * Uses service role auth (no user session needed).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Verify the caller is authorized (service role or internal)
    const authHeader = req.headers.get('authorization');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!authHeader || !serviceKey || !authHeader.includes(serviceKey)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { activated } = await activateAndNotify(id);

    return Response.json({ activated });
  } catch (e: any) {
    console.error('[Activate] Error:', e.message);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { invalidateAIConfigCache } from '@/lib/ai/config';
import { writeAuditLog } from '@/lib/api-helpers';

function ok(data: unknown) {
  return Response.json({ success: true, data });
}
function fail(status: number, code: string, message: string) {
  return Response.json({ success: false, error: { code, message } }, { status });
}

const patchSchema = z.object({
  active_provider: z.enum(['mistral', 'gemini', 'deepseek']).optional(),
  active_model: z.string().min(1).optional(),
  prompt_version: z.number().int().min(1).optional(),
  confidence_threshold: z.number().min(0.5).max(0.95).optional(),
  max_chars_per_doc: z.number().int().min(5000).max(200_000).optional(),
  platform_monthly_budget_usd: z.number().min(0).max(100_000).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return fail(403, 'FORBIDDEN', 'Platform admin only');

    const sb = getSupabaseAdmin();
    const [{ data: config }, { data: catalog }] = await Promise.all([
      sb.from('ai_provider_config').select('*').eq('id', 1).single(),
      sb.from('ai_model_catalog').select('*').order('provider').order('enabled', { ascending: false }),
    ]);

    return ok({ config, catalog });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return fail(403, 'FORBIDDEN', 'Platform admin only');

    const body = patchSchema.parse(await req.json());
    const sb = getSupabaseAdmin();

    const { data: current } = await sb
      .from('ai_provider_config')
      .select('*')
      .eq('id', 1)
      .single();

    // Validate the model exists and is enabled for the chosen provider
    const provider = body.active_provider ?? current?.active_provider;
    const model = body.active_model ?? current?.active_model;

    const { data: mc } = await sb
      .from('ai_model_catalog')
      .select('enabled')
      .eq('provider', provider)
      .eq('model', model)
      .maybeSingle();

    if (!mc?.enabled) {
      return fail(422, 'INVALID_MODEL', `${model} is not enabled for provider "${provider}"`);
    }

    const { data: updated, error } = await sb
      .from('ai_provider_config')
      .update({ ...body, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .select()
      .single();

    if (error) return fail(500, 'DB_ERROR', error.message);

    invalidateAIConfigCache();

    await writeAuditLog({
      userId: user.id,
      action: 'AI_CONFIG_CHANGED',
      entityType: 'ai_provider_config',
      entityId: '1',
      before: current,
      after: updated,
      req,
    });

    return ok(updated);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return fail(400, 'VALIDATION', e.errors.map((err) => err.message).join(', '));
    }
    return handleRouteError(e);
  }
}

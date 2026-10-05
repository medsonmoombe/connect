import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, serverError, handleRouteError, writeAuditLog } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

// GET /api/admin/settings — fetch platform stats + MFA overview + AI config
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden('Only platform administrators can view platform settings. Contact your platform support team if you need access.');

    const admin = getSupabaseAdmin();

    const [totalUsers, mfaEnabled, totalOrgs, verifiedOrgs, pendingVerifications] = await Promise.all([
      admin.from('user_profiles').select('id', { count: 'exact', head: true }),
      admin.from('user_profiles').select('id', { count: 'exact', head: true }).eq('mfa_enabled', true),
      admin.from('companies').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      admin.from('companies').select('id', { count: 'exact', head: true }).eq('status', 'verified').is('deleted_at', null),
      admin.from('companies').select('id', { count: 'exact', head: true }).eq('status', 'pending_verification').is('deleted_at', null),
    ]);

    // Fetch AI analysis settings
    const { data: aiSettings } = await admin
      .from('platform_settings')
      .select('value')
      .eq('key', 'ai_analysis')
      .maybeSingle();

    return Response.json({
      stats: {
        totalUsers: totalUsers.count ?? 0,
        mfaEnabled: mfaEnabled.count ?? 0,
        totalOrgs: totalOrgs.count ?? 0,
        verifiedOrgs: verifiedOrgs.count ?? 0,
        pendingVerifications: pendingVerifications.count ?? 0,
      },
      aiSettings: aiSettings?.value ?? { auto_trigger: false, weights: { regulatory: 40, financial: 35, developer: 25 } },
    });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

// POST /api/admin/settings — persist AI config (platform admin only)
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const body = await req.json();
    const { auto_trigger, weights } = body;

    if (auto_trigger === undefined && weights === undefined) {
      return Response.json({ error: 'No settings provided' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Fetch current value
    const { data: existing } = await admin
      .from('platform_settings')
      .select('value')
      .eq('key', 'ai_analysis')
      .maybeSingle();

    const current = existing?.value ?? { auto_trigger: false, weights: { regulatory: 40, financial: 35, developer: 25 } };

    const updatedValue = {
      ...current,
      ...(auto_trigger !== undefined && { auto_trigger: !!auto_trigger }),
      ...(weights !== undefined && {
        weights: {
          regulatory: Math.max(0, Math.min(100, Number(weights.regulatory ?? current.weights.regulatory))),
          financial: Math.max(0, Math.min(100, Number(weights.financial ?? current.weights.financial))),
          developer: Math.max(0, Math.min(100, Number(weights.developer ?? current.weights.developer))),
        },
      }),
    };

    const { error } = await admin
      .from('platform_settings')
      .upsert({
        key: 'ai_analysis',
        value: updatedValue,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (error) {
      console.error('[AdminSettings] Upsert error:', error.message);
      return serverError();
    }

    await writeAuditLog({
      userId: user.id,
      action: 'PLATFORM_SETTINGS_UPDATED',
      entityType: 'platform_settings',
      entityId: 'ai_analysis',
      after: updatedValue,
      req,
      blocking: true,
    });

    return Response.json({ success: true, aiSettings: updatedValue });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

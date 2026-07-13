import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

// GET /api/partners?type=capital|technical
// POST /api/partners
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'capital' | 'technical'
    const table = type === 'technical' ? 'technical_partners' : 'capital_partners';

    const { data, error } = await supabase.from(table).select('*, company:companies(*)');
    if (error) {
      console.error('[Partners] Query error:', error.message);
      return serverError();
    }
    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json();
    const supabase = getSupabaseAdmin();
    const table = body.type === 'technical' ? 'technical_partners' : 'capital_partners';
    const { type, ...rest } = body;

    const { data, error } = await supabase.from(table).upsert({ ...rest, company_id: user.company_id }).select().single();
    if (error) {
      console.error('[Partners] Upsert error:', error.message);
      return serverError();
    }
    await writeAuditLog({ userId: user.id, action: 'PARTNER_UPSERTED', entityType: table, entityId: data.id, after: rest, req });
    return Response.json({ data }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

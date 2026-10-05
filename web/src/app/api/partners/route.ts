import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, badRequest, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

// GET /api/partners?type=capital|technical&id=uuid
// POST /api/partners
// PATCH /api/partners?type=capital|technical&id=uuid
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'capital' | 'technical'
    const id = searchParams.get('id');
    const table = type === 'technical' ? 'technical_partners' : 'capital_partners';

    let query = supabase.from(table).select('*, company:companies(*)');
    if (id) query = query.eq('id', id);

    const { data, error } = await query.maybeSingle();
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

    const { data, error } = await supabase
      .from(table)
      .upsert({ ...rest, company_id: user.company_id }, { onConflict: 'company_id' })
      .select()
      .single();
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

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json();
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');
    const table = type === 'technical' ? 'technical_partners' : 'capital_partners';

    if (!id) return badRequest('id is required');

    const { type: _t, company_id, id: _id, ...updates } = body;

    const { data, error } = await supabase
      .from(table)
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error('[Partners] Update error:', error.message);
      return serverError();
    }
    await writeAuditLog({ userId: user.id, action: 'PARTNER_UPDATED', entityType: table, entityId: id, after: updates, req });

    // Re-run matching engine in background when preferences change (PRD §5.2)
    // Scoped to this specific partner using explicit partner_id + service key.
    const preferenceFields = ['min_ticket_size', 'max_ticket_size', 'risk_tolerance', 'governance_preference', 'sector_focus', 'geographic_focus', 'preferred_project_stage', 'preferred_capital_structure'];
    if (preferenceFields.some(f => f in updates)) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      fetch(`${baseUrl}/api/matching/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(serviceKey ? { 'Authorization': `Bearer ${serviceKey}` } : {}),
        },
        body: JSON.stringify({ partner_id: id, partner_type: table }),
      }).catch(() => {});
    }

    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

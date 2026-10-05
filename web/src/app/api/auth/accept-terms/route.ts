import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, serverError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

// POST /api/auth/accept-terms
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const admin = getSupabaseAdmin();

    const { error } = await admin
      .from('user_profiles')
      .update({ accepted_terms_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) {
      console.error('[accept-terms] update error:', error.message);
      return serverError();
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return serverError();
  }
}

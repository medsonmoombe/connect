import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { badRequest, serverError } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!token) return badRequest('token is required');

    const admin = getSupabaseAdmin();
    const { data: invite, error } = await admin
      .from('setup_invites')
      .select('id, email, expires_at')
      .is('deleted_at', null)
      .eq('token', token)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !invite) {
      return Response.json({ valid: false, error: 'Invalid or expired invite' }, { status: 200 });
    }

    return Response.json({ valid: true, email: invite.email ?? null, expiresAt: invite.expires_at });
  } catch {
    return serverError();
  }
}

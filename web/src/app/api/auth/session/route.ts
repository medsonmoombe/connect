import { getSupabaseServer, getSupabaseAdmin, fetchProfileWithMemberships } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ user: null });

    const admin = getSupabaseAdmin();
    const profile = await fetchProfileWithMemberships(admin, user.id);

    const membership = (profile as any)?.company_members?.[0];
    const company = membership?.companies;
    const orgDeactivated = company?.status === 'deactivated';

    // Check if account is locked
    let locked = false;
    let lockedUntil: string | null = null;
    if (profile?.locked_until) {
      const lockExpiry = new Date(profile.locked_until);
      if (lockExpiry > new Date()) {
        locked = true;
        lockedUntil = profile.locked_until;
      } else {
        // Lock expired — clear it
        await admin
          .from('user_profiles')
          .update({ locked_until: null, locked_by: null, lock_reason: null })
          .eq('id', profile.id);
      }
    }

    const cookieStore = await cookies();
    const mfaVerified = cookieStore.get('mfa_verified')?.value === '1';

    // Check password expiry
    let password_expired = false;
    let password_expired_days = 0;
    const passwordExpiryDays = company?.password_expiry_days ?? 0;
    if (passwordExpiryDays > 0 && profile?.password_changed_at) {
      const changedAt = new Date(profile.password_changed_at).getTime();
      const now = Date.now();
      password_expired_days = Math.floor((now - changedAt) / (1000 * 60 * 60 * 24));
      if (password_expired_days > passwordExpiryDays) {
        password_expired = true;
      }
    }

    return Response.json({
      user: profile,
      suspended: !!profile?.suspended_at,
      org_deactivated: orgDeactivated,
      locked,
      locked_until: lockedUntil,
      mfa_verified: mfaVerified,
      password_expired,
      password_expired_days,
    });
  } catch (e) {
    console.error('[Session] Error:', e);
    return Response.json({ user: null });
  }
}

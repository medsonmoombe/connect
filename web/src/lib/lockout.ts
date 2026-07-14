import { getSupabaseAdmin } from './supabase-server';
import { ATTEMPT_WINDOW_MINUTES, LOCKOUT_THRESHOLD, LOCKOUT_DURATION_MINUTES } from './mfa';

const LOCKOUT_DURATION_MS = LOCKOUT_DURATION_MINUTES * 60 * 1000;

export interface LockoutInfo {
  locked: boolean;
  lockedUntil?: string;
  attemptsRemaining?: number;
}

/**
 * Record a login attempt. Returns lockout info if the account should be locked.
 */
export async function recordLoginAttempt(params: {
  email: string;
  userId?: string;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
}): Promise<LockoutInfo> {
  const admin = getSupabaseAdmin();

  // Record the attempt
  await admin.from('login_attempts').insert({
    email: params.email.toLowerCase(),
    user_id: params.userId ?? null,
    success: params.success,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
  });

  if (params.success) {
    return { locked: false };
  }

  // Check recent failed attempts within the window
  const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count } = await admin
    .from('login_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('email', params.email.toLowerCase())
    .eq('success', false)
    .gte('created_at', windowStart);

  const failedCount = count ?? 0;
  const attemptsRemaining = Math.max(0, LOCKOUT_THRESHOLD - failedCount);

  if (failedCount >= LOCKOUT_THRESHOLD) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();

    // Lock the user profile if we have a userId
    if (params.userId) {
      await admin
        .from('user_profiles')
        .update({ locked_until: lockedUntil, lock_reason: 'Too many failed login attempts' })
        .eq('id', params.userId);
    }

    return { locked: true, lockedUntil, attemptsRemaining: 0 };
  }

  return { locked: false, attemptsRemaining };
}

/**
 * Check if a user account is currently locked.
 */
export async function checkLockout(email: string): Promise<LockoutInfo> {
  const admin = getSupabaseAdmin();

  // Find the user by email
  const { data: profile } = await admin
    .from('user_profiles')
    .select('id, locked_until')
    .eq('email', email.toLowerCase())
    .single();

  if (!profile?.locked_until) {
    return { locked: false };
  }

  const lockedUntil = new Date(profile.locked_until);
  if (lockedUntil > new Date()) {
    return {
      locked: true,
      lockedUntil: profile.locked_until,
      attemptsRemaining: 0,
    };
  }

  // Lock has expired — clear it
  await admin
    .from('user_profiles')
    .update({ locked_until: null, locked_by: null, lock_reason: null })
    .eq('id', profile.id);

  return { locked: false };
}

/**
 * Manually unlock a user account (admin action).
 */
export async function unlockAccount(userId: string, unlockedBy: string): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin
    .from('user_profiles')
    .update({ locked_until: null, locked_by: null, lock_reason: null })
    .eq('id', userId);

  // Clear recent failed attempts
  const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000).toISOString();
  await admin
    .from('login_attempts')
    .delete()
    .eq('user_id', userId)
    .eq('success', false)
    .gte('created_at', windowStart);
}

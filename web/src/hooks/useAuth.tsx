'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';

export interface AppUser {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: string;
  is_platform_admin: boolean;
  is_authority_org?: boolean;
  is_authority_user?: boolean;
  is_authority_admin?: boolean;
  is_authority_reviewer?: boolean;
  is_management_user?: boolean;
  /** Raw membership role: 'OWNER' | 'ADMIN' | 'MEMBER' Ã¢â‚¬â€ null for platform admins */
  org_member_role: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
  /** True if membership.role is OWNER or ADMIN on a non-platform org */
  is_org_admin: boolean;
  company_id?: string;
  company_name?: string;
  verification_status: string;
  admin_note?: string;
  phone?: string;
  job_title?: string;
  mfa_enabled: boolean;
  org_mfa_enforced: boolean;
  onboarding_complete: boolean;
  registration_type?: string;
  accepted_terms_at?: string | null;
  company_members?: { role: string; company_id: string; companies: any }[];
  created_at?: string;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  mfa_verified: boolean;
  signIn: (email: string, password: string) => Promise<AppUser | null>;
  signUp: (email: string, password: string, fullName: string, inviteToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setMfaVerified: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function buildUser(profile: any): AppUser {
  const membership = profile.company_members?.[0];
  const company = membership?.companies;

  const isPlatformAdmin = membership?.role === 'ADMIN' && company?.is_platform_org === true;
  const isAuthorityOrg = company?.is_authority_org === true || company?.primary_role === 'AUTHORITY';
  const isAuthorityAdmin = !isPlatformAdmin && isAuthorityOrg && (membership?.role === 'OWNER' || membership?.role === 'ADMIN');
  const isAuthorityReviewer = !isPlatformAdmin && isAuthorityOrg && membership?.role === 'MEMBER';
  const isAuthorityUser = isAuthorityAdmin || isAuthorityReviewer;
  // Administering your OWN organisation (invite/manage team, edit profile).
  // True for authority admins too — managing the regulator office's team is an
  // org-level right, distinct from platform-only powers (is_platform_admin).
  const isOrgAdmin = membership?.role === 'OWNER' || membership?.role === 'ADMIN';

  const role = isPlatformAdmin
    ? 'ADMIN'
    : isAuthorityAdmin
      ? 'AUTHORITY_ADMIN'
      : isAuthorityReviewer
        ? 'AUTHORITY_REVIEWER'
        : isOrgAdmin
          ? (company?.primary_role ?? 'DEVELOPER')
          : membership?.role === 'ADMIN'
            ? 'ADMIN'
            : company?.primary_role ?? 'DEVELOPER';

  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
    phone: profile.phone ?? undefined,
    job_title: profile.job_title ?? undefined,
    role,
    is_platform_admin: isPlatformAdmin,
    is_authority_org: isAuthorityOrg,
    is_authority_user: isAuthorityUser,
    is_authority_admin: isAuthorityAdmin,
    is_authority_reviewer: isAuthorityReviewer,
    is_management_user: isPlatformAdmin || isAuthorityUser,
    org_member_role: isPlatformAdmin ? null : (membership?.role ?? null),
    is_org_admin: isOrgAdmin,
    company_id: membership?.company_id,
    company_name: company?.name ?? undefined,
    verification_status: company?.status ?? 'pending_verification',
    admin_note: company?.admin_note ?? undefined,
    mfa_enabled: !!profile.mfa_enabled,
    org_mfa_enforced: !!company?.mfa_enforced,
    onboarding_complete: profile.onboarding_complete,
    registration_type: profile.registration_type ?? undefined,
    accepted_terms_at: profile.accepted_terms_at ?? null,
    company_members: profile.company_members,
    created_at: profile.created_at,
  };
}

const SESSION_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function forceLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  // Carry the reason so the login page can explain why the session ended
  window.location.href = '/login?notice=session_expired';
}

/**
 * Parse a fetch response as JSON, returning null instead of throwing when the
 * server answers with non-JSON (HTML error page, dev-server hiccup, 502, …).
 * Prevents cryptic "Unexpected token '<'" crashes in the auth flows.
 */
async function readJsonSafely(res: Response): Promise<any | null> {
  try {
    const type = res.headers.get('content-type') || '';
    if (!type.includes('application/json')) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaVerified, setMfaVerified] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session');
      if (res.status === 401) {
        setUser(null);
        setMfaVerified(false);
        await forceLogout();
        return;
      }
      const json = await readJsonSafely(res);
      if (!json) {
        // Non-JSON response (server error page / dev server restarting) —
        // treat the session as unavailable rather than crashing.
        console.error('[Auth] /api/auth/session returned non-JSON response (status', res.status, ')');
        setUser(null);
        setMfaVerified(false);
        setLoading(false);
        return;
      }
      const { user: profile, suspended, org_deactivated, locked, locked_until, mfa_verified, password_expired, password_expired_days } = json;
      if (suspended) {
        setUser(null);
        setMfaVerified(false);
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login?notice=suspended';
        return;
      }
      if (org_deactivated) {
        setUser(null);
        setMfaVerified(false);
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login?notice=org-deactivated';
        return;
      }
      if (locked) {
        setUser(null);
        setMfaVerified(false);
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login?notice=locked';
        return;
      }
      if (password_expired) {
        if (profile) {
          setUser(buildUser(profile));
          setMfaVerified(!!mfa_verified);
        }
        window.location.href = '/settings?notice=password_expired';
        return;
      }
      if (profile) {
        const built = buildUser(profile);
        setUser(built);
        setMfaVerified(!!mfa_verified);
        // T&C gate: redirect users who haven't accepted terms yet
        // Skip for admin/authority users and for the accept-terms page itself
        const onAcceptPage = window.location.pathname === '/accept-terms';
        const isManagement = built.is_platform_admin || built.is_authority_user;
        if (!onAcceptPage && !isManagement && !built.accepted_terms_at) {
          window.location.href = '/accept-terms';
          return;
        }
      } else {
        setUser(null);
        setMfaVerified(false);
      }
    } catch {
      // Network error Ã¢â‚¬â€ don't clear user, just keep current state
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));

    intervalRef.current = setInterval(() => {
      refreshUser();
    }, SESSION_REFRESH_INTERVAL);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshUser();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshUser]);

  const signIn = async (email: string, password: string): Promise<any> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await readJsonSafely(res);
    if (!data) {
      // HTML error page or empty body — server-side trouble, not bad credentials.
      throw new Error(
        res.status >= 500 || res.status === 404
          ? 'The server is temporarily unavailable. Please try again in a moment.'
          : 'Login is temporarily unavailable. Please try again.'
      );
    }
    if (!res.ok) {
      const err = data.error;
      if (typeof err === 'object' && err !== null) {
        const e = new Error(err.message || 'Login failed') as any;
        e.code = err.code;
        e.lockedUntil = err.lockedUntil;
        e.attemptsRemaining = err.attemptsRemaining;
        throw e;
      }
      const msg = typeof err === 'string' ? err : 'Invalid email or password';
      throw new Error(msg);
    }
    if (data.profile) {
      const built = buildUser(data.profile);
      setUser(built);
      setMfaVerified(false);
      if (data.password_expired) {
        window.location.href = '/settings?notice=password_expired';
      }
      return built;
    }
    return null;
  };

  const signUp = async (email: string, password: string, fullName: string, inviteToken: string) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, inviteToken }),
    });
    const data = await readJsonSafely(res);
    if (!data) throw new Error('Signup is temporarily unavailable. Please try again.');
    if (!res.ok) throw new Error(data.error || 'Signup failed');
  };

  const signOut = async () => {
    setUser(null);
    setMfaVerified(false);
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, mfa_verified: mfaVerified, signIn, signUp, signOut, refreshUser, setMfaVerified }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

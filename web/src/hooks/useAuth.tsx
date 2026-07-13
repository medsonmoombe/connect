'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';

export interface AppUser {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: string;
  is_platform_admin: boolean;
  /** Raw membership role: 'OWNER' | 'ADMIN' | 'MEMBER' — null for platform admins */
  org_member_role: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
  /** True if membership.role is OWNER or ADMIN on a non-platform org */
  is_org_admin: boolean;
  company_id?: string;
  company_name?: string;
  verification_status: string;
  onboarding_complete: boolean;
  company_members?: { role: string; company_id: string; companies: any }[];
  created_at?: string;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, inviteToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function buildUser(profile: any): AppUser {
  const membership = profile.company_members?.[0];
  const company = membership?.companies;

  // Platform admin: membership.role === 'ADMIN' AND company.is_platform_org === true
  const isPlatformAdmin = membership?.role === 'ADMIN' && company?.is_platform_org === true;

  // Org admin: membership.role is 'OWNER' or 'ADMIN' but NOT platform org
  const isOrgAdmin = !isPlatformAdmin && (membership?.role === 'OWNER' || membership?.role === 'ADMIN');

  // Dashboard role: platform admins see 'ADMIN', org admins see company's primary_role
  const role = isPlatformAdmin
    ? 'ADMIN'
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
    role,
    is_platform_admin: isPlatformAdmin,
    org_member_role: isPlatformAdmin ? null : (membership?.role ?? null),
    is_org_admin: isOrgAdmin,
    company_id: membership?.company_id,
    company_name: company?.name ?? undefined,
    verification_status: company?.status ?? 'pending_verification',
    onboarding_complete: profile.onboarding_complete,
    company_members: profile.company_members,
    created_at: profile.created_at,
  };
}

// How often to re-validate the session (ms)
const SESSION_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session');
      if (res.status === 401) {
        setUser(null);
        return;
      }
      const { user: profile, suspended, org_deactivated } = await res.json();
      if (suspended) {
        await fetch('/api/auth/logout', { method: 'POST' });
        setUser(null);
        window.location.href = '/login?notice=suspended';
        return;
      }
      if (org_deactivated) {
        await fetch('/api/auth/logout', { method: 'POST' });
        setUser(null);
        window.location.href = '/login?notice=org-deactivated';
        return;
      }
      if (profile) setUser(buildUser(profile));
      else setUser(null);
    } catch {
      // Network error — don't clear user, just keep current state
    }
  }, []);

  // On mount: check session + set up periodic refresh
  useEffect(() => {
    refreshUser().finally(() => setLoading(false));

    intervalRef.current = setInterval(() => {
      refreshUser();
    }, SESSION_REFRESH_INTERVAL);

    // Also refresh on tab focus (handles sleeping tabs)
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

  const signIn = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = data.error;
      const msg = typeof err === 'string' ? err : err?.message || 'Invalid email or password';
      const extra = err?.resetAt ? ` Try again at ${new Date(err.resetAt).toLocaleTimeString()}.` : '';
      throw new Error(msg + extra);
    }
    if (data.profile) setUser(buildUser(data.profile));
  };

  const signUp = async (email: string, password: string, fullName: string, inviteToken: string) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, inviteToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');
  };

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}


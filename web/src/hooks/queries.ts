'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Generic fetch hook ──────────────────────────────────────────────────────
function useFetch<T>(url: string, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const json = await res.json();
      setData(json.data ?? json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

// ── Generic mutation hook ───────────────────────────────────────────────────
function useMutation<TArgs, TResult>(url: string) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutateAsync = useCallback(async (args: TArgs): Promise<TResult> => {
    setIsPending(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      return json;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setIsPending(false);
    }
  }, [url]);

  return { mutateAsync, isPending, error };
}

// ── Admin Health ────────────────────────────────────────────────────────────
export interface AdminHealth {
  totalUsers: number;
  pendingVerifications: number;
  pendingReviewCount: number;
  totalProjects: number;
  totalCompanies: number;
  totalCapital: number;
  totalEngagements: number;
  roleBreakdown: Record<string, number>;
  activeUsers: { dau: number; wau: number };
  monthlyGrowth: { month: string; users: number; projects: number; engagements: number }[];
  trends: {
    users: { pct: number; positive: boolean };
    projects: { pct: number; positive: boolean };
    companies: { pct: number; positive: boolean };
    capital: { pct: number; positive: boolean };
  };
}

export function useAdminHealth() {
  return useFetch<AdminHealth>('/api/admin/health');
}

// ── Admin Pending Review Projects ───────────────────────────────────────────
export function useAdminPendingProjects() {
  return useFetch<any[]>('/api/projects', []);
}

// ── Audit Logs ──────────────────────────────────────────────────────────────
export interface AuditLogWithUser {
  id: string;
  user_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  timestamp: string;
  before_state?: any;
  after_state?: any;
  user?: any;
}

export function useAuditLogs() {
  return useFetch<AuditLogWithUser[]>('/api/admin/audit-logs');
}

// ── AI Analysis ─────────────────────────────────────────────────────────────
export interface RunAnalysisArgs {
  projects: any[];
  fileHash: string | null;
  fileName: string | null;
}

export interface ChatMessageArgs {
  projects: any[];
  question: string;
}

export function useRunAnalysis() {
  return useMutation<RunAnalysisArgs, any>('/api/admin/ai-analysis');
}

export function useChatMessage() {
  return useMutation<ChatMessageArgs, any>('/api/admin/ai-analysis');
}

// ── Analysis History ────────────────────────────────────────────────────────
export interface AnalysisRecord {
  id: string;
  file_name: string;
  project_count: number;
  portfolio_score: number | null;
  status: string;
  estimated_tokens: number | null;
  created_at: string;
  completed_at: string | null;
  performed_by: string;
}

export function useAnalysisHistory() {
  return useFetch<AnalysisRecord[]>('/api/admin/ai-analysis?action=history');
}

// ── Org Team ────────────────────────────────────────────────────────────────
export interface OrgMember {
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  user_id: string;
  is_invite?: boolean;
  invite_id?: string;
  user_profiles: {
    id: string;
    full_name: string;
    email: string;
    phone?: string | null;
    job_title?: string | null;
    avatar_url?: string;
    created_at: string;
    suspended_at?: string | null;
    email_verified_at?: string | null;
  } | null;
}

export function useOrgTeam() {
  const result = useFetch<OrgMember[]>('/api/org/team');
  return { ...result, data: result.data ?? [] };
}

// ── Platform Admin — project state + score override ─────────────────────────
export function useAdminForceProjectState() {
  const [isPending, setIsPending] = useState(false);
  const mutateAsync = useCallback(async (projectId: string, status: string, note: string) => {
    setIsPending(true);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'force_state', status, note }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      return json;
    } finally {
      setIsPending(false);
    }
  }, []);
  return { mutateAsync, isPending };
}

export function useAdminOverrideScore() {
  const [isPending, setIsPending] = useState(false);
  const mutateAsync = useCallback(async (projectId: string, scores: Record<string, number>, note: string) => {
    setIsPending(true);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'override_score', scores, note }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      return json;
    } finally {
      setIsPending(false);
    }
  }, []);
  return { mutateAsync, isPending };
}

// ── Platform Admin — user suspend/reactivate ─────────────────────────────────
export function useAdminSuspendUser() {
  const [isPending, setIsPending] = useState(false);
  const mutateAsync = useCallback(async (userId: string, action: 'suspend' | 'reactivate' | 'unlock', reason?: string) => {
    setIsPending(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      return json;
    } finally {
      setIsPending(false);
    }
  }, []);
  return { mutateAsync, isPending };
}

// ── Platform Admin — engagement override ────────────────────────────────────
export function useAdminOverrideEngagement() {
  const [isPending, setIsPending] = useState(false);
  const mutateAsync = useCallback(async (engagementId: string, status: 'CLOSED' | 'DROPPED' | string, reason: string) => {
    // status may also be any pipeline state — the API treats non-terminal
    // statuses as a revive of a DROPPED engagement and validates them server-side.
    setIsPending(true);
    try {
      const res = await fetch(`/api/admin/engagements/${engagementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      return json;
    } finally {
      setIsPending(false);
    }
  }, []);
  return { mutateAsync, isPending };
}

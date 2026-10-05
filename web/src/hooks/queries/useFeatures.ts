'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { InvestorInterestIndex, MatchingDigest, PlatformAnalytics } from '@/types';

// ── Interest Index ──────────────────────────────────────────────────────────

export function useInterestIndex(projectId: string) {
  return useQuery({
    queryKey: queryKeys.interest.project(projectId),
    queryFn: () => apiClient.get<{ data: InvestorInterestIndex }>(`/projects/${projectId}/interest`).then(r => r.data),
    enabled: !!projectId,
  });
}

export function useTrackInterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, signalType, metadata }: { projectId: string; signalType: string; metadata?: Record<string, unknown> }) =>
      apiClient.post(`/projects/${projectId}/interest`, { signal_type: signalType, metadata }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.interest.project(vars.projectId) });
    },
  });
}

// ── Digest Preferences ──────────────────────────────────────────────────────

export function useDigestPreferences() {
  return useQuery({
    queryKey: queryKeys.digests.preferences(),
    queryFn: () => apiClient.get<{ data: MatchingDigest }>('/digests').then(r => r.data),
  });
}

export function useUpdateDigestPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (frequency: string) =>
      apiClient.patch('/digests', { frequency }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.digests.preferences() });
    },
  });
}

// ── Platform Analytics ──────────────────────────────────────────────────────

export function usePlatformAnalytics() {
  return useQuery({
    queryKey: queryKeys.analytics.platform(),
    queryFn: () => apiClient.get<{ data: PlatformAnalytics }>('/analytics/platform').then(r => r.data),
  });
}

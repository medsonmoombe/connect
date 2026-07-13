import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

// ── Fetchers ──────────────────────────────────────────────────────────────────

const fetchHistory = () =>
  apiClient.get<{ data: any[] }>('/admin/ai-analysis').then((r: any) => r.data ?? []);

const fetchAnalysis = (id: string) =>
  apiClient.post<{ success: boolean; data: any }>('/admin/ai-analysis', { action: 'get', analysisId: id })
    .then((r: any) => { if (!r.success) throw new Error('Not found'); return r.data; });

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useAnalysisHistory() {
  return useQuery({
    queryKey: queryKeys.aiAnalysis.history(),
    queryFn: fetchHistory,
    staleTime: 1000 * 60, // 1 min
  });
}

export function useAnalysisRecord(id: string | null) {
  return useQuery({
    queryKey: queryKeys.aiAnalysis.detail(id!),
    queryFn: () => fetchAnalysis(id!),
    enabled: !!id,
  });
}

export function useRunAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { projects: any[]; fileHash: string | null; fileName: string | null }) =>
      apiClient.post<any>('/admin/ai-analysis', { action: 'analyze', ...payload }),
    onSuccess: () => {
      // New analysis recorded — refresh history list
      qc.invalidateQueries({ queryKey: queryKeys.aiAnalysis.history() });
    },
  });
}

export function useChatMessage() {
  return useMutation({
    mutationFn: ({ projects, question }: { projects: any[]; question: string }) =>
      apiClient.post<{ text: string }>('/admin/ai-analysis', { action: 'chat', projects, question }),
  });
}

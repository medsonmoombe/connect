import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { engagementsApi, messagesApi } from '@/services/api';
import { queryKeys } from '@/lib/query-keys';

type EngagementFilters = Parameters<typeof engagementsApi.getAll>[0];

export function useEngagements(filters?: EngagementFilters) {
  return useQuery({
    queryKey: queryKeys.engagements.list(filters),
    queryFn: () => engagementsApi.getAll(filters).then(r => {
      if (r.error) throw new Error(r.error);
      return r.data!;
    }),
  });
}

export function useEngagement(id: string) {
  return useQuery({
    queryKey: queryKeys.engagements.detail(id),
    queryFn: () => engagementsApi.getById(id).then(r => {
      if (r.error) throw new Error(r.error);
      return r.data!;
    }),
    enabled: !!id,
  });
}

export function useCreateEngagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof engagementsApi.create>[0]) =>
      engagementsApi.create(data).then(r => { if (r.error) throw new Error(r.error); return r.data!; }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.engagements.lists() }),
  });
}

export function useUpdateEngagementStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      engagementsApi.updateStatus(id, status).then(r => { if (r.error) throw new Error(r.error); return r.data!; }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.engagements.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.engagements.detail(id) });
      // Audit log may change too
      qc.invalidateQueries({ queryKey: queryKeys.admin.auditLogs() });
    },
  });
}

export function useMessages(engagementId: string) {
  return useQuery({
    queryKey: queryKeys.messages.byEngagement(engagementId),
    queryFn: () => messagesApi.getByEngagement(engagementId).then(r => {
      if (r.error) throw new Error(r.error);
      return r.data!;
    }),
    enabled: !!engagementId,
    refetchInterval: 1000 * 15, // poll every 15s for new messages
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof messagesApi.create>[0]) =>
      messagesApi.create(data).then(r => { if (r.error) throw new Error(r.error); return r.data!; }),
    onSuccess: (_, vars) => {
      if (vars.engagement_id) {
        qc.invalidateQueries({ queryKey: queryKeys.messages.byEngagement(vars.engagement_id as string) });
      }
    },
  });
}

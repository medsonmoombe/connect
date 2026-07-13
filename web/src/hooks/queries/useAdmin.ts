import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auditLogsApi, usersApi, adminHealthApi } from '@/services/api';
import { queryKeys } from '@/lib/query-keys';

export function useAuditLogs() {
  return useQuery({
    queryKey: queryKeys.admin.auditLogs(),
    queryFn: () => auditLogsApi.getAll().then(r => {
      if (r.error) throw new Error(r.error);
      return r.data!;
    }),
    staleTime: 1000 * 30, // audit logs refresh every 30s
  });
}

export function usePendingVerifications() {
  return useQuery({
    queryKey: queryKeys.admin.pendingVerifications(),
    queryFn: () => usersApi.getPendingVerifications().then(r => {
      if (r.error) throw new Error(r.error);
      return r.data!;
    }),
    staleTime: 1000 * 30,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: [...queryKeys.admin.users(), id],
    queryFn: () => usersApi.getById(id).then(r => {
      if (r.error) throw new Error(r.error);
      return r.data!;
    }),
    enabled: !!id,
  });
}

export function useVerifyUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: 'VERIFIED' | 'REJECTED' }) =>
      usersApi.verifyUser(userId, status).then(r => { if (r.error) throw new Error(r.error); return r.data!; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.pendingVerifications() });
      qc.invalidateQueries({ queryKey: queryKeys.admin.users() });
      qc.invalidateQueries({ queryKey: queryKeys.admin.auditLogs() });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof usersApi.update>[1] }) =>
      usersApi.update(id, data).then(r => { if (r.error) throw new Error(r.error); return r.data!; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.users() });
    },
  });
}

export function useAdminHealth() {
  return useQuery({
    queryKey: queryKeys.admin.health(),
    queryFn: () => adminHealthApi.get().then(r => {
      if (r.error) throw new Error(r.error);
      return r.data!;
    }),
    staleTime: 1000 * 60,
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: queryKeys.admin.users(),
    queryFn: () => usersApi.getAll().then(r => {
      if (r.error) throw new Error(r.error);
      return r.data!;
    }),
    staleTime: 1000 * 30,
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companiesApi } from '@/services/api';
import { queryKeys } from '@/lib/query-keys';

export function useCompanies(filters?: { search?: string; type?: string }) {
  return useQuery({
    queryKey: queryKeys.companies.list(filters),
    queryFn: () => companiesApi.getAdminAll(filters).then(r => {
      if (r.error) throw new Error(r.error);
      return r.data!;
    }),
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: queryKeys.companies.detail(id),
    queryFn: () => companiesApi.getById(id).then(r => {
      if (r.error) throw new Error(r.error);
      return r.data!;
    }),
    enabled: !!id,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof companiesApi.create>[0]) =>
      companiesApi.create(data).then(r => { if (r.error) throw new Error(r.error); return r.data!; }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.companies.lists() }),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof companiesApi.update>[1] }) =>
      companiesApi.update(id, data).then(r => { if (r.error) throw new Error(r.error); return r.data!; }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.companies.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.companies.detail(id) });
    },
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      companiesApi.delete(id).then(r => { if (r.error) throw new Error(r.error); }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.companies.lists() }),
  });
}

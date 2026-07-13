import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/services/api';
import { queryKeys } from '@/lib/query-keys';

type ProjectFilters = Parameters<typeof projectsApi.getAll>[0];
type AdminFilters  = Parameters<typeof projectsApi.getAdminAll>[0];

export function useProjects(filters?: ProjectFilters) {
  return useQuery({
    queryKey: queryKeys.projects.list(filters),
    queryFn: () => projectsApi.getAll(filters).then(r => {
      if (r.error) throw new Error(r.error);
      return r.data!;
    }),
  });
}

export function useAdminProjects(filters?: AdminFilters) {
  return useQuery({
    queryKey: queryKeys.projects.list(filters),
    queryFn: () => projectsApi.getAdminAll(filters).then(r => {
      if (r.error) throw new Error(r.error);
      return r.data!;
    }),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: queryKeys.projects.detail(id),
    queryFn: () => projectsApi.getById(id).then(r => {
      if (r.error) throw new Error(r.error);
      return r.data!;
    }),
    enabled: !!id,
  });
}

export function useProjectAnalytics(id: string) {
  return useQuery({
    queryKey: queryKeys.projects.analytics(id),
    queryFn: () => projectsApi.getAnalytics(id).then(r => {
      if (r.error) throw new Error(r.error);
      return r.data!;
    }),
    enabled: !!id,
  });
}

export function useProjectMatches(id: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: queryKeys.projects.matches(id),
    queryFn: async () => {
      const capital = await projectsApi.getAll().then(() => []);  // placeholder — real match endpoints below
      const technical: any[] = [];
      return { capital, technical };
    },
    enabled: !!id,
  });
}

export function useInvalidateProjects() {
  const qc = useQueryClient();
  return {
    invalidateAll:    () => qc.invalidateQueries({ queryKey: queryKeys.projects.all() }),
    invalidateLists:  () => qc.invalidateQueries({ queryKey: queryKeys.projects.lists() }),
    invalidateDetail: (id: string) => qc.invalidateQueries({ queryKey: queryKeys.projects.detail(id) }),
  };
}

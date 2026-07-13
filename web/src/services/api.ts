import { apiClient } from '@/lib/api-client';
import {
  Project, Company, CapitalPartner, TechnicalPartner,
  Engagement, Message, User, ApiResponse, AuditLog, PaginatedResponse
} from '@/types';

function wrap<T>(promise: Promise<{ data: T }>): Promise<ApiResponse<T>> {
  return promise.then(r => ({ data: r.data })).catch(e => ({ error: e.message }));
}

export const companiesApi = {
  getAll: () => wrap<Company[]>(apiClient.get('/organizations')),
  getAdminAll: (filters?: { search?: string; type?: string }) => {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.type) params.set('type', filters.type);
    return wrap<Company[]>(apiClient.get(`/companies?${params}`));
  },
  getById: (id: string) => wrap<Company>(apiClient.get(`/organizations/${id}`)),
  create: (company: Partial<Company>) => wrap<Company>(apiClient.post('/organizations', company)),
  update: (id: string, company: Partial<Company>) => wrap<Company>(apiClient.patch(`/organizations/${id}`, company)),
  delete: async (id: string): Promise<ApiResponse<null>> => {
    return apiClient.delete(`/organizations/${id}`).then(() => ({ data: null })).catch(e => ({ error: e.message }));
  },
};

export const usersApi = {
  getAll: () => wrap<User[]>(apiClient.get('/admin/users')),
  getById: (id: string) => wrap<User>(apiClient.get(`/admin/users?id=${id}`)),
  update: (id: string, user: Partial<User>) =>
    wrap<User>(apiClient.patch('/admin/users', { userId: id, ...user })),
  getPendingVerifications: () =>
    wrap<User[]>(apiClient.get('/admin/users?pending=true')),
  verifyUser: (userId: string, status: 'VERIFIED' | 'REJECTED') =>
    wrap<User>(apiClient.patch('/admin/users', { userId, verification_status: status })),
};

export const projectsApi = {
  getAll: async (filters?: { page?: number; pageSize?: number; developer_id?: string; project_stage?: string; location_country?: string }): Promise<ApiResponse<PaginatedResponse<Project>>> => {
    const params = new URLSearchParams();
    if (filters?.project_stage) params.set('stage', filters.project_stage);
    if (filters?.location_country) params.set('country', filters.location_country);
    return apiClient.get<{ data: Project[] }>(`/projects?${params}`)
      .then(r => ({
        data: {
          data: r.data,
          total: r.data.length,
          page: filters?.page ?? 1,
          pageSize: filters?.pageSize ?? 10,
          totalPages: 1,
        }
      }))
      .catch(e => ({ error: e.message }));
  },
  getAdminAll: (filters?: { search?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'ALL') params.set('stage', filters.status);
    if (filters?.search) params.set('search', filters.search);
    return wrap<Project[]>(apiClient.get(`/projects?${params}`));
  },
  getById: (id: string) => wrap<Project>(apiClient.get(`/projects/${id}`)),
  getAnalytics: (projectId: string) => wrap<any>(apiClient.get(`/projects/${projectId}/analytics`)),
};

export const capitalPartnersApi = {
  getAll: () => wrap<CapitalPartner[]>(apiClient.get('/partners?type=capital')),
  getById: (id: string) => wrap<CapitalPartner>(apiClient.get(`/partners?type=capital&id=${id}`)),
  create: (partner: Partial<CapitalPartner>) => wrap<CapitalPartner>(apiClient.post('/partners', { type: 'capital', ...partner })),
  update: (id: string, partner: Partial<CapitalPartner>) => wrap<CapitalPartner>(apiClient.patch(`/partners?type=capital&id=${id}`, partner)),
};

export const technicalPartnersApi = {
  getAll: () => wrap<TechnicalPartner[]>(apiClient.get('/partners?type=technical')),
  getById: (id: string) => wrap<TechnicalPartner>(apiClient.get(`/partners?type=technical&id=${id}`)),
  create: (partner: Partial<TechnicalPartner>) => wrap<TechnicalPartner>(apiClient.post('/partners', { type: 'technical', ...partner })),
  update: (id: string, partner: Partial<TechnicalPartner>) => wrap<TechnicalPartner>(apiClient.patch(`/partners?type=technical&id=${id}`, partner)),
};

export const matchingApi = {
  getCapitalMatches: async (projectId: string): Promise<ApiResponse<any[]>> => {
    return apiClient.get<{ capital: any[] }>(`/projects/${projectId}?resource=matches`)
      .then(r => ({ data: r.capital })).catch(e => ({ error: e.message }));
  },
  getTechnicalMatches: async (projectId: string): Promise<ApiResponse<any[]>> => {
    return apiClient.get<{ technical: any[] }>(`/projects/${projectId}?resource=matches`)
      .then(r => ({ data: r.technical })).catch(e => ({ error: e.message }));
  },
};

export const engagementsApi = {
  getAll: (filters?: { project_id?: string; counterparty_id?: string }) => {
    const params = new URLSearchParams();
    if (filters?.project_id) params.set('project_id', filters.project_id);
    if (filters?.counterparty_id) params.set('counterparty_id', filters.counterparty_id);
    return wrap<Engagement[]>(apiClient.get(`/engagements?${params}`));
  },
  getById: (id: string) => wrap<Engagement>(apiClient.get(`/engagements/${id}`)),
  create: (engagement: Partial<Engagement>) => wrap<Engagement>(apiClient.post('/engagements', engagement)),
  updateStatus: (id: string, status: string) => wrap<Engagement>(apiClient.patch(`/engagements/${id}`, { status })),
};

export const messagesApi = {
  getByEngagement: (engagementId: string) =>
    wrap<Message[]>(apiClient.get(`/messages?engagement_id=${engagementId}`)),
  create: (message: Partial<Message>) => wrap<Message>(apiClient.post('/messages', message)),
};

export const onboardingApi = {
  completeUserProfile: (_userId: string, data: { full_name: string }) =>
    wrap<User>(apiClient.post('/onboarding', { action: 'update_profile', ...data })),
  setupCompany: (_userId: string, companyData: Partial<Company>) =>
    wrap<any>(apiClient.post('/onboarding', { action: 'setup_company', company: companyData })),
  joinCompany: (_userId: string, companyId: string) =>
    wrap<any>(apiClient.post('/onboarding', { action: 'join_company', companyId })),
  saveRolePreferences: (role: string, companyId: string, data: any) =>
    wrap<any>(apiClient.post('/onboarding', { action: 'save_preferences', role, preferences: data })),
  completeOnboarding: () =>
    wrap<any>(apiClient.post('/onboarding', { action: 'complete_onboarding' })),
};

export const auditLogsApi = {
  getAll: () => wrap<AuditLog[]>(apiClient.get('/admin/audit-logs')),
  create: (log: { action_type: string; entity_type: string; entity_id: string }) =>
    wrap<AuditLog>(apiClient.post('/audit-logs', log)),
};

export interface AdminHealthData {
  totalUsers: number;
  pendingVerifications: number;
  totalProjects: number;
  totalCompanies: number;
  totalCapital: number;
  totalEngagements: number;
  trends: {
    users: { pct: number; positive: boolean };
    projects: { pct: number; positive: boolean };
    companies: { pct: number; positive: boolean };
    capital: { pct: number; positive: boolean };
  };
}

export const adminHealthApi = {
  get: () => wrap<AdminHealthData>(apiClient.get('/admin/health')),
};

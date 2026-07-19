import { apiClient } from '@/lib/api-client';
import {
  Project, Company, CapitalPartner, TechnicalPartner,
  Engagement, Message, EngagementDocument, User, ApiResponse, AuditLog, PaginatedResponse
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
    if (filters?.status && filters.status !== 'ALL') params.set('status', filters.status);
    if (filters?.search) params.set('search', filters.search);
    return wrap<Project[]>(apiClient.get(`/projects?${params}`));
  },
  getMarketplace: () =>
    wrap<Project[]>(apiClient.get('/projects?view=marketplace&include=epc')),
  getById: (id: string) => wrap<Project>(apiClient.get(`/projects/${id}`)),
  getAnalytics: (projectId: string) => wrap<any>(apiClient.get(`/projects/${projectId}/analytics`)),
  archive: (id: string) => wrap<{ status: string }>(apiClient.post(`/projects/${id}/archive`, {})),
  adminForceState: (id: string, status: string, note: string) =>
    wrap<{ id: string; status: string }>(apiClient.patch(`/admin/projects/${id}`, { action: 'force_state', status, note })),
  adminForceLive: (id: string, note: string) =>
    wrap<{ id: string; is_visible_to_investors: boolean }>(apiClient.patch(`/admin/projects/${id}`, { action: 'force_live', note })),
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
  getProjectMatches: async (projectId: string): Promise<ApiResponse<{ capital: any[]; technical: any[] }>> => {
    return apiClient.get<{ capital: any[]; technical: any[] }>(`/projects/${projectId}?resource=matches`)
      .then(r => ({ data: { capital: r.capital ?? [], technical: r.technical ?? [] } }))
      .catch(e => ({ error: e.message }));
  },
  getCapitalMatches: async (projectId: string): Promise<ApiResponse<any[]>> => {
    return apiClient.get<{ capital: any[] }>(`/projects/${projectId}?resource=matches`)
      .then(r => ({ data: r.capital })).catch(e => ({ error: e.message }));
  },
  getTechnicalMatches: async (projectId: string): Promise<ApiResponse<any[]>> => {
    return apiClient.get<{ technical: any[] }>(`/projects/${projectId}?resource=matches`)
      .then(r => ({ data: r.technical })).catch(e => ({ error: e.message }));
  },
  getMatchesForPartner: async (): Promise<ApiResponse<any[]>> => {
    return apiClient.get<{ data: any[] }>('/matches/capital')
      .then(r => ({ data: r.data })).catch(e => ({ error: e.message }));
  },
  getPartnerMatchStats: async (): Promise<ApiResponse<{ total: number; avgScore: number; highPotential: number }>> => {
    return apiClient.get<{ data: { total: number; avgScore: number; highPotential: number } }>('/matches/capital?stats=true')
      .then(r => ({ data: r.data })).catch(e => ({ error: e.message }));
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
  // Engagement data room (documents)
  getDocuments: (engagementId: string) =>
    apiClient.get<{ data: EngagementDocument[] }>(`/engagements/${engagementId}/documents`)
      .then((r) => ({ data: r.data, error: undefined as string | undefined }))
      .catch((e) => ({ data: undefined as any, error: String(e?.message || e) })),
  uploadDocument: (engagementId: string, file: File, documentType: string, classification = 'CONFIDENTIAL') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('document_type', documentType);
    fd.append('classification', classification);
    return fetch(`/api/engagements/${engagementId}/documents`, {
      method: 'POST',
      credentials: 'include',
      body: fd,
    })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json?.error || 'Upload failed');
        return { data: json.data as EngagementDocument, error: undefined as string | undefined };
      })
      .catch((e) => ({ data: undefined as any, error: String(e?.message || e) }));
  },
  downloadDocument: (engagementId: string, docId: string) =>
    apiClient.get<{ signedUrl: string; file_name: string; mime_type: string }>(
      `/engagements/${engagementId}/documents/${docId}`
    )
      .then((r) => ({ data: r as any, error: undefined as string | undefined }))
      .catch((e) => ({ data: undefined as any, error: String(e?.message || e) })),
  deleteDocument: (engagementId: string, docId: string) =>
    apiClient.delete<{ data: { id: string; deleted: boolean } }>(
      `/engagements/${engagementId}/documents/${docId}`
    )
      .then((r) => ({ data: r.data, error: undefined as string | undefined }))
      .catch((e) => ({ data: undefined as any, error: String(e?.message || e) })),
};

export const messagesApi = {
  getByEngagement: (engagementId: string) =>
    wrap<Message[]>(apiClient.get(`/messages?engagement_id=${engagementId}`)),
  create: (message: Partial<Message>) => wrap<Message>(apiClient.post('/messages', message)),
  /** Soft-delete own message within 5 min (PRD §11.1). Returns { id, deleted }. */
  remove: (messageId: string) =>
    apiClient.delete<{ data: { id: string; deleted: boolean } }>(`/messages/${messageId}`)
      .then((r) => ({ data: r.data, error: undefined as string | undefined }))
      .catch((e) => ({ data: undefined as any, error: String(e?.message || e) })),
  /** Mark an engagement as read (clears unread). */
  markRead: (engagementId: string) =>
    apiClient.post<{ data: { engagement_id: string; last_read_at: string } }>(
      `/messages/${engagementId}/read`,
      {}
    )
      .then((r) => ({ data: r.data, error: undefined as string | undefined }))
      .catch((e) => ({ data: undefined as any, error: String(e?.message || e) })),
  /** Unread message counts across the user's engagements. */
  getUnread: () =>
    apiClient.get<{ data: { total: number; by_engagement: Record<string, number> } }>(
      '/messages/unread'
    )
      .then((r) => ({ data: r.data, error: undefined as string | undefined }))
      .catch((e) => ({ data: undefined as any, error: String(e?.message || e) })),
};

export const onboardingApi = {
  completeUserProfile: (_userId: string, data: { full_name: string }) =>
    wrap<User>(apiClient.post('/onboarding', { action: 'update_profile', ...data })),
  setupCompany: (_userId: string, companyData: Partial<Company>) =>
    wrap<any>(apiClient.post('/onboarding', { action: 'setup_company', company: companyData })),
  joinCompany: (_userId: string, companyId: string) =>
    wrap<any>(apiClient.post('/onboarding', { action: 'join_company', companyId })),
  saveRolePreferences: (role: string, data: any) =>
    wrap<any>(apiClient.post('/onboarding', { action: 'save_preferences', role, preferences: data })),
  updateCompany: (_userId: string, companyData: Partial<Company>) =>
    wrap<any>(apiClient.post('/onboarding', { action: 'update_company', company: companyData })),
  resubmitCompany: () =>
    wrap<any>(apiClient.post('/onboarding', { action: 'resubmit_company' })),
  getEditData: () =>
    wrap<{ company: Company; preferences: Record<string, any> }>(apiClient.post('/onboarding', { action: 'get_edit_data' })),
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

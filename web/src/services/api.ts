import { supabase } from '@/lib/supabase';
import { 
  Project, 
  Company, 
  CapitalPartner, 
  TechnicalPartner, 
  Engagement, 
  Message,
  ProjectScore,
  CapitalMatchResult,
  TechnicalMatchResult,
  User,
  UserRole,
  PaginatedResponse,
  ApiResponse,
  AuditLog
} from '@/types';

// Helper function to handle Supabase responses
async function handleResponse<T>(response: { data: T | null; error: Error | null }): Promise<ApiResponse<T>> {
  if (response.error) {
    return { error: response.error.message };
  }
  return { data: response.data as T };
}

// Companies API
export const companiesApi = {
  async getAll(): Promise<ApiResponse<Company[]>> {
    const response = await supabase.from('companies').select('*');
    return handleResponse(response);
  },

  async getAdminAll(filters?: {
    search?: string;
    type?: string;
  }): Promise<ApiResponse<Company[]>> {
    let query = supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.type && filters.type !== 'ALL') {
      query = query.eq('type', filters.type);
    }

    if (filters?.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    const response = await query;
    return handleResponse(response);
  },

  async getById(id: string): Promise<ApiResponse<Company>> {
    const response = await supabase.from('companies').select('*').eq('id', id).single();
    return handleResponse(response);
  },

  async create(company: Partial<Company>): Promise<ApiResponse<Company>> {
    const response = await supabase.from('companies').insert(company).select().single();
    return handleResponse(response);
  },

  async update(id: string, company: Partial<Company>): Promise<ApiResponse<Company>> {
    const response = await supabase.from('companies').update(company).eq('id', id).select().single();
    return handleResponse(response);
  },

  async delete(id: string): Promise<ApiResponse<null>> {
    const response = await supabase.from('companies').delete().eq('id', id);
    return handleResponse(response);
  },
};

// Users API
export const usersApi = {
  async getById(id: string): Promise<ApiResponse<User>> {
    const response = await supabase.from('users').select('*').eq('id', id).single();
    return handleResponse(response);
  },

  async update(id: string, user: Partial<User>): Promise<ApiResponse<User>> {
    const response = await supabase.from('users').update(user).eq('id', id).select().single();
    return handleResponse(response);
  },

  async getPendingVerifications(): Promise<ApiResponse<User[]>> {
    const response = await supabase
      .from('users')
      .select('*, company:companies(*)')
      .eq('verification_status', 'PENDING')
      .order('created_at', { ascending: false });
    return handleResponse(response);
  },

  async verifyUser(userId: string, status: 'VERIFIED' | 'REJECTED'): Promise<ApiResponse<User>> {
    const response = await supabase
      .from('users')
      .update({ verification_status: status })
      .eq('id', userId)
      .select()
      .single();
    return handleResponse(response);
  },
};

// Projects API
export const projectsApi = {
  async getAll(filters?: {
    page?: number;
    pageSize?: number;
    developer_id?: string;
    project_stage?: string;
    location_country?: string;
  }): Promise<ApiResponse<PaginatedResponse<Project>>> {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 10;
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from('projects')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (filters?.developer_id) {
      query = query.eq('developer_id', filters.developer_id);
    }
    if (filters?.project_stage) {
      query = query.eq('project_stage', filters.project_stage);
    }
    if (filters?.location_country) {
      query = query.eq('location_country', filters.location_country);
    }

    const response = await query;
    
    if (response.error) {
      return { error: response.error.message };
    }

    return {
      data: {
        data: response.data as Project[],
        total: response.count ?? 0,
        page,
        pageSize,
        totalPages: Math.ceil((response.count ?? 0) / pageSize),
      },
    };
  },

  async getAdminAll(filters?: {
    search?: string;
    status?: string;
  }): Promise<ApiResponse<Project[]>> {
    let query = supabase
      .from('projects')
      .select('*, developer:companies!developer_id(*)')
      .order('created_at', { ascending: false });

    if (filters?.status && filters.status !== 'ALL') {
      query = query.eq('project_stage', filters.status);
    }

    if (filters?.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    const response = await query;
    return handleResponse(response);
  },

  async getById(id: string): Promise<ApiResponse<Project>> {
    const response = await supabase
      .from('projects')
      .select('*, developer:companies!developer_id(*)')
      .eq('id', id)
      .single();
    return handleResponse(response);
  },

  async getAnalytics(projectId: string): Promise<ApiResponse<any>> {
    const [viewsRes, engagementsRes] = await Promise.all([
      supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_id', projectId)
        .in('action_type', ['PROJECT_VIEW', 'DATAROOM_ACCESS']),
      supabase
        .from('engagements')
        .select('*')
        .eq('project_id', projectId)
    ]);

    if (viewsRes.error) return { error: viewsRes.error.message };
    if (engagementsRes.error) return { error: engagementsRes.error.message };

    const views = viewsRes.data || [];
    const engagements = engagementsRes.data || [];

    const stats = {
      totalViews: views.filter(v => v.action_type === 'PROJECT_VIEW').length,
      dataroomAccess: views.filter(v => v.action_type === 'DATAROOM_ACCESS').length,
      funnel: {
        intro: engagements.length,
        nda: engagements.filter(e => ['NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET', 'CLOSED'].includes(e.status)).length,
        dueDiligence: engagements.filter(e => ['DUE_DILIGENCE', 'TERM_SHEET', 'CLOSED'].includes(e.status)).length,
        termSheet: engagements.filter(e => ['TERM_SHEET', 'CLOSED'].includes(e.status)).length,
        closed: engagements.filter(e => e.status === 'CLOSED').length
      }
    };

    return { data: stats };
  },
};

// Capital Partners API
export const capitalPartnersApi = {
  async getAll(): Promise<ApiResponse<CapitalPartner[]>> {
    const response = await supabase
      .from('capital_partners')
      .select('*, company:companies(*)');
    return handleResponse(response);
  },

  async getById(id: string): Promise<ApiResponse<CapitalPartner>> {
    const response = await supabase
      .from('capital_partners')
      .select('*, company:companies(*)')
      .eq('id', id)
      .single();
    return handleResponse(response);
  },

  async create(partner: Partial<CapitalPartner>): Promise<ApiResponse<CapitalPartner>> {
    const response = await supabase.from('capital_partners').insert(partner).select().single();
    return handleResponse(response);
  },

  async update(id: string, partner: Partial<CapitalPartner>): Promise<ApiResponse<CapitalPartner>> {
    const response = await supabase.from('capital_partners').update(partner).eq('id', id).select().single();
    return handleResponse(response);
  },
};

// Technical Partners API
export const technicalPartnersApi = {
  async getAll(): Promise<ApiResponse<TechnicalPartner[]>> {
    const response = await supabase
      .from('technical_partners')
      .select('*, company:companies(*)');
    return handleResponse(response);
  },

  async getById(id: string): Promise<ApiResponse<TechnicalPartner>> {
    const response = await supabase
      .from('technical_partners')
      .select('*, company:companies(*)')
      .eq('id', id)
      .single();
    return handleResponse(response);
  },

  async create(partner: Partial<TechnicalPartner>): Promise<ApiResponse<TechnicalPartner>> {
    const response = await supabase.from('technical_partners').insert(partner).select().single();
    return handleResponse(response);
  },

  async update(id: string, partner: Partial<TechnicalPartner>): Promise<ApiResponse<TechnicalPartner>> {
    const response = await supabase.from('technical_partners').update(partner).eq('id', id).select().single();
    return handleResponse(response);
  },
};

// Matching API
export const matchingApi = {
  async getCapitalMatches(projectId: string): Promise<ApiResponse<CapitalMatchResult[]>> {
    const response = await supabase
      .from('capital_match_results')
      .select('*, capital_partner:capital_partners(*, company:companies(*))')
      .eq('project_id', projectId)
      .order('compatibility_score', { ascending: false })
      .limit(5);
    return handleResponse(response);
  },

  async getTechnicalMatches(projectId: string): Promise<ApiResponse<TechnicalMatchResult[]>> {
    const response = await supabase
      .from('technical_match_results')
      .select('*, technical_partner:technical_partners(*, company:companies(*))')
      .eq('project_id', projectId)
      .order('compatibility_score', { ascending: false })
      .limit(5);
    return handleResponse(response);
  },

  async triggerMatching(projectId: string): Promise<ApiResponse<void>> {
    const response = await supabase.functions.invoke('trigger-matching', {
      body: { project_id: projectId },
    });
    return handleResponse(response);
  },
};

// Engagements API
export const engagementsApi = {
  async getAll(filters?: { project_id?: string; counterparty_id?: string }): Promise<ApiResponse<Engagement[]>> {
    let query = supabase
      .from('engagements')
      .select('*, project:projects(*), messages(*)')
      .order('created_at', { ascending: false });

    if (filters?.project_id) {
      query = query.eq('project_id', filters.project_id);
    }
    if (filters?.counterparty_id) {
      query = query.eq('counterparty_id', filters.counterparty_id);
    }

    const response = await query;
    return handleResponse(response);
  },

  async getById(id: string): Promise<ApiResponse<Engagement>> {
    const response = await supabase
      .from('engagements')
      .select('*, project:projects(*), messages(*)')
      .eq('id', id)
      .single();
    return handleResponse(response);
  },

  async create(engagement: Partial<Engagement>): Promise<ApiResponse<Engagement>> {
    const response = await supabase.from('engagements').insert(engagement).select().single();
    return handleResponse(response);
  },

  async updateStatus(id: string, status: string): Promise<ApiResponse<Engagement>> {
    const response = await supabase
      .from('engagements')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return handleResponse(response);
  },
};

// Messages API
export const messagesApi = {
  async getByEngagement(engagementId: string): Promise<ApiResponse<Message[]>> {
    const response = await supabase
      .from('messages')
      .select('*, sender:users(*)')
      .eq('engagement_id', engagementId)
      .order('created_at', { ascending: true });
    return handleResponse(response);
  },

  async create(message: Partial<Message>): Promise<ApiResponse<Message>> {
    const response = await supabase.from('messages').insert(message).select().single();
    return handleResponse(response);
  },
};

// Onboarding API
export const onboardingApi = {
  async completeUserProfile(userId: string, data: { full_name: string }): Promise<ApiResponse<User>> {
    const response = await supabase
      .from('users')
      .update(data)
      .eq('id', userId)
      .select()
      .single();
    return handleResponse(response);
  },

  async setupCompany(userId: string, companyData: Partial<Company>): Promise<ApiResponse<{ user: User; company: Company }>> {
    // 1. Create the company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert(companyData)
      .select()
      .single();

    if (companyError) return { error: companyError.message };

    // 2. Link user to the company
    const { data: user, error: userError } = await supabase
      .from('users')
      .update({ company_id: company.id })
      .eq('id', userId)
      .select()
      .single();

    if (userError) return { error: userError.message };

    return { data: { user: user as User, company: company as Company } };
  },

  async joinCompany(userId: string, companyId: string): Promise<ApiResponse<User>> {
    const response = await supabase
      .from('users')
      .update({ company_id: companyId })
      .eq('id', userId)
      .select()
      .single();
    return handleResponse(response);
  },

  async saveRolePreferences(role: UserRole, companyId: string, data: any): Promise<ApiResponse<any>> {
    let table = '';
    if (role === 'CAPITAL_PARTNER') table = 'capital_partners';
    else if (role === 'TECHNICAL_PARTNER') table = 'technical_partners';
    
    if (!table) return { message: 'No specific preferences needed for this role' };

    const response = await supabase
      .from(table)
      .upsert({ company_id: companyId, ...data })
      .select()
      .single();
    
    return handleResponse(response);
  }
};

// Audit Logs API
export const auditLogsApi = {
  async getAll(): Promise<ApiResponse<AuditLog[]>> {
    const response = await supabase
      .from('audit_logs')
      .select('*, user:users(*)')
      .order('timestamp', { ascending: false })
      .limit(50);
    return handleResponse(response);
  },

  async create(log: Partial<AuditLog>): Promise<ApiResponse<AuditLog>> {
    const response = await supabase.from('audit_logs').insert(log).select().single();
    return handleResponse(response);
  },
};

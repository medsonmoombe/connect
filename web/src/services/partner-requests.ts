import { apiClient } from '@/lib/api-client';
import type { PartnerRequest, PartnerRequestType } from '@/types';

interface CreateRequestParams {
  project_id: string;
  partner_company_id: string;
  request_type: PartnerRequestType;
  gaps_to_fill?: string[];
  requested_service?: string;
  message?: string;
}

export const partnerRequestService = {
  async list(filters?: { status?: string; project_id?: string; request_type?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.project_id) params.set('project_id', filters.project_id);
    if (filters?.request_type) params.set('request_type', filters.request_type);
    const query = params.toString();
    const { data } = await apiClient.get<{ data: PartnerRequest[] }>(
      `/partner-requests${query ? `?${query}` : ''}`
    );
    return data ?? [];
  },

  async create(params: CreateRequestParams) {
    const { data } = await apiClient.post<{ data: PartnerRequest }>('/partner-requests', params);
    return data;
  },

  async updateStatus(id: string, status: 'accepted' | 'declined' | 'viewed') {
    const { data } = await apiClient.patch<{ data: PartnerRequest }>(`/partner-requests/${id}`, { status });
    return data;
  },
};

import { apiClient } from '@/lib/api-client';
import { UserRole, ApiResponse } from '@/types';

export const adminApi = {
  async provisionUser(email: string, role: UserRole, password?: string): Promise<ApiResponse<any>> {
    return apiClient
      .post<{ data: any; message: string }>('/admin/users', { email, role, password })
      .then(r => ({ data: r.data, message: r.message }))
      .catch(e => ({ error: e.message }));
  },
};

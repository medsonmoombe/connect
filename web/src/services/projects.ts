import { apiClient } from '@/lib/api-client';
import { Project, ProjectTechRequirements, ProjectDocument, CapitalMatchResult, TechnicalMatchResult } from '@/types';
import { storageService } from '@/lib/storage';

export const projectService = {
  async createProject(projectData: Partial<Project>): Promise<Project> {
    const { data } = await apiClient.post<{ data: Project }>('/projects', projectData);
    return data;
  },

  async runMatchingEngine(projectId: string) {
    try {
      await apiClient.post('/matching/run', { project_id: projectId });
    } catch (err) {
      console.error('Error running matching engine:', err);
    }
  },

  async getProjectMatches(projectId: string) {
    const { capital, technical } = await apiClient.get<{ capital: CapitalMatchResult[]; technical: TechnicalMatchResult[] }>(
      `/projects/${projectId}?resource=matches`
    );
    return { capital, technical };
  },

  async getProjectDetails(projectId: string): Promise<Project> {
    const { data } = await apiClient.get<{ data: Project }>(`/projects/${projectId}`);
    return data;
  },

  async getDeveloperProjects(developerId: string): Promise<Project[]> {
    const { data } = await apiClient.get<{ data: Project[] }>('/projects');
    return data;
  },

  async getPendingInternalReview(): Promise<Project[]> {
    const { data } = await apiClient.get<{ data: Project[] }>('/projects?pending_internal_review=true');
    return data;
  },

  async updateProject(projectId: string, updates: Partial<Project>): Promise<Project> {
    const { data } = await apiClient.patch<{ data: Project }>(`/projects/${projectId}`, updates);
    return data;
  },

  async updateTechRequirements(requirements: ProjectTechRequirements) {
    const { data } = await apiClient.patch<{ data: any }>(
      `/projects/${requirements.project_id}`,
      { _resource: 'tech_requirements', ...requirements }
    );
    return data;
  },

  async saveProjectScores(scores: any) {
    const { data } = await apiClient.patch<{ data: any }>(
      `/projects/${scores.project_id}`,
      { _resource: 'scores', ...scores }
    );
    return data;
  },

  async getProjectScores(projectId: string) {
    const { data } = await apiClient.get<{ data: any }>(`/projects/${projectId}?resource=scores`);
    return data;
  },

  async addProjectDocument(document: Partial<ProjectDocument>): Promise<ProjectDocument> {
    const { data } = await apiClient.post<{ data: ProjectDocument }>(`/projects/${document.project_id}/documents`, document);
    return data;
  },

  async deleteProjectDocument(documentId: string, storagePath?: string, projectIdOverride?: string): Promise<void> {
    const projectId = storagePath?.split('/')[0] || projectIdOverride;
    if (!projectId) throw new Error('Project id required to delete document');

    if (storagePath) {
      await apiClient.delete(`/projects/${projectId}/documents/upload?storage_path=${encodeURIComponent(storagePath)}`).catch(() => {});
    }
    await apiClient.delete(`/projects/${projectId}/documents?document_id=${documentId}`);
  },

  async deleteProject(projectId: string): Promise<boolean> {
    try {
      await storageService.deleteProjectFolder(projectId);
    } catch (e) {
      console.warn('Storage deletion failed, continuing:', e);
    }
    await apiClient.delete(`/projects/${projectId}`);
    return true;
  },

  async getRecommendedProjects(partnerId: string, type: 'CAPITAL' | 'TECHNICAL') {
    const table = type === 'CAPITAL' ? 'capital' : 'technical';
    const { data } = await apiClient.get<{ data: any[] }>(`/projects?matches_for=${partnerId}&type=${table}`);
    return data;
  },

  async submitProject(projectId: string) {
    const { data } = await apiClient.post<{ data: { status: string } }>(`/projects/${projectId}/submit`, {});
    return data;
  },

  async reviewProject(projectId: string) {
    const { data } = await apiClient.post<{ data: { status: string } }>(`/projects/${projectId}/review`, {});
    return data;
  },

  async validateProject(projectId: string) {
    const { data } = await apiClient.post<{ data: { status: string } }>(`/projects/${projectId}/validate`, {});
    return data;
  },

  async rejectProject(projectId: string, reason: string) {
    const { data } = await apiClient.post<{ data: { status: string } }>(`/projects/${projectId}/reject`, { reason });
    return data;
  },

  async archiveProject(projectId: string) {
    const { data } = await apiClient.post<{ data: { status: string } }>(`/projects/${projectId}/archive`, {});
    return data;
  },

  async internalReviewProject(projectId: string, action: 'approve' | 'reject', reason?: string) {
    const { data } = await apiClient.post<{ data: { status: string; feedback?: string } }>(
      `/projects/${projectId}/internal-review`,
      { action, reason }
    );
    return data;
  },
};

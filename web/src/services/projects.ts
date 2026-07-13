import { apiClient } from '@/lib/api-client';
import { Project, ProjectTechRequirements, ProjectDocument, CapitalMatchResult, TechnicalMatchResult } from '@/types';
import { calculateCapitalMatchScore, calculateTechnicalMatchScore } from '@/lib/scoring';
import { storageService } from '@/lib/storage';

export const projectService = {
  async createProject(projectData: Partial<Project>): Promise<Project> {
    const { data } = await apiClient.post<{ data: Project }>('/projects', projectData);
    await this.runMatchingEngine(data.id);
    return data;
  },

  async runMatchingEngine(projectId: string) {
    try {
      const project = await this.getProjectDetails(projectId);
      if (!project) return;

      const [{ data: capitalPartners }, { data: technicalPartners }] = await Promise.all([
        apiClient.get<{ data: any[] }>('/partners?type=capital'),
        apiClient.get<{ data: any[] }>('/partners?type=technical'),
      ]);

      const { data: engagements } = await apiClient.get<{ data: any[] }>(`/engagements?project_id=${projectId}`);
      const ACCEPTED = ['INTRO_ACCEPTED', 'NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED'];
      const hasAcceptedEPC = (engagements || []).some(e => e.counterparty_type === 'TECHNICAL' && ACCEPTED.includes(e.status));

      if (capitalPartners) {
        for (const match of capitalPartners.map(p => calculateCapitalMatchScore(project, p, hasAcceptedEPC))) {
          await apiClient.post('/projects/' + projectId + '/matches/capital', match).catch(() => {});
        }
      }
      if (technicalPartners) {
        for (const match of technicalPartners.map(p => calculateTechnicalMatchScore(project, p))) {
          await apiClient.post('/projects/' + projectId + '/matches/technical', match).catch(() => {});
        }
      }
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

  async deleteProjectDocument(documentId: string, storagePath?: string): Promise<void> {
    if (storagePath) {
      const projectId = storagePath.split('/')[0];
      await apiClient.delete(`/projects/${projectId}/documents/upload?storage_path=${encodeURIComponent(storagePath)}`).catch(() => {});
    }
    await apiClient.delete(`/projects/documents?document_id=${documentId}`);
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
};

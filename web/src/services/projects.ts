import { supabase } from '@/lib/supabase';
import { Project, ProjectTechRequirements, ProjectDocument } from '@/types';

export const projectService = {
  /**
   * Create a new project
   */
  async createProject(projectData: Partial<Project>) {
    const { data, error } = await supabase
      .from('projects')
      .insert([projectData])
      .select()
      .single();

    if (error) throw error;
    return data as Project;
  },

  /**
   * Update project technical requirements
   */
  async updateTechRequirements(requirements: ProjectTechRequirements) {
    const { data, error } = await supabase
      .from('project_tech_requirements')
      .upsert([requirements])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Add project document
   */
  async addProjectDocument(document: Partial<ProjectDocument>) {
    const { data, error } = await supabase
      .from('project_documents')
      .insert([document])
      .select()
      .single();

    if (error) throw error;
    return data as ProjectDocument;
  },

  /**
   * Save or update project scores
   */
  async saveProjectScores(scores: any) {
    const { data, error } = await supabase
      .from('project_scores')
      .upsert([scores], { onConflict: 'project_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get project scores
   */
  async getProjectScores(projectId: string) {
    const { data, error } = await supabase
      .from('project_scores')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  /**
   * Get projects for a developer
   */
  async getDeveloperProjects(developerId: string) {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        scores:project_scores(*),
        documents:project_documents(*)
      `)
      .eq('developer_id', developerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Project[];
  },

  /**
   * Get project details
   */
  async getProjectDetails(projectId: string) {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        tech_requirements:project_tech_requirements(*),
        documents:project_documents(*),
        scores:project_scores(*),
        developer:companies(*)
      `)
      .eq('id', projectId)
      .single();

    if (error) throw error;
    return data as Project;
  },

  /**
   * Delete a project
   */
  async deleteProject(projectId: string) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) throw error;
    return true;
  }
};

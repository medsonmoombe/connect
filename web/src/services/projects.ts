import { supabase } from '@/lib/supabase';
import { Project, ProjectTechRequirements, ProjectDocument, CapitalMatchResult, TechnicalMatchResult, CapitalPartner, TechnicalPartner } from '@/types';
import { calculateCapitalMatchScore, calculateTechnicalMatchScore } from '@/lib/scoring';
import { storageService } from '@/lib/storage';

const ACCEPTED_TECHNICAL_STATUSES = [
  'INTRO_ACCEPTED',
  'NDA_SIGNED',
  'DUE_DILIGENCE',
  'TERM_SHEET',
  'CONTRACT_SIGNED',
  'CAPITAL_COMMITTED',
  'CLOSED',
];

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
    
    // Trigger initial matching
    await this.runMatchingEngine(data.id);
    
    return data as Project;
  },

  /**
   * Run the matching engine for a project
   */
  async runMatchingEngine(projectId: string) {
    try {
      // 1. Fetch project details
      const project = await this.getProjectDetails(projectId);
      if (!project) return;

      // 2. Check for accepted EPC (Technical Partner)
      const { data: acceptedEPC } = await supabase
        .from('engagements')
        .select('id')
        .eq('project_id', projectId)
        .eq('counterparty_type', 'TECHNICAL')
        .in('status', ACCEPTED_TECHNICAL_STATUSES)
        .maybeSingle();
      
      const hasAcceptedEPC = !!acceptedEPC;

      // 3. Fetch all partners (optionally filter by verification status)
      const { data: capitalPartners } = await supabase.from('capital_partners').select('*, company:companies(*)');
      const { data: technicalPartners } = await supabase.from('technical_partners').select('*, company:companies(*)');

      // 4. Calculate and save capital matches
      if (capitalPartners) {
        const capitalMatches = capitalPartners.map(partner => 
          calculateCapitalMatchScore(project, partner as CapitalPartner, hasAcceptedEPC)
        );
        
        // Save to Supabase (upsert)
        for (const match of capitalMatches) {
          await supabase.from('capital_match_results').upsert({
            project_id: projectId,
            capital_partner_id: match.capital_partner_id,
            compatibility_score: match.compatibility_score,
            score_breakdown: match.score_breakdown
          }, { onConflict: 'project_id,capital_partner_id' });
        }
      }

      // 5. Calculate and save technical matches
      if (technicalPartners) {
        const technicalMatches = technicalPartners.map(partner => 
          calculateTechnicalMatchScore(project, partner as TechnicalPartner)
        );
        
        // Save to Supabase (upsert)
        for (const match of technicalMatches) {
          await supabase.from('technical_match_results').upsert({
            project_id: projectId,
            technical_partner_id: match.technical_partner_id,
            compatibility_score: match.compatibility_score,
            score_breakdown: match.score_breakdown,
            status: 'active'
          }, { onConflict: 'project_id,technical_partner_id' });
        }
      }
    } catch (err) {
      console.error('Error running matching engine:', err);
    }
  },

  /**
   * Get match results for a project
   */
  async getProjectMatches(projectId: string) {
    const { data: capitalMatches, error: capError } = await supabase
      .from('capital_match_results')
      .select(`
        *,
        capital_partner:capital_partners(
          *,
          company:companies(*)
        )
      `)
      .eq('project_id', projectId)
      .order('compatibility_score', { ascending: false });

    const { data: technicalMatches, error: techError } = await supabase
      .from('technical_match_results')
      .select(`
        *,
        technical_partner:technical_partners(
          *,
          company:companies(*)
        )
      `)
      .eq('project_id', projectId)
      .order('compatibility_score', { ascending: false });

    if (capError) throw capError;
    if (techError) throw techError;

    return {
      capital: capitalMatches as CapitalMatchResult[],
      technical: technicalMatches as TechnicalMatchResult[]
    };
  },

  /**
   * Get recommended projects for a partner
   */
  async getRecommendedProjects(partnerId: string, type: 'CAPITAL' | 'TECHNICAL') {
    const table = type === 'CAPITAL' ? 'capital_match_results' : 'technical_match_results';
    const partnerIdField = type === 'CAPITAL' ? 'capital_partner_id' : 'technical_partner_id';

    const { data, error } = await supabase
      .from(table)
      .select(`
        *,
        project:projects(
          *,
          developer:companies(*)
        )
      `)
      .eq(partnerIdField, partnerId)
      .order('compatibility_score', { ascending: false })
      .limit(10);

    if (error) throw error;
    return data;
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
   * Delete project document
   */
  async deleteProjectDocument(documentId: string) {
    const { error } = await supabase
      .from('project_documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
    return true;
  },

  /**
   * Save or update project scores
   */
  async saveProjectScores(scores: any) {
    // Ensure all score fields are integers before upserting
    const sanitizedScores = {
      ...scores,
      capital_readiness_score: Math.round(scores.capital_readiness_score || 0),
      regulatory_score: Math.round(scores.regulatory_score || 0),
      financial_score: Math.round(scores.financial_score || 0),
      developer_score: Math.round(scores.developer_score || 0),
      technical_readiness_score: Math.round(scores.technical_readiness_score || 0),
      documentation_score: Math.round(scores.documentation_score || 0),
      governance_score: Math.round(scores.governance_score || 0),
      financial_transparency_score: Math.round(scores.financial_transparency_score || 0)
    };

    const { data, error } = await supabase
      .from('project_scores')
      .upsert([sanitizedScores], { onConflict: 'project_id' })
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
   * Update a project
   */
  async updateProject(projectId: string, updates: Partial<Project>) {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw error;
    return data as Project;
  },

  /**
   * Delete a project and all associated data
   */
  async deleteProject(projectId: string) {
    // 1. Delete files from Firebase Storage
    try {
      await storageService.deleteProjectFolder(projectId);
    } catch (storageError) {
      console.warn('Could not delete storage folder, proceeding with DB deletion:', storageError);
    }

    // 2. Delete from Supabase
    // Note: If cascading deletes are set up in the DB, this will clean up 
    // project_scores, project_documents, match_results, etc.
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) throw error;
    return true;
  }
};

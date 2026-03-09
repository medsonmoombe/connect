import { EngagementStatus, Engagement } from '@/types';
import { supabase } from './supabase';

// Engagement State Machine
// Valid transitions based on the design document:
// INTRO_SENT → INTRO_ACCEPTED → NDA_SIGNED → DUE_DILIGENCE → TERM_SHEET → CLOSED
// DROPPED is allowed at any stage

export const ENGAGEMENT_STATES: EngagementStatus[] = [
  'INTRO_SENT',
  'INTRO_ACCEPTED',
  'NDA_SIGNED',
  'DUE_DILIGENCE',
  'TERM_SHEET',
  'CLOSED',
  'DROPPED',
];

// State transition map - defines valid next states from each current state
export const STATE_TRANSITIONS: Record<EngagementStatus, EngagementStatus[]> = {
  INTRO_SENT: ['INTRO_ACCEPTED', 'DROPPED'],
  INTRO_ACCEPTED: ['NDA_SIGNED', 'DROPPED'],
  NDA_SIGNED: ['DUE_DILIGENCE', 'DROPPED'],
  DUE_DILIGENCE: ['TERM_SHEET', 'DROPPED'],
  TERM_SHEET: ['CLOSED', 'DROPPED'],
  CLOSED: [], // Terminal state
  DROPPED: [], // Terminal state
  // Compatibility for old states if they exist in DB
  CONTRACT_SIGNED: ['CAPITAL_COMMITTED', 'DROPPED'],
  CAPITAL_COMMITTED: ['CLOSED', 'DROPPED'],
};

// Check if a state transition is valid
export function isValidTransition(
  currentState: EngagementStatus,
  nextState: EngagementStatus
): boolean {
  const validNextStates = STATE_TRANSITIONS[currentState];
  return validNextStates?.includes(nextState) ?? false;
}

// Get all valid next states for a given current state
export function getValidNextStates(currentState: EngagementStatus): EngagementStatus[] {
  return STATE_TRANSITIONS[currentState] ?? [];
}

// Check if a state is a terminal state
export function isTerminalState(state: EngagementStatus): boolean {
  return state === 'CLOSED' || state === 'DROPPED';
}

// Get the display label for a state
export function getStateLabel(state: EngagementStatus): string {
  const labels: Record<string, string> = {
    INTRO_SENT: 'Introduction Sent',
    INTRO_ACCEPTED: 'Introduction Accepted',
    NDA_SIGNED: 'NDA Signed',
    DUE_DILIGENCE: 'Due Diligence',
    TERM_SHEET: 'Term Sheet',
    CLOSED: 'Closed',
    DROPPED: 'Dropped',
    CONTRACT_SIGNED: 'Contract Signed',
    CAPITAL_COMMITTED: 'Capital Committed',
  };
  return labels[state] ?? state;
}

// Get the progress percentage for a state
export function getStateProgress(state: EngagementStatus): number {
  const progress: Record<string, number> = {
    INTRO_SENT: 16,
    INTRO_ACCEPTED: 33,
    NDA_SIGNED: 50,
    DUE_DILIGENCE: 66,
    TERM_SHEET: 83,
    CLOSED: 100,
    DROPPED: 0,
    CONTRACT_SIGNED: 75,
    CAPITAL_COMMITTED: 90,
  };
  return progress[state] ?? 0;
}

// Engagement Service Class
export class EngagementService {
  /**
   * Fetch an engagement by ID with project and developer info
   */
  static async getEngagement(id: string) {
    const { data, error } = await supabase
      .from('engagements')
      .select(`
        *,
        project:projects(*, developer:companies(*)),
        messages(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Fetch all engagements for a project
   */
  static async getProjectEngagements(projectId: string) {
    const { data, error } = await supabase
      .from('engagements')
      .select('*, project:projects(name)')
      .eq('project_id', projectId);

    if (error) throw error;
    return data;
  }

  /**
   * Fetch all engagements for a company (either as developer or counterparty)
   */
  static async getCompanyEngagements(companyId: string) {
    // This is a bit complex as we need to check both project.developer_id and counterparty_id
    // For now, let's fetch based on counterparty_id first
    const { data: asCounterparty, error: err1 } = await supabase
      .from('engagements')
      .select('*, project:projects(*, developer:companies(*))')
      .eq('counterparty_id', companyId);

    if (err1) throw err1;

    // Fetch projects owned by this company to get engagements where they are the developer
    const { data: myProjects, error: err2 } = await supabase
      .from('projects')
      .select('id')
      .eq('developer_id', companyId);

    if (err2) throw err2;

    const projectIds = myProjects.map(p => p.id);
    const { data: asDeveloper, error: err3 } = await supabase
      .from('engagements')
      .select('*, project:projects(*, developer:companies(*))')
      .in('project_id', projectIds);

    if (err3) throw err3;

    // Combine and deduplicate
    const combined = [...asCounterparty, ...asDeveloper];
    const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
    
    return unique;
  }

  /**
   * Create a new engagement (Request Introduction)
   */
  static async requestIntroduction(projectId: string, counterpartyId: string, counterpartyType: 'CAPITAL' | 'TECHNICAL') {
    const { data, error } = await supabase
      .from('engagements')
      .insert([{
        project_id: projectId,
        counterparty_id: counterpartyId,
        counterparty_type: counterpartyType,
        status: 'INTRO_SENT'
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Accept an introduction
   */
  static async acceptIntroduction(engagementId: string) {
    return this.updateStatus(engagementId, 'INTRO_ACCEPTED');
  }

  /**
   * Update engagement status with validation
   */
  static async updateStatus(engagementId: string, nextStatus: EngagementStatus) {
    // 1. Get current status
    const { data: current, error: fetchErr } = await supabase
      .from('engagements')
      .select('status')
      .eq('id', engagementId)
      .single();

    if (fetchErr) throw fetchErr;

    // 2. Validate transition
    if (current.status !== nextStatus && !isValidTransition(current.status as EngagementStatus, nextStatus)) {
      if (nextStatus !== 'DROPPED') { // Allow dropping from anywhere
        throw new Error(`Invalid transition from ${current.status} to ${nextStatus}`);
      }
    }

    // 3. Update
    const { data, error } = await supabase
      .from('engagements')
      .update({ 
        status: nextStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', engagementId)
      .select()
      .single();

    if (error) throw error;
    
    // 4. Create internal notification (checkpoint alert)
    // For now, we'll just log to audit_logs or similar if needed
    // In a real app, this might trigger an email or pusher event
    
    return data;
  }

  /**
   * Reveal contact info?
   * Logic: Reveal only if status is INTRO_ACCEPTED or further
   */
  static canSeeContactInfo(status: EngagementStatus): boolean {
    const allowedStates: EngagementStatus[] = [
      'INTRO_ACCEPTED',
      'NDA_SIGNED',
      'DUE_DILIGENCE',
      'TERM_SHEET',
      'CLOSED',
      'CONTRACT_SIGNED',
      'CAPITAL_COMMITTED'
    ];
    return allowedStates.includes(status);
  }
}

// Export static methods also as top-level functions for easier importing if desired
export const canSeeContactInfo = EngagementService.canSeeContactInfo;

export const engagementService = EngagementService;

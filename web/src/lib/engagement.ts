import { EngagementStatus, Engagement } from '@/types';
import { apiClient } from './api-client';
import { projectService } from '@/services/projects';

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

export const ACCEPTED_TECHNICAL_STATUSES: EngagementStatus[] = [
  'INTRO_ACCEPTED',
  'NDA_SIGNED',
  'DUE_DILIGENCE',
  'TERM_SHEET',
  'CONTRACT_SIGNED',
  'CAPITAL_COMMITTED',
  'CLOSED',
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
    const { data } = await apiClient.get<{ data: any }>(`/engagements/${id}`);
    return data;
  }

  /**
   * Fetch all engagements for a project
   */
  static async getProjectEngagements(projectId: string) {
    const { data } = await apiClient.get<{ data: any[] }>(`/engagements?project_id=${projectId}`);
    return data;
  }

  /**
   * Fetch all engagements for a company (either as developer or counterparty)
   */
  static async getCompanyEngagements(companyId: string) {
    const { data } = await apiClient.get<{ data: any[] }>(`/engagements?counterparty_id=${companyId}`);
    return data || [];
  }

  /**
   * Create a new engagement (Request Introduction)
   */
  static async requestIntroduction(projectId: string, counterpartyId: string, counterpartyType: 'CAPITAL' | 'TECHNICAL') {
    const { data } = await apiClient.post<{ data: any }>('/engagements', {
      project_id: projectId,
      counterparty_id: counterpartyId,
      counterparty_type: counterpartyType,
      status: 'INTRO_SENT',
    });
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
    const current = await this.getEngagement(engagementId);

    if (current.status !== nextStatus && !isValidTransition(current.status as EngagementStatus, nextStatus)) {
      if (nextStatus !== 'DROPPED') {
        throw new Error(`Invalid transition from ${current.status} to ${nextStatus}`);
      }
    }

    const { data } = await apiClient.patch<{ data: any }>(`/engagements/${engagementId}`, { status: nextStatus });

    if (current.counterparty_type === 'TECHNICAL' && ACCEPTED_TECHNICAL_STATUSES.includes(nextStatus)) {
      await projectService.runMatchingEngine(current.project_id);
    }

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

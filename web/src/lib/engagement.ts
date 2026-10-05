import { EngagementStatus, Engagement, CounterpartyType } from '@/types';
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
  'CONTRACT_SIGNED',
  'CAPITAL_COMMITTED',
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
  TERM_SHEET: ['CONTRACT_SIGNED', 'DROPPED'],
  CONTRACT_SIGNED: ['CAPITAL_COMMITTED', 'DROPPED'],
  CAPITAL_COMMITTED: ['CLOSED', 'DROPPED'],
  CLOSED: [],
  DROPPED: [],
};

// ── Role-based transitions ───────────────────────────────────────────────────
// Each non-DROPPED transition is owned by one party. DROPPED is always 'either'.

export type TransitionRole = 'developer' | 'counterparty' | 'either';

const TRANSITION_ROLES: Record<string, TransitionRole> = {
  'INTRO_SENT→INTRO_ACCEPTED': 'developer',
  'INTRO_ACCEPTED→NDA_SIGNED': 'counterparty',
  'NDA_SIGNED→DUE_DILIGENCE': 'developer',
  'DUE_DILIGENCE→TERM_SHEET': 'counterparty',
  'TERM_SHEET→CONTRACT_SIGNED': 'developer',
  'CONTRACT_SIGNED→CAPITAL_COMMITTED': 'counterparty',
  'CAPITAL_COMMITTED→CLOSED': 'developer',
};

/** Returns which role is allowed to perform a given transition.
 *
 * `introOrigin` disambiguates the INTRO_SENT → INTRO_ACCEPTED step, which is
 * performed by the party that did NOT initiate the request:
 *   • 'developer' → the developer requested the introduction, so the
 *     COUNTERPARTY (partner) accepts it.
 *   • 'partner'/null → the partner expressed interest, so the DEVELOPER
 *     accepts it (legacy behaviour for rows created before intro_origin).
 */
export function getTransitionRole(
  currentState: EngagementStatus,
  nextState: EngagementStatus,
  introOrigin?: 'developer' | 'partner' | null
): TransitionRole {
  if (nextState === 'DROPPED') return 'either';
  if (currentState === 'INTRO_SENT' && nextState === 'INTRO_ACCEPTED') {
    return introOrigin === 'developer' ? 'counterparty' : 'developer';
  }
  return TRANSITION_ROLES[`${currentState}→${nextState}`] ?? 'either';
}

/** Returns the next states the given role is allowed to trigger. */
export function getTransitionsForRole(
  currentState: EngagementStatus,
  userRole: TransitionRole | null,
  introOrigin?: 'developer' | 'partner' | null
): EngagementStatus[] {
  if (!userRole) return [];
  const all = STATE_TRANSITIONS[currentState] ?? [];
  return all.filter(ns => {
    const required = getTransitionRole(currentState, ns, introOrigin);
    return required === 'either' || required === userRole;
  });
}

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
    CONTRACT_SIGNED: 'Contract Signed',
    CAPITAL_COMMITTED: 'Capital Committed',
    CLOSED: 'Closed',
    DROPPED: 'Dropped',
  };
  return labels[state] ?? state;
}

// Get the progress percentage for a state
export function getStateProgress(state: EngagementStatus): number {
  const progress: Record<string, number> = {
    INTRO_SENT: 12,
    INTRO_ACCEPTED: 25,
    NDA_SIGNED: 37,
    DUE_DILIGENCE: 50,
    TERM_SHEET: 62,
    CONTRACT_SIGNED: 75,
    CAPITAL_COMMITTED: 88,
    CLOSED: 100,
    DROPPED: 0,
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
    // No filter needed — the API GET handler resolves both developer projects
    // and partner counterparty records server-side based on the authenticated user
    const { data } = await apiClient.get<{ data: any[] }>('/engagements?include_messages=true');
    return data || [];
  }

  /**
   * Create a new engagement (Request Introduction)
   */
  static async requestIntroduction(
    projectId: string,
    counterpartyId: string,
    counterpartyType: CounterpartyType,
    options?: {
      message?: string;
      requestOrigin?: 'developer' | 'partner';
      requestType?: 'introduction' | 'quote' | 'meeting';
      gapIds?: string[];
      requestedService?: string;
    }
  ) {
    const { data } = await apiClient.post<{ data: any }>('/engagements', {
      project_id: projectId,
      counterparty_id: counterpartyId,
      counterparty_type: counterpartyType,
      status: 'INTRO_SENT',
      message: options?.message,
      request_origin: options?.requestOrigin,
      request_type: options?.requestType,
      gap_ids: options?.gapIds,
      requested_service: options?.requestedService,
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
    ];
    return allowedStates.includes(status);
  }
}

// Export static methods also as top-level functions for easier importing if desired
export const canSeeContactInfo = EngagementService.canSeeContactInfo;

export const engagementService = EngagementService;

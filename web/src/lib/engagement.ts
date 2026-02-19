import { EngagementStatus } from '@/types';

// Engagement State Machine
// Valid transitions based on the design document:
// INTRO_SENT → INTRO_ACCEPTED → DUE_DILIGENCE → TERM_SHEET → CONTRACT_SIGNED → CAPITAL_COMMITTED → CLOSED
// DROPPED is allowed at any stage

export const ENGAGEMENT_STATES: EngagementStatus[] = [
  'INTRO_SENT',
  'INTRO_ACCEPTED',
  'DUE_DILIGENCE',
  'TERM_SHEET',
  'CONTRACT_SIGNED',
  'CAPITAL_COMMITTED',
  'CLOSED',
  'DROPPED',
];

// State transition map - defines valid next states from each current state
export const STATE_TRANSITIONS: Record<EngagementStatus, EngagementStatus[]> = {
  INTRO_SENT: ['INTRO_ACCEPTED', 'DROPPED'],
  INTRO_ACCEPTED: ['DUE_DILIGENCE', 'DROPPED'],
  DUE_DILIGENCE: ['TERM_SHEET', 'DROPPED'],
  TERM_SHEET: ['CONTRACT_SIGNED', 'DROPPED'],
  CONTRACT_SIGNED: ['CAPITAL_COMMITTED', 'DROPPED'],
  CAPITAL_COMMITTED: ['CLOSED', 'DROPPED'],
  CLOSED: [], // Terminal state - no transitions allowed
  DROPPED: [], // Terminal state - no transitions allowed
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
  const labels: Record<EngagementStatus, string> = {
    INTRO_SENT: 'Introduction Sent',
    INTRO_ACCEPTED: 'Introduction Accepted',
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
  const progress: Record<EngagementStatus, number> = {
    INTRO_SENT: 14,
    INTRO_ACCEPTED: 28,
    DUE_DILIGENCE: 42,
    TERM_SHEET: 57,
    CONTRACT_SIGNED: 71,
    CAPITAL_COMMITTED: 85,
    CLOSED: 100,
    DROPPED: 0,
  };
  return progress[state] ?? 0;
}

// Engagement Service Class
export class EngagementService {
  // Validate and transition an engagement to a new state
  static validateTransition(
    currentState: EngagementStatus,
    nextState: EngagementStatus
  ): { valid: boolean; error?: string } {
    if (currentState === nextState) {
      return { valid: false, error: 'New state must be different from current state' };
    }

    if (!isValidTransition(currentState, nextState)) {
      return {
        valid: false,
        error: `Invalid transition from ${currentState} to ${nextState}. Valid transitions: ${getValidNextStates(currentState).join(', ')}`,
      };
    }

    return { valid: true };
  }

  // Process a state transition with validation
  static async transition(
    currentState: EngagementStatus,
    nextState: EngagementStatus,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _updateFn: (state: EngagementStatus) => Promise<void>
  ): Promise<{ success: boolean; error?: string }> {
    const validation = this.validateTransition(currentState, nextState);
    
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      await _updateFn(nextState);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update engagement state' 
      };
    }
  }

  // Get all available actions for a given state
  static getAvailableActions(currentState: EngagementStatus): { action: string; nextState: EngagementStatus }[] {
    const validNextStates = getValidNextStates(currentState);
    
    return validNextStates.map(state => ({
      action: `Move to ${getStateLabel(state)}`,
      nextState: state,
    }));
  }
}

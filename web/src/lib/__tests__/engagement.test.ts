import { describe, it, expect } from 'vitest';
import type { EngagementStatus } from '@/types';
import {
  ENGAGEMENT_STATES,
  ACCEPTED_TECHNICAL_STATUSES,
  STATE_TRANSITIONS,
  isValidTransition,
  getValidNextStates,
  isTerminalState,
  getStateLabel,
  getStateProgress,
  getTransitionRole,
  getTransitionsForRole,
  canSeeContactInfo,
} from '../engagement';

describe('ENGAGEMENT_STATES', () => {
  it('contains all 9 engagement states in order', () => {
    expect(ENGAGEMENT_STATES).toEqual([
      'INTRO_SENT',
      'INTRO_ACCEPTED',
      'NDA_SIGNED',
      'DUE_DILIGENCE',
      'TERM_SHEET',
      'CONTRACT_SIGNED',
      'CAPITAL_COMMITTED',
      'CLOSED',
      'DROPPED',
    ]);
  });
});

describe('ACCEPTED_TECHNICAL_STATUSES', () => {
  it('includes all post-intro states except DROPPED', () => {
    expect(ACCEPTED_TECHNICAL_STATUSES).toEqual([
      'INTRO_ACCEPTED',
      'NDA_SIGNED',
      'DUE_DILIGENCE',
      'TERM_SHEET',
      'CONTRACT_SIGNED',
      'CAPITAL_COMMITTED',
      'CLOSED',
    ]);
  });

  it('does not include INTRO_SENT or DROPPED', () => {
    expect(ACCEPTED_TECHNICAL_STATUSES).not.toContain('INTRO_SENT');
    expect(ACCEPTED_TECHNICAL_STATUSES).not.toContain('DROPPED');
  });
});

describe('STATE_TRANSITIONS', () => {
  it('INTRO_SENT can go to INTRO_ACCEPTED or DROPPED', () => {
    expect(STATE_TRANSITIONS.INTRO_SENT).toEqual(['INTRO_ACCEPTED', 'DROPPED']);
  });

  it('INTRO_ACCEPTED can go to NDA_SIGNED or DROPPED', () => {
    expect(STATE_TRANSITIONS.INTRO_ACCEPTED).toEqual(['NDA_SIGNED', 'DROPPED']);
  });

  it('NDA_SIGNED can go to DUE_DILIGENCE or DROPPED', () => {
    expect(STATE_TRANSITIONS.NDA_SIGNED).toEqual(['DUE_DILIGENCE', 'DROPPED']);
  });

  it('DUE_DILIGENCE can go to TERM_SHEET or DROPPED', () => {
    expect(STATE_TRANSITIONS.DUE_DILIGENCE).toEqual(['TERM_SHEET', 'DROPPED']);
  });

  it('TERM_SHEET can go to CONTRACT_SIGNED or DROPPED', () => {
    expect(STATE_TRANSITIONS.TERM_SHEET).toEqual(['CONTRACT_SIGNED', 'DROPPED']);
  });

  it('CONTRACT_SIGNED can go to CAPITAL_COMMITTED or DROPPED', () => {
    expect(STATE_TRANSITIONS.CONTRACT_SIGNED).toEqual(['CAPITAL_COMMITTED', 'DROPPED']);
  });

  it('CAPITAL_COMMITTED can go to CLOSED or DROPPED', () => {
    expect(STATE_TRANSITIONS.CAPITAL_COMMITTED).toEqual(['CLOSED', 'DROPPED']);
  });

  it('CLOSED is terminal (no next states)', () => {
    expect(STATE_TRANSITIONS.CLOSED).toEqual([]);
  });

  it('DROPPED is terminal (no next states)', () => {
    expect(STATE_TRANSITIONS.DROPPED).toEqual([]);
  });

  it('every state has DROPPED as an option except CLOSED and DROPPED', () => {
    for (const [state, transitions] of Object.entries(STATE_TRANSITIONS)) {
      if (state === 'CLOSED' || state === 'DROPPED') {
        expect(transitions).not.toContain('DROPPED');
      } else {
        expect(transitions).toContain('DROPPED');
      }
    }
  });
});

describe('isValidTransition', () => {
  it('allows INTRO_SENT→INTRO_ACCEPTED', () => {
    expect(isValidTransition('INTRO_SENT', 'INTRO_ACCEPTED')).toBe(true);
  });

  it('allows CAPITAL_COMMITTED→CLOSED', () => {
    expect(isValidTransition('CAPITAL_COMMITTED', 'CLOSED')).toBe(true);
  });

  it('allows dropping at any stage', () => {
    expect(isValidTransition('INTRO_SENT', 'DROPPED')).toBe(true);
    expect(isValidTransition('INTRO_ACCEPTED', 'DROPPED')).toBe(true);
    expect(isValidTransition('DUE_DILIGENCE', 'DROPPED')).toBe(true);
    expect(isValidTransition('TERM_SHEET', 'DROPPED')).toBe(true);
    expect(isValidTransition('CONTRACT_SIGNED', 'DROPPED')).toBe(true);
    expect(isValidTransition('CAPITAL_COMMITTED', 'DROPPED')).toBe(true);
  });

  it('reverts invalid transitions', () => {
    expect(isValidTransition('INTRO_SENT', 'CLOSED')).toBe(false);
    expect(isValidTransition('INTRO_ACCEPTED', 'DUE_DILIGENCE')).toBe(false);
    expect(isValidTransition('CLOSED', 'INTRO_SENT')).toBe(false);
    expect(isValidTransition('DROPPED', 'INTRO_SENT')).toBe(false);
  });

  it('does not allow dropping from CLOSED', () => {
    expect(isValidTransition('CLOSED', 'DROPPED')).toBe(false);
  });

  it('does not allow transition from DROPPED', () => {
    expect(isValidTransition('DROPPED', 'INTRO_SENT')).toBe(false);
  });
});

describe('getValidNextStates', () => {
  it('returns 2 states for INTRO_SENT', () => {
    expect(getValidNextStates('INTRO_SENT')).toEqual(['INTRO_ACCEPTED', 'DROPPED']);
  });

  it('returns empty array for CLOSED', () => {
    expect(getValidNextStates('CLOSED')).toEqual([]);
  });

  it('returns empty array for DROPPED', () => {
    expect(getValidNextStates('DROPPED')).toEqual([]);
  });

  it('returns empty array for unknown status', () => {
    expect(getValidNextStates('UNKNOWN_STATUS' as EngagementStatus)).toEqual([]);
  });
});

describe('isTerminalState', () => {
  it('CLOSED is terminal', () => {
    expect(isTerminalState('CLOSED')).toBe(true);
  });

  it('DROPPED is terminal', () => {
    expect(isTerminalState('DROPPED')).toBe(true);
  });

  it('all other states are not terminal', () => {
    const nonTerminal = ENGAGEMENT_STATES.filter(s => s !== 'CLOSED' && s !== 'DROPPED');
    for (const state of nonTerminal) {
      expect(isTerminalState(state)).toBe(false);
    }
  });
});

describe('getStateLabel', () => {
  it('returns human-readable labels', () => {
    expect(getStateLabel('INTRO_SENT')).toBe('Introduction Sent');
    expect(getStateLabel('INTRO_ACCEPTED')).toBe('Introduction Accepted');
    expect(getStateLabel('NDA_SIGNED')).toBe('NDA Signed');
    expect(getStateLabel('DUE_DILIGENCE')).toBe('Due Diligence');
    expect(getStateLabel('TERM_SHEET')).toBe('Term Sheet');
    expect(getStateLabel('CONTRACT_SIGNED')).toBe('Contract Signed');
    expect(getStateLabel('CAPITAL_COMMITTED')).toBe('Capital Committed');
    expect(getStateLabel('CLOSED')).toBe('Closed');
    expect(getStateLabel('DROPPED')).toBe('Dropped');
  });

  it('returns the status string itself for unknown status', () => {
    expect(getStateLabel('OTHER' as EngagementStatus)).toBe('OTHER');
  });
});

describe('getStateProgress', () => {
  it('returns 0 for DROPPED', () => {
    expect(getStateProgress('DROPPED')).toBe(0);
  });

  it('returns 100 for CLOSED', () => {
    expect(getStateProgress('CLOSED')).toBe(100);
  });

  it('returns incremental progress values', () => {
    expect(getStateProgress('INTRO_SENT')).toBe(12);
    expect(getStateProgress('INTRO_ACCEPTED')).toBe(25);
    expect(getStateProgress('NDA_SIGNED')).toBe(37);
    expect(getStateProgress('DUE_DILIGENCE')).toBe(50);
    expect(getStateProgress('TERM_SHEET')).toBe(62);
    expect(getStateProgress('CONTRACT_SIGNED')).toBe(75);
    expect(getStateProgress('CAPITAL_COMMITTED')).toBe(88);
  });

  it('returns 0 for unknown state', () => {
    expect(getStateProgress('OTHER' as EngagementStatus)).toBe(0);
  });
});

describe('getTransitionRole', () => {
  it('INTRO_SENT→INTRO_ACCEPTED requires developer', () => {
    expect(getTransitionRole('INTRO_SENT', 'INTRO_ACCEPTED')).toBe('developer');
  });

  it('INTRO_ACCEPTED→NDA_SIGNED requires counterparty', () => {
    expect(getTransitionRole('INTRO_ACCEPTED', 'NDA_SIGNED')).toBe('counterparty');
  });

  it('NDA_SIGNED→DUE_DILIGENCE requires developer', () => {
    expect(getTransitionRole('NDA_SIGNED', 'DUE_DILIGENCE')).toBe('developer');
  });

  it('DUE_DILIGENCE→TERM_SHEET requires counterparty', () => {
    expect(getTransitionRole('DUE_DILIGENCE', 'TERM_SHEET')).toBe('counterparty');
  });

  it('TERM_SHEET→CONTRACT_SIGNED requires developer', () => {
    expect(getTransitionRole('TERM_SHEET', 'CONTRACT_SIGNED')).toBe('developer');
  });

  it('CONTRACT_SIGNED→CAPITAL_COMMITTED requires counterparty', () => {
    expect(getTransitionRole('CONTRACT_SIGNED', 'CAPITAL_COMMITTED')).toBe('counterparty');
  });

  it('CAPITAL_COMMITTED→CLOSED requires developer', () => {
    expect(getTransitionRole('CAPITAL_COMMITTED', 'CLOSED')).toBe('developer');
  });

  it('DROPPED can be triggered by either party', () => {
    expect(getTransitionRole('INTRO_SENT', 'DROPPED')).toBe('either');
    expect(getTransitionRole('DUE_DILIGENCE', 'DROPPED')).toBe('either');
  });
});

describe('getTransitionsForRole', () => {
  it('returns only developer-owned transitions + DROPPED for developer role', () => {
    const transitions = getTransitionsForRole('INTRO_SENT', 'developer');
    expect(transitions).toContain('INTRO_ACCEPTED');
    expect(transitions).toContain('DROPPED');
    // Only these two
    expect(transitions.length).toBe(2);
  });

  it('returns only counterparty-owned transitions + DROPPED', () => {
    const transitions = getTransitionsForRole('INTRO_ACCEPTED', 'counterparty');
    expect(transitions).toContain('NDA_SIGNED');
    expect(transitions).toContain('DROPPED');
    expect(transitions.length).toBe(2);
  });

  it('returns only DROPPED for either role when no party-specific transition', () => {
    // At CLOSED, both roles can only... well CLOSED has no transitions
    const transitions = getTransitionsForRole('CLOSED', 'developer');
    expect(transitions).toEqual([]);
  });

  it('returns empty array for null role', () => {
    const transitions = getTransitionsForRole('INTRO_SENT', null);
    expect(transitions).toEqual([]);
  });

  it('returns empty array for unknown state', () => {
    const transitions = getTransitionsForRole('UNKNOWN' as EngagementStatus, 'developer');
    expect(transitions).toEqual([]);
  });
});

describe('canSeeContactInfo', () => {
  it('returns true for INTRO_ACCEPTED and beyond (except DROPPED)', () => {
    expect(canSeeContactInfo('INTRO_ACCEPTED')).toBe(true);
    expect(canSeeContactInfo('NDA_SIGNED')).toBe(true);
    expect(canSeeContactInfo('DUE_DILIGENCE')).toBe(true);
    expect(canSeeContactInfo('TERM_SHEET')).toBe(true);
    expect(canSeeContactInfo('CLOSED')).toBe(true);
  });

  it('returns false for INTRO_SENT', () => {
    expect(canSeeContactInfo('INTRO_SENT')).toBe(false);
  });

  it('returns false for DROPPED', () => {
    expect(canSeeContactInfo('DROPPED')).toBe(false);
  });

  it('returns false for other statuses', () => {
    expect(canSeeContactInfo('CONTRACT_SIGNED')).toBe(false);
    expect(canSeeContactInfo('CAPITAL_COMMITTED')).toBe(false);
  });
});

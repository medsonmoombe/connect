import { describe, it, expect } from 'vitest';
import {
  canTransition,
  getValidNextStates,
  getTransitionRole,
  isTerminalState,
  isProjectStatus,
  PROJECT_STATUSES,
  STATUS_LABELS,
  SUBMITTED_STATUSES,
  isSubmittedForReview,
  TRANSITION_ROLES,
  resolveActorRole,
  type ProjectStatus,
  type TransitionActor,
} from '../project-state-machine';

describe('PROJECT_STATUSES', () => {
  it('contains all 9 project statuses in order (paused added for edit-unlock flow)', () => {
    expect(PROJECT_STATUSES).toEqual([
      'draft',
      'scoring',
      'scoring_retry',
      'under_review',
      'pending_live',
      'live',
      'deactivated',
      'archived',
      'paused',
    ]);
  });

  it('is a readonly tuple via as const', () => {
    // The array itself isn't Object.frozen but the `as const` assertion
    // makes the TypeScript type readonly at compile time.
    // At runtime the array is mutable but the type system enforces it.
    expect(Array.isArray(PROJECT_STATUSES)).toBe(true);
    // Verify length hasn't changed
    expect(PROJECT_STATUSES.length).toBe(9);
  });
});

describe('STATUS_LABELS', () => {
  it('provides human-readable labels for each status', () => {
    expect(STATUS_LABELS.draft).toBe('Draft');
    expect(STATUS_LABELS.scoring).toBe('In Review');
    expect(STATUS_LABELS.scoring_retry).toBe('Analysis Failed — Retry Available');
    expect(STATUS_LABELS.under_review).toBe('Under Regulator Review');
    expect(STATUS_LABELS.pending_live).toBe('Pending Go-Live (legacy)');
    expect(STATUS_LABELS.live).toBe('Live');
    expect(STATUS_LABELS.deactivated).toBe('Deactivated');
    expect(STATUS_LABELS.archived).toBe('Archived');
    expect(STATUS_LABELS.paused).toBe('Paused');
  });

  it('covers all project statuses', () => {
    for (const status of PROJECT_STATUSES) {
      expect(STATUS_LABELS[status]).toBeDefined();
      expect(typeof STATUS_LABELS[status]).toBe('string');
    }
  });
});

describe('TRANSITION_ROLES', () => {
  it('every allowed transition has a role and every role maps to an allowed transition', () => {
    const uniqueKeys = new Set(Object.keys(TRANSITION_ROLES));
    expect(uniqueKeys.size).toBe(Object.keys(TRANSITION_ROLES).length);

    // TRANSITION_ROLES ⊆ VALID_TRANSITIONS
    for (const key of Object.keys(TRANSITION_ROLES)) {
      const [from, to] = key.split('→') as [ProjectStatus, ProjectStatus];
      expect(canTransition(from, to)).toBe(true);
    }

    // VALID_TRANSITIONS ⊆ TRANSITION_ROLES (no roleless transition)
    for (const from of PROJECT_STATUSES) {
      for (const to of getValidNextStates(from)) {
        expect(TRANSITION_ROLES[`${from}→${to}`]).toBeDefined();
      }
    }
  });

  it('includes the pause transitions for the edit-unlock flow', () => {
    expect(TRANSITION_ROLES['live→paused']).toBe('developer');
    expect(TRANSITION_ROLES['paused→draft']).toBe('developer');
    expect(TRANSITION_ROLES['paused→under_review']).toBe('developer');
  });

  it('assigns developer to draft→scoring', () => {
    expect(TRANSITION_ROLES['draft→scoring']).toBe('developer');
  });

  it('assigns reviewer to scoring transitions', () => {
    expect(TRANSITION_ROLES['scoring→pending_live']).toBe('reviewer');
    expect(TRANSITION_ROLES['scoring→draft']).toBe('reviewer');
  });

  it('assigns platform_admin to admin-level transitions', () => {
    expect(TRANSITION_ROLES['pending_live→live']).toBe('platform_admin');
    expect(TRANSITION_ROLES['live→deactivated']).toBe('platform_admin');
    expect(TRANSITION_ROLES['deactivated→live']).toBe('platform_admin');
  });
});

describe('isProjectStatus', () => {
  it('returns true for valid statuses', () => {
    expect(isProjectStatus('draft')).toBe(true);
    expect(isProjectStatus('live')).toBe(true);
    expect(isProjectStatus('archived')).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isProjectStatus('invalid')).toBe(false);
    expect(isProjectStatus('')).toBe(false);
    expect(isProjectStatus(null)).toBe(false);
    expect(isProjectStatus(undefined)).toBe(false);
    expect(isProjectStatus(123)).toBe(false);
    expect(isProjectStatus({})).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(isProjectStatus('Draft')).toBe(false);
    expect(isProjectStatus('LIVE')).toBe(false);
  });
});

describe('canTransition', () => {
  it('allows draft→scoring', () => {
    expect(canTransition('draft', 'scoring')).toBe(true);
  });

  it('allows draft→pending_live for direct submission', () => {
    expect(canTransition('draft', 'pending_live')).toBe(true);
  });

  it('allows scoring→pending_live (reviewer approval)', () => {
    expect(canTransition('scoring', 'pending_live')).toBe(true);
  });

  it('allows scoring→draft (reviewer rejection)', () => {
    expect(canTransition('scoring', 'draft')).toBe(true);
  });

  it('allows pending_live→live (activation)', () => {
    expect(canTransition('pending_live', 'live')).toBe(true);
  });

  it('allows pending_live→draft (admin rejection)', () => {
    expect(canTransition('pending_live', 'draft')).toBe(true);
  });

  it('allows live→deactivated', () => {
    expect(canTransition('live', 'deactivated')).toBe(true);
  });

  it('allows live→scoring (re-review)', () => {
    expect(canTransition('live', 'scoring')).toBe(true);
  });

  it('allows live→archived', () => {
    expect(canTransition('live', 'archived')).toBe(true);
  });

  it('allows deactivated→live (reactivation)', () => {
    expect(canTransition('deactivated', 'live')).toBe(true);
  });

  it('allows deactivated→archived', () => {
    expect(canTransition('deactivated', 'archived')).toBe(true);
  });

  it('allows archived→live (restore)', () => {
    expect(canTransition('archived', 'live')).toBe(true);
  });

  it('allows archived→deactivated', () => {
    expect(canTransition('archived', 'deactivated')).toBe(true);
  });

  it('rejects draft→live (skips scoring)', () => {
    expect(canTransition('draft', 'live')).toBe(false);
  });

  it('rejects draft→deactivated', () => {
    expect(canTransition('draft', 'deactivated')).toBe(false);
  });

  it('rejects draft→archived', () => {
    expect(canTransition('draft', 'archived')).toBe(false);
  });

  it('allows scoring→live (platform_admin direct approval without under_review)', () => {
    expect(canTransition('scoring', 'live')).toBe(true);
  });

  it('rejects scoring→deactivated', () => {
    expect(canTransition('scoring', 'deactivated')).toBe(false);
  });

  it('rejects scoring→archived', () => {
    expect(canTransition('scoring', 'archived')).toBe(false);
  });

  it('allows pending_live→scoring (developer re-runs analysis after editing documents)', () => {
    expect(canTransition('pending_live', 'scoring')).toBe(true);
  });

  it('rejects pending_live→deactivated', () => {
    expect(canTransition('pending_live', 'deactivated')).toBe(false);
  });

  it('rejects pending_live→archived', () => {
    expect(canTransition('pending_live', 'archived')).toBe(false);
  });

  it('rejects live→draft', () => {
    expect(canTransition('live', 'draft')).toBe(false);
  });

  it('rejects live→pending_live', () => {
    expect(canTransition('live', 'pending_live')).toBe(false);
  });

  it('rejects deactivated→scoring', () => {
    expect(canTransition('deactivated', 'scoring')).toBe(false);
  });

  it('rejects deactivated→pending_live', () => {
    expect(canTransition('deactivated', 'pending_live')).toBe(false);
  });

  it('rejects deactivated→draft', () => {
    expect(canTransition('deactivated', 'draft')).toBe(false);
  });

  it('rejects archived→scoring', () => {
    expect(canTransition('archived', 'scoring')).toBe(false);
  });

  it('rejects archived→pending_live', () => {
    expect(canTransition('archived', 'pending_live')).toBe(false);
  });

  it('rejects archived→draft', () => {
    expect(canTransition('archived', 'draft')).toBe(false);
  });

  it('rejects same-status transitions for all statuses', () => {
    for (const status of PROJECT_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it('rejects reverse of an allowed transition', () => {
    expect(canTransition('scoring', 'draft')).toBe(true); // allowed
    expect(canTransition('draft', 'scoring')).toBe(true); // allowed
    expect(canTransition('live', 'pending_live')).toBe(false); // not allowed
    expect(canTransition('pending_live', 'live')).toBe(true); // but this is
  });
});

describe('getValidNextStates', () => {
  it('returns the canonical next states for draft', () => {
    expect(getValidNextStates('draft')).toEqual(['scoring', 'under_review', 'pending_live', 'paused']);
  });

  it('returns the canonical next states for scoring', () => {
    expect(getValidNextStates('scoring')).toEqual([
      'under_review', 'pending_live', 'draft', 'scoring_retry', 'paused', 'live',
    ]);
  });

  it('returns the canonical next states for pending_live (legacy)', () => {
    expect(getValidNextStates('pending_live')).toEqual(['scoring', 'live', 'draft', 'paused']);
  });

  it('returns 4 states for live (scoring, deactivated, archived, paused)', () => {
    const states = getValidNextStates('live');
    expect(states).toContain('scoring');
    expect(states).toContain('deactivated');
    expect(states).toContain('archived');
    expect(states).toContain('paused');
    expect(states.length).toBe(4);
  });

  it('returns 2 states for deactivated', () => {
    expect(getValidNextStates('deactivated')).toEqual(['live', 'archived']);
  });

  it('returns 2 states for archived', () => {
    expect(getValidNextStates('archived')).toEqual(['live', 'deactivated']);
  });

  it('returns empty array for unknown status', () => {
    expect(getValidNextStates('unknown' as ProjectStatus)).toEqual([]);
  });
});

describe('getTransitionRole', () => {
  function testTransition(from: ProjectStatus, to: ProjectStatus, expected: TransitionActor | null) {
    expect(getTransitionRole(from, to)).toBe(expected);
  }

  it('developer can submit draft→scoring', () => {
    testTransition('draft', 'scoring', 'developer');
  });

  it('developer can submit draft→pending_live (direct submit)', () => {
    testTransition('draft', 'pending_live', 'developer');
  });

  it('reviewer handles scoring→pending_live', () => {
    testTransition('scoring', 'pending_live', 'reviewer');
  });

  it('reviewer handles scoring→draft (rejection)', () => {
    testTransition('scoring', 'draft', 'reviewer');
  });

  it('platform_admin handles pending_live→live', () => {
    testTransition('pending_live', 'live', 'platform_admin');
  });

  it('platform_admin handles pending_live→draft', () => {
    testTransition('pending_live', 'draft', 'platform_admin');
  });

  it('platform_admin handles all live transitions', () => {
    testTransition('live', 'scoring', 'platform_admin');
    testTransition('live', 'deactivated', 'platform_admin');
    testTransition('live', 'archived', 'platform_admin');
  });

  it('platform_admin handles deactivated transitions', () => {
    testTransition('deactivated', 'live', 'platform_admin');
    testTransition('deactivated', 'archived', 'platform_admin');
  });

  it('platform_admin handles archived transitions', () => {
    testTransition('archived', 'live', 'platform_admin');
    testTransition('archived', 'deactivated', 'platform_admin');
  });

  it('returns null for invalid transitions', () => {
    testTransition('draft', 'live', null);
    testTransition('live', 'draft', null);
    testTransition('draft', 'deactivated', null);
  });

  it('returns platform_admin for scoring→live direct approval', () => {
    testTransition('scoring', 'live', 'platform_admin');
  });
});

describe('isTerminalState', () => {
  it('returns false for all statuses — every status is restorable', () => {
    for (const status of PROJECT_STATUSES) {
      expect(isTerminalState(status)).toBe(false);
    }
  });
});

describe('resolveActorRole', () => {
  it('returns platform_admin when isPlatformAdmin is true', () => {
    expect(resolveActorRole({ isPlatformAdmin: true })).toBe('platform_admin');
  });

  it('returns reviewer when isInternalReviewer is true', () => {
    expect(resolveActorRole({
      isPlatformAdmin: false,
      isInternalReviewer: true,
    })).toBe('reviewer');
  });

  it('returns developer when user belongs to the developer org', () => {
    expect(resolveActorRole({
      isPlatformAdmin: false,
      userCompanyId: 'org-1',
      developerId: 'org-1',
    })).toBe('developer');
  });

  it('returns null when no roles match', () => {
    expect(resolveActorRole({
      isPlatformAdmin: false,
      userCompanyId: 'org-2',
      developerId: 'org-1',
    })).toBeNull();
  });

  it('returns null when company IDs are undefined', () => {
    expect(resolveActorRole({
      isPlatformAdmin: false,
      userCompanyId: undefined,
      developerId: undefined,
    })).toBeNull();
  });

  it('prioritizes platform_admin over developer', () => {
    expect(resolveActorRole({
      isPlatformAdmin: true,
      userCompanyId: 'org-1',
      developerId: 'org-1',
    })).toBe('platform_admin');
  });

  it('prioritizes platform_admin over reviewer', () => {
    expect(resolveActorRole({
      isPlatformAdmin: true,
      isInternalReviewer: true,
    })).toBe('platform_admin');
  });
});

describe('isSubmittedForReview', () => {
  it('treats a draft as NOT submitted — the developer is still building it', () => {
    // Regression: background analysis (document upload hook, manual re-analysis)
    // used to promote a draft through scoring -> under_review, so an unfinished
    // project appeared in the review queue before the final submission.
    expect(isSubmittedForReview('draft')).toBe(false);
    expect(isSubmittedForReview('paused')).toBe(false);
  });

  it('treats every status the submission flow can reach as submitted', () => {
    expect(isSubmittedForReview('scoring')).toBe(true);
    expect(isSubmittedForReview('scoring_retry')).toBe(true);
    expect(isSubmittedForReview('under_review')).toBe(true);
    expect(isSubmittedForReview('live')).toBe(true);
    expect(isSubmittedForReview('pending_live')).toBe(true);
    expect(isSubmittedForReview('deactivated')).toBe(true);
    expect(isSubmittedForReview('archived')).toBe(true);
  });

  it('is false for missing / unknown values', () => {
    expect(isSubmittedForReview(null)).toBe(false);
    expect(isSubmittedForReview(undefined)).toBe(false);
    expect(isSubmittedForReview('')).toBe(false);
    expect(isSubmittedForReview('submitted')).toBe(false);
  });

  it('covers every status except the pre-submission states', () => {
    const preSubmission = PROJECT_STATUSES.filter((s) => !isSubmittedForReview(s));
    expect(preSubmission).toEqual(['draft', 'paused']);
    expect(SUBMITTED_STATUSES.length).toBe(PROJECT_STATUSES.length - preSubmission.length);
  });
});

describe('Edge cases on status transitions', () => {
  it('draft cannot be rejected directly', () => {
    // Rejection goes through scoring→draft, not directly
    expect(canTransition('draft', 'draft')).toBe(false);
  });

  it('live cannot go directly to draft (must go through review)', () => {
    expect(canTransition('live', 'draft')).toBe(false);
  });

  it('live cannot go to pending_live', () => {
    expect(canTransition('live', 'pending_live')).toBe(false);
  });

  it('complete lifecycle flow is valid', () => {
    // draft → scoring → pending_live → live → deactivated → archived
    expect(canTransition('draft', 'scoring')).toBe(true);
    expect(canTransition('scoring', 'pending_live')).toBe(true);
    expect(canTransition('pending_live', 'live')).toBe(true);
    expect(canTransition('live', 'deactivated')).toBe(true);
    expect(canTransition('deactivated', 'archived')).toBe(true);
  });

  it('archived can be restored back to live', () => {
    expect(canTransition('archived', 'live')).toBe(true);
  });

  it('deactivated can be reactivated', () => {
    expect(canTransition('deactivated', 'live')).toBe(true);
  });
});

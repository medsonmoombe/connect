export type ManagementUser = {
  is_platform_admin?: boolean;
  is_authority_user?: boolean;
  is_authority_admin?: boolean;
  is_authority_reviewer?: boolean;
};

export function isManagementUser(user: ManagementUser | null | undefined): boolean {
  return !!(user?.is_platform_admin || user?.is_authority_user);
}

export function canReviewProjects(user: ManagementUser | null | undefined): boolean {
  return !!(user?.is_platform_admin || user?.is_authority_admin || user?.is_authority_reviewer);
}

export function requireManagementUser(user: ManagementUser | null | undefined): boolean {
  return isManagementUser(user);
}

export function requirePlatformAdmin(user: ManagementUser | null | undefined): boolean {
  return !!user?.is_platform_admin;
}

/**
 * Anyone who may look at a project's AI score regardless of its lifecycle
 * status — the humans who need it in order to review or approve the project.
 *
 * `canReviewProjects` is the narrower gate used to authorise a review DECISION.
 * This is the broader "may I see the score" question, which the two API routes
 * previously answered with two different ad-hoc flag lists. Widest wins: hiding a
 * score from someone who is entitled to review is a worse failure than showing it
 * to a reviewer.
 */
export function isReviewerUser(user: ManagementUser | null | undefined): boolean {
  return !!(
    user?.is_platform_admin
    || user?.is_authority_user
    || user?.is_authority_admin
    || user?.is_authority_reviewer
  );
}
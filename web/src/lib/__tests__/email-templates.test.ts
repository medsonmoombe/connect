import { describe, it, expect } from 'vitest';
import {
  inviteEmail,
  verificationEmail,
  welcomeEmail,
  passwordResetEmail,
  orgStatusEmail,
  adminNewOrgEmail,
  mfaCodeEmail,
  accountLockedEmail,
  matchFoundEmail,
  engagementUpdateEmail,
  projectStatusEmail,
  projectSubmittedEmail,
  projectPendingInternalReviewEmail,
  projectApprovedInternalEmail,
  projectReturnedEmail,
  projectRejectedEmail,
  adminProjectSubmittedEmail,
  projectLiveEmail,
  projectLiveInvestorEmail,
  expressInterestEmail,
  messageReceivedEmail,
} from '../email-templates';

describe('inviteEmail', () => {
  it('generates subject and HTML', () => {
    const result = inviteEmail({ token: 'abc123', expiresAt: '2025-12-31', companyName: 'Acme Corp' });
    expect(result.subject).toContain('invited');
    expect(result.html).toContain('Acme Corp');
    expect(result.html).toContain('abc123');
    expect(result.html).toContain('</html>');
  });

  it('works without company name', () => {
    const result = inviteEmail({ token: 'xyz789', expiresAt: '2025-06-01' });
    expect(result.subject).toContain('invited');
    expect(result.html).toContain('account');
    expect(result.html).not.toContain('undefined');
  });
});

describe('verificationEmail', () => {
  it('includes user name and verification URL', () => {
    const result = verificationEmail({ fullName: 'John', verifyUrl: 'https://example.com/verify', companyName: 'Org' });
    expect(result.html).toContain('John');
    expect(result.html).toContain('https://example.com/verify');
    expect(result.subject).toContain('Verify');
  });
});

describe('welcomeEmail', () => {
  it('includes company name when provided', () => {
    const result = welcomeEmail({ fullName: 'Jane', companyName: 'Startup Inc' });
    expect(result.html).toContain('Jane');
    expect(result.html).toContain('Startup Inc');
    expect(result.subject).toContain('Welcome');
  });

  it('works without company name', () => {
    const result = welcomeEmail({ fullName: 'Jane' });
    expect(result.html).toContain('Jane');
    expect(result.html).not.toContain('undefined');
  });
});

describe('passwordResetEmail', () => {
  it('includes reset URL and user name', () => {
    const result = passwordResetEmail({ fullName: 'Alice', resetUrl: 'https://example.com/reset' });
    expect(result.html).toContain('Alice');
    expect(result.html).toContain('https://example.com/reset');
    expect(result.subject).toContain('Reset');
  });
});

describe('orgStatusEmail', () => {
  it('verified status shows success message', () => {
    const result = orgStatusEmail({ orgName: 'MyOrg', status: 'verified' });
    expect(result.html).toContain('verified');
    expect(result.html).toContain('MyOrg');
    expect(result.subject).toContain('verified');
  });

  it('rejected status shows rejection message', () => {
    const result = orgStatusEmail({ orgName: 'MyOrg', status: 'rejected', note: 'Incomplete docs' });
    expect(result.html).toContain('not approved');
    expect(result.html).toContain('Incomplete docs');
  });

  it('needs_update status shows action required', () => {
    const result = orgStatusEmail({ orgName: 'MyOrg', status: 'needs_update', note: 'Update profile' });
    expect(result.html).toContain('additional information');
    expect(result.html).toContain('Update profile');
  });
});

describe('adminNewOrgEmail', () => {
  it('includes org details for admin notification', () => {
    const result = adminNewOrgEmail({ orgName: 'NewCo', orgType: 'DEVELOPER', requesterName: 'Bob' });
    expect(result.html).toContain('NewCo');
    expect(result.html).toContain('DEVELOPER');
    expect(result.html).toContain('Bob');
    expect(result.subject).toContain('NewCo');
  });
});

describe('mfaCodeEmail', () => {
  it('includes the MFA code prominently', () => {
    const result = mfaCodeEmail({ fullName: 'Charlie', code: '482901' });
    expect(result.html).toContain('Charlie');
    expect(result.html).toContain('482901');
    expect(result.subject).toContain('verification code');
  });
});

describe('accountLockedEmail', () => {
  it('includes lock expiry time', () => {
    const result = accountLockedEmail({ fullName: 'Diana', lockedUntil: '2025-06-01T12:00:00Z' });
    expect(result.html).toContain('Diana');
    expect(result.html).toContain('temporarily locked');
    expect(result.subject).toContain('locked');
  });
});

describe('matchFoundEmail', () => {
  it('shows developer/partner role-specific content', () => {
    const dev = matchFoundEmail({ projectName: 'Solar', partnerName: 'InvestCorp', score: 85, role: 'developer' });
    expect(dev.html).toContain('Solar');
    expect(dev.html).toContain('InvestCorp');
    expect(dev.html).toContain('85%');
    expect(dev.html).toContain('matching partner');

    const partner = matchFoundEmail({ projectName: 'Wind', partnerName: 'DevCo', score: 72, role: 'partner' });
    expect(partner.html).toContain('matching project');
  });
});

describe('engagementUpdateEmail', () => {
  it('includes project name and new status', () => {
    const result = engagementUpdateEmail({ projectName: 'Hydro', newStatus: 'NDA_SIGNED', recipientName: 'Eve' });
    expect(result.html).toContain('Hydro');
    expect(result.html).toContain('Nda Signed');
    expect(result.html).toContain('Eve');
  });
});

describe('projectStatusEmail', () => {
  it('includes status and optional note', () => {
    const result = projectStatusEmail({ projectName: 'Biomass', newStatus: 'live', recipientName: 'Frank', note: 'Approved' });
    expect(result.html).toContain('Biomass');
    expect(result.html).toContain('Live');
    expect(result.html).toContain('Approved');
  });

  it('works without note', () => {
    const result = projectStatusEmail({ projectName: 'Biomass', newStatus: 'live', recipientName: 'Frank' });
    expect(result.html).not.toContain('undefined');
  });
});

describe('projectSubmittedEmail', () => {
  it('shows direct vs internal review mode', () => {
    const direct = projectSubmittedEmail({ projectName: 'Solar', recipientName: 'Grace', mode: 'direct' });
    expect(direct.html).toContain('submitted');
    expect(direct.html).toContain('platform team');

    const internal = projectSubmittedEmail({ projectName: 'Solar', recipientName: 'Grace', mode: 'internal_review' });
    expect(internal.html).toContain('internal reviewer');
  });
});

describe('projectPendingInternalReviewEmail', () => {
  it('includes reviewer, submitter, and org info', () => {
    const result = projectPendingInternalReviewEmail({
      projectName: 'Wind',
      submitterName: 'Hank',
      orgName: 'OrgCo',
      recipientName: 'Reviewer',
      projectUrl: '/projects/123',
    });
    expect(result.html).toContain('Wind');
    expect(result.html).toContain('Hank');
    expect(result.html).toContain('OrgCo');
    expect(result.html).toContain('/projects/123');
  });
});

describe('projectApprovedInternalEmail', () => {
  it('includes project and URL info', () => {
    const result = projectApprovedInternalEmail({ projectName: 'Solar', recipientName: 'Ivy', projectUrl: '/projects/1' });
    expect(result.html).toContain('approved');
    expect(result.html).toContain('Solar');
    expect(result.html).toContain('/projects/1');
  });
});

describe('projectReturnedEmail', () => {
  it('includes feedback in a styled box', () => {
    const result = projectReturnedEmail({ projectName: 'Wind', recipientName: 'Jack', feedback: 'Missing EIA document', projectUrl: '/projects/2' });
    expect(result.html).toContain('Missing EIA document');
    expect(result.html).toContain('Wind');
    expect(result.html).toContain('returned');
  });
});

describe('projectRejectedEmail', () => {
  it('includes reason and project URL', () => {
    const result = projectRejectedEmail({ projectName: 'Hydro', recipientName: 'Kate', reason: 'Insufficient data', projectUrl: '/projects/3' });
    expect(result.html).toContain('Insufficient data');
    expect(result.html).toContain('Hydro');
    expect(result.html).toContain('not approved');
  });
});

describe('adminProjectSubmittedEmail', () => {
  it('includes org and project name for admin notification', () => {
    const result = adminProjectSubmittedEmail({ projectName: 'Geothermal', orgName: 'GeoCo', projectUrl: '/projects/4' });
    expect(result.html).toContain('Geothermal');
    expect(result.html).toContain('GeoCo');
    expect(result.html).toContain('/projects/4');
  });
});

describe('projectLiveEmail', () => {
  it('notifies owner project is now live', () => {
    const result = projectLiveEmail({ projectName: 'Solar Farm' });
    expect(result.html).toContain('now live');
    expect(result.html).toContain('Solar Farm');
  });
});

describe('projectLiveInvestorEmail', () => {
  it('includes full project details for investors', () => {
    const result = projectLiveInvestorEmail({
      projectName: 'Wind Farm',
      technologyType: 'ONSHORE_WIND',
      country: 'Kenya',
      sizeMw: 100,
      capitalRequired: 50_000_000,
      projectStage: 'CONSTRUCTION',
    });
    expect(result.html).toContain('Wind Farm');
    expect(result.html).toContain('Kenya');
    expect(result.html).toContain('100 MW');
    expect(result.html).toContain('$50.0M');
    expect(result.subject).toContain('Wind Farm');
  });
});

describe('expressInterestEmail', () => {
  it('includes project, partner, and engagement URL', () => {
    const result = expressInterestEmail({ projectName: 'Solar', partnerName: 'CapCo', recipientName: 'Dev', engagementUrl: '/engage/1' });
    expect(result.html).toContain('Solar');
    expect(result.html).toContain('CapCo');
    expect(result.html).toContain('introduction request');
  });
});

describe('messageReceivedEmail', () => {
  it('includes sender, recipient, project, and conversation link', () => {
    const result = messageReceivedEmail({ senderName: 'Leo', recipientName: 'Mia', projectName: 'Grid', engagementId: 'eng-1' });
    expect(result.html).toContain('Leo');
    expect(result.html).toContain('Mia');
    expect(result.html).toContain('Grid');
    expect(result.html).toContain('/eng-1');
  });
});

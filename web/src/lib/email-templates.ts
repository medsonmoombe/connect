const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const BRAND_NAME = 'Afri Connect';
const SUPPORT_EMAIL = 'support@africonnect.io';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shell(title: string, preheader: string, bodyHtml: string): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1a1a1a; }
    a { color: #1a1a1a; }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#f5f5f5;line-height:1px;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e0e0e0;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #e0e0e0;">
              <p style="font-size:15px;font-weight:700;color:#1a1a1a;letter-spacing:0.02em;">${BRAND_NAME}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e0e0e0;">
              <p style="font-size:12px;color:#888;line-height:1.6;">
                &copy; ${year} ${BRAND_NAME} &nbsp;&middot;&nbsp;
                <a href="mailto:${SUPPORT_EMAIL}" style="color:#888;text-decoration:underline;">${SUPPORT_EMAIL}</a> &nbsp;&middot;&nbsp;
                <a href="${APP_URL}/privacy" style="color:#888;text-decoration:underline;">Privacy</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function p(text: string): string {
  return `<p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 16px;">${text}</p>`;
}

function h(text: string): string {
  return `<h2 style="font-size:18px;font-weight:600;color:#1a1a1a;margin:0 0 20px;line-height:1.3;">${text}</h2>`;
}

function cta(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
    <tr>
      <td style="background:#1a1a1a;border-radius:4px;">
        <a href="${href}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

function note(text: string): string {
  return `<p style="font-size:12px;color:#888;line-height:1.6;margin:16px 0 0;border-left:3px solid #e0e0e0;padding-left:12px;">${text}</p>`;
}

function dl(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid #e0e0e0;">
    ${rows.map(([k, v]) => `<tr>
      <td style="padding:10px 14px;font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.05em;width:130px;border-bottom:1px solid #f0f0f0;vertical-align:top;">${escapeHtml(k)}</td>
      <td style="padding:10px 14px;font-size:14px;color:#1a1a1a;border-bottom:1px solid #f0f0f0;">${escapeHtml(v)}</td>
    </tr>`).join('')}
  </table>`;
}

// ── Templates ─────────────────────────────────────────────────────────────────

export function inviteEmail(params: { token: string; expiresAt: string; companyName?: string }) {
  const link = `${APP_URL}/signup?token=${params.token}`;
  const expiry = new Date(params.expiresAt).toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const context = params.companyName
    ? `You have been invited to join <strong>${escapeHtml(params.companyName)}</strong> on <strong>${BRAND_NAME}</strong>. Click the button below to accept the invitation and set up your account.`
    : `You have been invited to create an account on <strong>${BRAND_NAME}</strong>. Click the button below to accept the invitation and set up your account.`;
  const body = `
    ${h("You've been invited to join the platform")}
    ${p(context)}
    ${cta('Accept Invitation', link)}
    ${note(`This invitation expires on ${expiry}. If you were not expecting this, you can safely ignore it.`)}
  `;
  return { subject: `You're invited to ${BRAND_NAME}`, html: shell("You're Invited", `Accept your invitation to join ${BRAND_NAME}.`, body) };
}

export function verificationEmail(params: { fullName: string; verifyUrl: string; companyName?: string }) {
  const context = params.companyName
    ? `Thank you for registering on <strong>${BRAND_NAME}</strong>. You are joining <strong>${escapeHtml(params.companyName)}</strong>. Please verify your email address to activate your account.`
    : `Thank you for registering on <strong>${BRAND_NAME}</strong>. Please verify your email address to activate your account.`;
  const body = `
    ${h('Verify your email address')}
    ${p(`Hi ${escapeHtml(params.fullName)},`)}
    ${p(context)}
    ${cta('Verify Email', params.verifyUrl)}
    ${note('This link expires in 24 hours. If you did not create an account, you can ignore this email.')}
  `;
  return { subject: `Verify your ${BRAND_NAME} account`, html: shell('Verify Your Email', 'Verify your email to activate your account.', body) };
}

export function welcomeEmail(params: { fullName: string; companyName?: string }) {
  const context = params.companyName
    ? `Your <strong>${BRAND_NAME}</strong> account is now active and you have been added to <strong>${escapeHtml(params.companyName)}</strong>. Log in to your dashboard to get started.`
    : `Your <strong>${BRAND_NAME}</strong> account is now active. You can log in to your dashboard to complete your organisation profile and get started.`;
  const body = `
    ${h(`Welcome, ${escapeHtml(params.fullName)}`)}
    ${p(context)}
    ${cta('Go to Dashboard', `${APP_URL}/dashboard`)}
  `;
  return { subject: `Welcome to ${BRAND_NAME}`, html: shell('Welcome', `Your ${BRAND_NAME} account is ready.`, body) };
}

export function passwordResetEmail(params: { fullName: string; resetUrl: string }) {
  const body = `
    ${h('Reset your password')}
    ${p(`Hi ${escapeHtml(params.fullName)},`)}
    ${p(`We received a request to reset the password on your <strong>${BRAND_NAME}</strong> account. Click below to set a new password.`)}
    ${cta('Reset Password', params.resetUrl)}
    ${note('This link expires in 1 hour. If you did not request a password reset, you can ignore this email — your password will not change.')}
  `;
  return { subject: `Reset your ${BRAND_NAME} password`, html: shell('Password Reset', 'Reset your password to regain access.', body) };
}

export function orgStatusEmail(params: {
  orgName: string;
  status: 'verified' | 'rejected' | 'needs_update';
  note?: string;
}) {
  const safeOrg = escapeHtml(params.orgName);

  const configs = {
    verified: {
      subject: `${safeOrg} — Organisation verified`,
      heading: 'Your organisation has been verified',
      body: `${p(`<strong>${safeOrg}</strong> has been reviewed and approved. You now have full access to all platform features.`)}${p('Log in to your dashboard to begin connecting with partners.')}`,
      button: { label: 'Go to Dashboard', href: `${APP_URL}/dashboard` },
    },
    rejected: {
      subject: `${safeOrg} — Application not approved`,
      heading: 'Your application was not approved',
      body: `${p(`We have reviewed the application for <strong>${safeOrg}</strong> and are unable to approve it at this time.`)}${p('If you have questions or would like to reapply, please contact our support team.')}`,
      button: null,
    },
    needs_update: {
      subject: `${safeOrg} — Action required`,
      heading: 'Additional information required',
      body: `${p(`Our review team requires additional information before we can verify <strong>${safeOrg}</strong>.`)}${p('Please log in to your dashboard and update your organisation profile. Our team will re-review once changes are submitted.')}`,
      button: { label: 'Update Profile', href: `${APP_URL}/dashboard` },
    },
  };

  const cfg = configs[params.status];
  const bodyHtml = `
    ${h(cfg.heading)}
    ${cfg.body}
    ${params.note ? note(`Reviewer note: ${escapeHtml(params.note)}`) : ''}
    ${cfg.button ? cta(cfg.button.label, cfg.button.href) : ''}
  `;
  return { subject: cfg.subject, html: shell(cfg.heading, cfg.subject, bodyHtml) };
}

export function adminNewOrgEmail(params: {
  orgName: string;
  orgType: string;
  requesterName: string;
}) {
  const body = `
    ${h('New organisation pending review')}
    ${p('A new organisation has registered and is awaiting verification.')}
    ${dl([
      ['Organisation', params.orgName],
      ['Type', params.orgType],
      ['Submitted by', params.requesterName],
      ['Date', new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })],
    ])}
    ${cta('Review Organisation', `${APP_URL}/dashboard/admin/verification`)}
  `;
  return { subject: `Pending review: ${params.orgName}`, html: shell('New Registration', `${params.orgName} is awaiting review.`, body) };
}

export function adminUserProvisionedEmail(params: { email: string; generatedPassword?: string }) {
  const rows: [string, string][] = [['Email', params.email]];
  if (params.generatedPassword) rows.push(['Password', params.generatedPassword]);
  const body = `
    ${h('Your account has been created')}
    ${p(`An administrator has created a <strong>${BRAND_NAME}</strong> account for you. Use the credentials below to log in.`)}
    ${dl(rows)}
    ${params.generatedPassword ? note('Please change your password after your first login.') : ''}
    ${cta('Log In', `${APP_URL}/login`)}
  `;
  return { subject: `Your ${BRAND_NAME} account is ready`, html: shell('Account Created', `Your ${BRAND_NAME} account has been created.`, body) };
}

export function mfaCodeEmail(params: { fullName: string; code: string }) {
  const body = `
    ${h('Your verification code')}
    ${p(`Hi ${escapeHtml(params.fullName)},`)}
    ${p(`Use the following 6-digit code to verify your identity on <strong>${BRAND_NAME}</strong>:`)}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="background:#f5f5f5;border:1px solid #e0e0e0;border-radius:4px;padding:16px 32px;text-align:center;">
          <span style="font-size:28px;font-weight:700;color:#1a1a1a;letter-spacing:0.15em;font-family:monospace;">${escapeHtml(params.code)}</span>
        </td>
      </tr>
    </table>
    ${note('This code expires in 10 minutes. If you did not request this code, you can safely ignore this email.')}
  `;
  return { subject: `Your ${BRAND_NAME} verification code`, html: shell('Verification Code', 'Your identity verification code.', body) };
}

export function accountLockedEmail(params: { fullName: string; lockedUntil: string }) {
  const unlockTime = new Date(params.lockedUntil).toLocaleString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const body = `
    ${h('Account temporarily locked')}
    ${p(`Hi ${escapeHtml(params.fullName)},`)}
    ${p(`Your <strong>${BRAND_NAME}</strong> account has been temporarily locked due to multiple failed login attempts.`)}
    ${dl([['Locked until', unlockTime]])}
    ${p('If you did not make these attempts, please contact our support team immediately. If you are locked out and need urgent access, reach out to your platform administrator.')}
  `;
  return { subject: `Your ${BRAND_NAME} account is locked`, html: shell('Account Locked', 'Your account has been temporarily locked.', body) };
}

export function matchFoundEmail(params: {
  projectName: string;
  partnerName: string;
  score: number;
  role: 'developer' | 'partner';
}) {
  const isDeveloper = params.role === 'developer';
  const heading = isDeveloper ? 'A matching partner was found' : 'A matching project was found';
  const bodyText = isDeveloper
    ? `<strong>${escapeHtml(params.partnerName)}</strong> is a <strong>${params.score}%</strong> match for your project "<strong>${escapeHtml(params.projectName)}</strong>".`
    : `Your profile matches "<strong>${escapeHtml(params.projectName)}</strong>" by <strong>${escapeHtml(params.partnerName)}</strong> with <strong>${params.score}%</strong> compatibility.`;
  const body = `
    ${h(heading)}
    ${p(bodyText)}
    ${cta('View Matches', `${APP_URL}/dashboard`)}
  `;
  return { subject: `New match: ${params.projectName}`, html: shell(heading, `${params.partnerName} matches ${params.projectName} at ${params.score}%`, body) };
}

export function engagementUpdateEmail(params: {
  projectName: string;
  newStatus: string;
  recipientName: string;
}) {
  const friendlyStatus = params.newStatus.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
  const body = `
    ${h('Engagement status updated')}
    ${p(`Hi ${escapeHtml(params.recipientName)},`)}
    ${p(`The engagement for "<strong>${escapeHtml(params.projectName)}</strong>" has been moved to <strong>${escapeHtml(friendlyStatus)}</strong>.`)}
    ${cta('View Engagement', `${APP_URL}/dashboard`)}
  `;
  return { subject: `Engagement updated: ${params.projectName}`, html: shell('Engagement Updated', `Engagement moved to ${friendlyStatus}.`, body) };
}

export function projectStatusEmail(params: {
  projectName: string;
  newStatus: string;
  note?: string;
  recipientName: string;
}) {
  const friendlyStatus = params.newStatus.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
  const body = `
    ${h('Project status updated')}
    ${p(`Hi ${escapeHtml(params.recipientName)},`)}
    ${p(`Your project "<strong>${escapeHtml(params.projectName)}</strong>" has been moved to <strong>${escapeHtml(friendlyStatus)}</strong> by a platform administrator.`)}
    ${params.note ? note(`Admin note: ${escapeHtml(params.note)}`) : ''}
    ${cta('View Project', `${APP_URL}/dashboard`)}
  `;
  return { subject: `Project status: ${friendlyStatus} — ${params.projectName}`, html: shell('Project Updated', `${params.projectName} moved to ${friendlyStatus}.`, body) };
}

export function projectSubmittedEmail(params: {
  projectName: string;
  recipientName: string;
  mode: 'direct' | 'internal_review';
}) {
  const heading = 'Project submitted for review';
  const bodyText = params.mode === 'internal_review'
    ? `Your project "<strong>${escapeHtml(params.projectName)}</strong>" has been sent to your designated internal reviewer for approval before platform submission.`
    : `Your project "<strong>${escapeHtml(params.projectName)}</strong>" has been submitted to the platform team for review. You will be notified once a decision has been made.`;
  const body = `
    ${h(heading)}
    ${p(`Hi ${escapeHtml(params.recipientName)},`)}
    ${p(bodyText)}
    ${cta('View Project', `${APP_URL}/dashboard/developer`)}
  `;
  return { subject: `Project submitted: ${params.projectName}`, html: shell(heading, `${params.projectName} has been submitted.`, body) };
}

export function projectPendingInternalReviewEmail(params: {
  projectName: string;
  submitterName: string;
  orgName: string;
  recipientName: string;
  projectUrl: string;
}) {
  const heading = 'Project pending your review';
  const body = `
    ${h(heading)}
    ${p(`Hi ${escapeHtml(params.recipientName)},`)}
    ${p(`<strong>${escapeHtml(params.submitterName)}</strong> has submitted "<strong>${escapeHtml(params.projectName)}</strong>" from <strong>${escapeHtml(params.orgName)}</strong> for your internal review before it is sent to the platform.`)}
    ${p('Please review the project and either approve it for platform submission or return it with feedback.')}
    ${cta('Review Project', `${APP_URL}${params.projectUrl}`)}
  `;
  return { subject: `Review required: ${params.projectName}`, html: shell(heading, `${params.projectName} is awaiting your review.`, body) };
}

export function projectApprovedInternalEmail(params: {
  projectName: string;
  recipientName: string;
  projectUrl: string;
}) {
  const heading = 'Project approved by internal reviewer';
  const body = `
    ${h(heading)}
    ${p(`Hi ${escapeHtml(params.recipientName)},`)}
    ${p(`Your project "<strong>${escapeHtml(params.projectName)}</strong>" has been approved by your internal reviewer and submitted to the platform team for final review.`)}
    ${p('You will be notified once the platform team has made a decision.')}
    ${cta('View Project', `${APP_URL}${params.projectUrl}`)}
  `;
  return { subject: `Project approved internally: ${params.projectName}`, html: shell(heading, `${params.projectName} approved and submitted to platform.`, body) };
}

export function projectReturnedEmail(params: {
  projectName: string;
  recipientName: string;
  feedback: string;
  projectUrl: string;
}) {
  const heading = 'Project returned for rework';
  const body = `
    ${h(heading)}
    ${p(`Hi ${escapeHtml(params.recipientName)},`)}
    ${p(`Your project "<strong>${escapeHtml(params.projectName)}</strong>" has been returned by your internal reviewer with the following feedback:`)}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      <tr>
        <td style="background:#fff8f0;border:1px solid #fde8cc;border-radius:4px;padding:14px 18px;font-size:14px;color:#444;line-height:1.6;">
          ${escapeHtml(params.feedback)}
        </td>
      </tr>
    </table>
    ${p('Please address the feedback and resubmit your project.')}
    ${cta('Edit & Resubmit', `${APP_URL}${params.projectUrl}`)}
  `;
  return { subject: `Action required: ${params.projectName} returned for rework`, html: shell(heading, `${params.projectName} needs changes before resubmission.`, body) };
}

export function projectUnderReviewEmail(params: {
  projectName: string;
  recipientName: string;
  projectUrl: string;
}) {
  const heading = 'Your project is under review';
  const body = `
    ${h(heading)}
    ${p(`Hi ${escapeHtml(params.recipientName)},`)}
    ${p(`The platform team has started reviewing your project "<strong>${escapeHtml(params.projectName)}</strong>". We will notify you once a decision has been made.`)}
    ${cta('View Project', `${APP_URL}${params.projectUrl}`)}
  `;
  return { subject: `Under review: ${params.projectName}`, html: shell(heading, `${params.projectName} is now under platform review.`, body) };
}

export function projectValidatedEmail(params: {
  projectName: string;
  recipientName: string;
  projectUrl: string;
}) {
  const heading = 'Project validated — now live on the platform';
  const body = `
    ${h(heading)}
    ${p(`Hi ${escapeHtml(params.recipientName)},`)}
    ${p(`Congratulations! Your project "<strong>${escapeHtml(params.projectName)}</strong>" has been reviewed and validated by the platform team. It is now visible to potential capital and technical partners.`)}
    ${cta('View Project', `${APP_URL}${params.projectUrl}`)}
  `;
  return { subject: `Validated: ${params.projectName} is now live`, html: shell(heading, `${params.projectName} is now live on the platform.`, body) };
}

export function projectRejectedEmail(params: {
  projectName: string;
  recipientName: string;
  reason: string;
  projectUrl: string;
}) {
  const heading = 'Project not approved';
  const body = `
    ${h(heading)}
    ${p(`Hi ${escapeHtml(params.recipientName)},`)}
    ${p(`Your project "<strong>${escapeHtml(params.projectName)}</strong>" was reviewed by the platform team and was not approved at this time.`)}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      <tr>
        <td style="background:#fff5f5;border:1px solid #fdd;border-radius:4px;padding:14px 18px;font-size:14px;color:#444;line-height:1.6;">
          <strong>Reason:</strong> ${escapeHtml(params.reason)}
        </td>
      </tr>
    </table>
    ${p('You may edit your project to address the feedback and resubmit.')}
    ${cta('Edit Project', `${APP_URL}${params.projectUrl}`)}
  `;
  return { subject: `Not approved: ${params.projectName}`, html: shell(heading, `${params.projectName} was not approved.`, body) };
}

export function adminProjectSubmittedEmail(params: {
  projectName: string;
  orgName: string;
  projectUrl: string;
}) {
  const heading = 'New project submitted for review';
  const body = `
    ${h(heading)}
    ${p('A new project has been submitted and is awaiting your review.')}
    ${dl([
      ['Project', params.projectName],
      ['Organisation', params.orgName],
      ['Submitted', new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })],
    ])}
    ${cta('Review Project', `${APP_URL}${params.projectUrl}`)}
  `;
  return { subject: `Review required: ${params.projectName}`, html: shell(heading, `${params.projectName} is awaiting platform review.`, body) };
}

export function messageReceivedEmail(params: {
  senderName: string;
  recipientName: string;
  preview: string;
  projectName: string;
}) {
  const truncated = params.preview.length > 120 ? params.preview.slice(0, 120) + '...' : params.preview;
  const body = `
    ${h(`New message from ${escapeHtml(params.senderName)}`)}
    ${p(`Hi ${escapeHtml(params.recipientName)},`)}
    ${p(`You have a new message regarding "<strong>${escapeHtml(params.projectName)}</strong>":`)}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      <tr>
        <td style="background:#f5f5f5;border:1px solid #e0e0e0;border-radius:4px;padding:14px 18px;font-size:14px;color:#444;line-height:1.6;">
          ${escapeHtml(truncated)}
        </td>
      </tr>
    </table>
    ${cta('Open Conversation', `${APP_URL}/dashboard`)}
  `;
  return { subject: `New message from ${params.senderName}`, html: shell('New Message', `${params.senderName} sent you a message.`, body) };
}

// ── Notification types ────────────────────────────────────────────────────────

export type NotificationType =
  | 'org_status_change'
  | 'new_org_registered'
  | 'user_provisioned'
  | 'engagement_updates'
  | 'match_found'
  | 'project_update'
  | 'project_status'
  | 'project_rejected'
  | 'project_internal_rejected'
  | 'project_pending_internal_review'
  | 'project_approved_internal'
  | 'new_messages'
  | 'system_announcement';

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  entity_type?: string;
  entity_id?: string;
  action_url?: string;
}

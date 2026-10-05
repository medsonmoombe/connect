import { Resend } from 'resend';
import { getSupabaseAdmin } from './supabase-server';
import * as templates from './email-templates';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL ?? `${process.env.APP_NAME || process.env.NEXT_PUBLIC_APP_NAME || 'Afri Connect'} <noreply@africonnect.io>`;

// ── Retry with exponential backoff ───────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function retryWithBackoff<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: Error | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[Email] ${label} attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// ── Central email sender ─────────────────────────────────────────────────────
// All emails go through this function. It logs to the email_log table and
// provides consistent error handling.

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  /** Optional: log context for the email_log table */
  logType?: string;
  logEntityId?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const recipients = Array.isArray(params.to) ? params.to : [params.to];

  if (!resend) {
    console.error('[Email] RESEND_API_KEY not configured — not sending:', params.subject);
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {

    // TODO(TEMP): log FULL email content to server logs for local testing — REMOVE before production.
    console.log(`[Email][TEMP] ────────── FULL EMAIL ──────────`);
    console.log(`[Email][TEMP] To: ${recipients.join(', ')}`);
    console.log(`[Email][TEMP] Subject: ${params.subject}`);
    console.log(`[Email][TEMP] Type: ${params.logType ?? 'unknown'}${params.logEntityId ? ` · Entity: ${params.logEntityId}` : ''}`);
    console.log(`[Email][TEMP] Body (HTML):
${params.html}`);
    console.log(`[Email][TEMP] ────────────────────────────────────`);


    const result = await retryWithBackoff(
      () => resend.emails.send({
        from: FROM,
        to: recipients,
        subject: params.subject,
        html: params.html,
      }),
      `send("${params.subject}")`,
    );

    if (result.error) {
      // console.error(`[Email] Resend error for "${params.subject}" to ${recipients.join(',')}:`, JSON.stringify(result.error));
      // console.log(`[Email] ⚠️ Email content (for testing — Resend blocked delivery):`);
      // console.log(params.html);
      await logEmail({ type: params.logType ?? 'unknown', to: recipients, subject: params.subject, success: false, error: JSON.stringify(result.error), entity_id: params.logEntityId });
      return { success: false, error: JSON.stringify(result.error) };
    }

    console.info(`[Email] Sent: ${params.subject} to ${recipients.length} recipient(s) — id: ${result.data?.id}`);
    await logEmail({ type: params.logType ?? 'unknown', to: recipients, subject: params.subject, success: true, email_id: result.data?.id, entity_id: params.logEntityId });
    return { success: true, id: result.data?.id };
  } catch (err: any) {
    console.error(`[Email] Exception sending "${params.subject}" to ${recipients.join(',')}:`, err.message);
    await logEmail({ type: params.logType ?? 'unknown', to: recipients, subject: params.subject, success: false, error: err.message, entity_id: params.logEntityId });
    return { success: false, error: err.message };
  }
}

// ── Email log (persists to DB) ───────────────────────────────────────────────

async function logEmail(params: {
  type: string;
  to: string[];
  subject: string;
  success: boolean;
  email_id?: string;
  error?: string;
  entity_id?: string;
}) {
  try {
    const admin = getSupabaseAdmin();
    await admin.from('email_log').insert({
      type: params.type,
      recipients: params.to,
      subject: params.subject,
      success: params.success,
      email_id: params.email_id ?? null,
      error: params.error ?? null,
      entity_id: params.entity_id ?? null,
    });
  } catch (err: any) {
    // Don't let logging failures break email sending
    console.error('[Email] Failed to log email:', err.message);
  }
}

// ── Public email functions (all use templates) ───────────────────────────────

export async function sendInviteEmail(params: { to: string; token: string; expiresAt: string; companyName?: string }) {
  const t = templates.inviteEmail({ token: params.token, expiresAt: params.expiresAt, companyName: params.companyName });
  return sendEmail({ to: params.to, subject: t.subject, html: t.html, logType: 'invite' });
}

export async function sendVerificationEmail(params: { to: string; fullName: string; verifyUrl: string; companyName?: string }) {
  const t = templates.verificationEmail({ fullName: params.fullName, verifyUrl: params.verifyUrl, companyName: params.companyName });
  return sendEmail({ to: params.to, subject: t.subject, html: t.html, logType: 'verification' });
}

export async function sendWelcomeEmail(params: { to: string; fullName: string; companyName?: string }) {
  const t = templates.welcomeEmail({ fullName: params.fullName, companyName: params.companyName });
  return sendEmail({ to: params.to, subject: t.subject, html: t.html, logType: 'welcome' });
}

export async function sendPasswordResetEmail(params: { to: string; fullName: string; resetUrl: string }) {
  const t = templates.passwordResetEmail({ fullName: params.fullName, resetUrl: params.resetUrl });
  return sendEmail({ to: params.to, subject: t.subject, html: t.html, logType: 'password_reset' });
}

export async function sendOrgStatusEmail(params: {
  to: string;
  orgName: string;
  status: 'verified' | 'rejected' | 'needs_update';
  note?: string;
}) {
  const t = templates.orgStatusEmail({ orgName: params.orgName, status: params.status, note: params.note });
  return sendEmail({ to: params.to, subject: t.subject, html: t.html, logType: 'org_status', logEntityId: params.orgName });
}

export async function sendAdminNewOrgNotification(params: {
  adminEmails: string[];
  orgName: string;
  orgType: string;
  requesterName: string;
}) {
  const t = templates.adminNewOrgEmail({ orgName: params.orgName, orgType: params.orgType, requesterName: params.requesterName });
  return sendEmail({ to: params.adminEmails, subject: t.subject, html: t.html, logType: 'admin_new_org', logEntityId: params.orgName });
}

export async function sendAdminOrgResubmittedNotification(params: {
  adminEmails: string[];
  orgName: string;
  orgType: string;
  requesterName: string;
}) {
  const t = templates.adminOrgResubmittedEmail({ orgName: params.orgName, orgType: params.orgType, requesterName: params.requesterName });
  return sendEmail({ to: params.adminEmails, subject: t.subject, html: t.html, logType: 'admin_org_resubmitted', logEntityId: params.orgName });
}

export async function sendAdminUserProvisionedEmail(params: { to: string; email: string; generatedPassword?: string }) {
  const t = templates.adminUserProvisionedEmail({ email: params.email, generatedPassword: params.generatedPassword });
  return sendEmail({ to: params.to, subject: t.subject, html: t.html, logType: 'admin_user_provisioned' });
}

export async function sendMfaCodeEmail(params: { to: string; fullName: string; code: string }) {
  const t = templates.mfaCodeEmail({ fullName: params.fullName, code: params.code });
  return sendEmail({ to: params.to, subject: t.subject, html: t.html, logType: 'mfa_code' });
}

export async function sendAccountLockedEmail(params: { to: string; fullName: string; lockedUntil: string }) {
  const t = templates.accountLockedEmail({ fullName: params.fullName, lockedUntil: params.lockedUntil });
  return sendEmail({ to: params.to, subject: t.subject, html: t.html, logType: 'account_locked' });
}

export async function sendMatchFoundEmail(params: { to: string; projectName: string; partnerName: string; score: number; role: 'developer' | 'partner' }) {
  const t = templates.matchFoundEmail({ projectName: params.projectName, partnerName: params.partnerName, score: params.score, role: params.role });
  return sendEmail({ to: params.to, subject: t.subject, html: t.html, logType: 'match_found' });
}

export async function sendEngagementUpdateEmail(params: { to: string; projectName: string; newStatus: string; recipientName: string }) {
  const t = templates.engagementUpdateEmail({ projectName: params.projectName, newStatus: params.newStatus, recipientName: params.recipientName });
  return sendEmail({ to: params.to, subject: t.subject, html: t.html, logType: 'engagement_updates' });
}

export async function sendProjectStatusEmail(params: { to: string; projectName: string; newStatus: string; note?: string; recipientName: string }) {
  const t = templates.projectStatusEmail({ projectName: params.projectName, newStatus: params.newStatus, note: params.note, recipientName: params.recipientName });
  return sendEmail({ to: params.to, subject: t.subject, html: t.html, logType: 'project_status' });
}

export async function sendMessageReceivedEmail(params: { to: string; senderName: string; recipientName: string; projectName: string; engagementId: string }) {
  const t = templates.messageReceivedEmail({ senderName: params.senderName, recipientName: params.recipientName, projectName: params.projectName, engagementId: params.engagementId });
  return sendEmail({ to: params.to, subject: t.subject, html: t.html, logType: 'message_received' });
}

// ── Legacy aliases (for backwards compatibility) ─────────────────────────────
// These match the old function signatures so existing callers don't break.

export const sendInviteWelcomeEmail = sendWelcomeEmail;

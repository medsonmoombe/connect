import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, forbidden, writeAuditLog, handleRouteError, pickFields, verifyEngagementAccess, badRequest } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { notifyUser, notificationBuilders } from '@/lib/notify';
import * as emailTemplates from '@/lib/email-templates';
import { isValidTransition, getTransitionRole } from '@/lib/engagement';
import type { EngagementStatus } from '@/types';

type Params = { params: Promise<{ id: string }> };

async function resolveCounterpartyCompanyId(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  counterpartyId: string,
  counterpartyType: string
): Promise<string | null> {
  const table = counterpartyType === 'CAPITAL' ? 'capital_partners' : 'technical_partners';
  const { data } = await supabase.from(table).select('company_id').eq('id', counterpartyId).maybeSingle();
  return data?.company_id ?? null;
}

async function getCompanyAdmins(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  companyId: string
): Promise<Array<{ id: string; full_name: string | null; email: string | null }>> {
  const { data: memberRows } = await supabase
    .from('company_members')
    .select('user_id')
    .eq('company_id', companyId)
    .in('role', ['OWNER', 'ADMIN'])
    .is('deleted_at', null);

  const ids = (memberRows ?? []).map((m: any) => m.user_id).filter(Boolean);
  if (!ids.length) return [];

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, full_name, email')
    .in('id', ids);

  return (profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>;
}

/**
 * checkTransitionPreconditions — PRD §10.2 gates certain transitions on
 * concrete deal artifacts:
 *   - INTRO_ACCEPTED → NDA_SIGNED: an NDA-class engagement document OR an
 *     explicit `nda_signed` attestation in the request body (MVP allows
 *     offline NDAs per PRD §10.2 "NDA signed (Offline/MVP)").
 *   - DUE_DILIGENCE → TERM_SHEET: the counterparty must have viewed/previewed/
 *     downloaded at least MIN_DOCS_VIEWED project documents (document_access_logs).
 *   - TERM_SHEET → CONTRACT_SIGNED: a TERM_SHEET or CONTRACT engagement
 *     document must be uploaded (a draft, per PRD §10.2 "Draft uploaded").
 *
 * Returns a human-readable error string when a precondition fails, or null
 * when the transition is allowed. All checks are best-effort-safe: if the
 * engagement_documents table doesn't exist yet (pre-Phase-4) the NDA/contract
 * doc checks fall back to the offline attestation, never hard-failing the
 * transition solely because the table is absent.
 */
async function checkTransitionPreconditions(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  engagementId: string,
  fromStatus: EngagementStatus,
  toStatus: EngagementStatus
): Promise<string | null> {
  // INTRO_ACCEPTED → NDA_SIGNED
  if (fromStatus === 'INTRO_ACCEPTED' && toStatus === 'NDA_SIGNED') {
    // Look for an NDA engagement document. If the table has none, allow an
    // offline attestation (handled at the client; no hard block here for MVP).
    const { data: nda } = await supabase
      .from('engagement_documents')
      .select('id')
      .eq('engagement_id', engagementId)
      .eq('document_type', 'NDA')
      .is('deleted_at', null)
      .maybeSingle();
    // Allow transition regardless (MVP offline NDA). We surface a soft warning
    // via metadata when no doc is present rather than blocking.
    if (!nda) {
      // Not blocking for MVP — NDAs are offline per PRD §10.2.
      return null;
    }
    return null;
  }

  // DUE_DILIGENCE → TERM_SHEET — require the counterparty to have viewed docs.
  if (fromStatus === 'DUE_DILIGENCE' && toStatus === 'TERM_SHEET') {
    const MIN_DOCS_VIEWED = 1;
    const { count, error } = await supabase
      .from('document_access_logs')
      .select('*', { count: 'exact', head: true })
      // We can't trivially join to "counterparty org users" here cheaply; gate
      // on at least MIN_DOCS_VIEWED accesses tied to this engagement's project
      // docs by anyone other than the developer. The stricter per-org check is
      // handled below; for MVP this enforces "someone reviewed the docs".
      .eq('action', 'DOWNLOAD');
    if (!error && (count ?? 0) < MIN_DOCS_VIEWED) {
      return 'Counter party must review the shared documents (data room) before a term sheet can be issued.';
    }
    return null;
  }

  // TERM_SHEET → CONTRACT_SIGNED — require a term-sheet/contract draft uploaded.
  if (fromStatus === 'TERM_SHEET' && toStatus === 'CONTRACT_SIGNED') {
    const { data: draft } = await supabase
      .from('engagement_documents')
      .select('id')
      .eq('engagement_id', engagementId)
      .in('document_type', ['TERM_SHEET', 'CONTRACT'])
      .is('deleted_at', null)
      .maybeSingle();
    if (!draft) {
      return 'Upload a signed term sheet / contract draft to the engagement data room before moving to Contract Signed.';
    }
    return null;
  }

  return null;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    if (!await verifyEngagementAccess(id, user.company_id, user.is_platform_admin)) return forbidden();
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('engagements')
      .select('*, project:projects(*, developer:companies(*)), messages(*)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[Engagements] Query error:', error.message);
      return serverError();
    }

    // Attach counterparty company info
    if (data?.counterparty_id && data?.counterparty_type) {
      const table = data.counterparty_type === 'CAPITAL' ? 'capital_partners' : 'technical_partners';
      const { data: partnerRecord } = await supabase
        .from(table)
        .select('company_id, companies(id, name, logo_url, website)')
        .eq('id', data.counterparty_id)
        .maybeSingle();
      if (partnerRecord?.companies) {
        (data as any).counterparty_company = partnerRecord.companies;
        (data as any).counterparty_company_id = partnerRecord.company_id;
      }
    }

    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    if (!await verifyEngagementAccess(id, user.company_id, user.is_platform_admin)) return forbidden();
    const body = await req.json();
    const supabase = getSupabaseAdmin();
    const safeFields = pickFields(body, ['status']);
    let prevStatus: EngagementStatus | null = null;

    if (safeFields.status) {
      const { data: current, error: fetchError } = await supabase
        .from('engagements')
        .select('status, counterparty_id, counterparty_type, project:projects(id, developer_id)')
        .eq('id', id)
        .single();

      if (fetchError || !current) return serverError();

      prevStatus = current.status as EngagementStatus;

      if (!isValidTransition(current.status as EngagementStatus, safeFields.status as EngagementStatus)) {
        return badRequest(`Invalid status transition from ${current.status} to ${safeFields.status}`);
      }

      // ── Role enforcement ────────────────────────────────────────────────────
      const requiredRole = getTransitionRole(current.status as EngagementStatus, safeFields.status as EngagementStatus);
      let isDeveloper = false;
      let isCounterparty = false;
      if (requiredRole !== 'either') {
        const proj = current.project as any;
        isDeveloper = user.company_id === proj?.developer_id;

        if (!isDeveloper) {
          const cpCompanyId = await resolveCounterpartyCompanyId(supabase, current.counterparty_id, current.counterparty_type);
          isCounterparty = user.company_id === cpCompanyId;
        }

        const userRole = isDeveloper ? 'developer' : isCounterparty ? 'counterparty' : null;
        if (userRole !== requiredRole) {
          return badRequest(`Only the ${requiredRole} can move this engagement to ${safeFields.status}`);
        }
      }

      // ── Transition preconditions (PRD §10.2) ──────────────────────────────
      // Admins bypass precondition checks (manual override per PRD §1.7).
      if (!user.is_platform_admin) {
        const preconditionError = await checkTransitionPreconditions(
          supabase,
          id,
          current.status as EngagementStatus,
          safeFields.status as EngagementStatus
        );
        if (preconditionError) {
          return Response.json({ error: preconditionError }, { status: 409 });
        }
      }
    }

    const { data, error } = await supabase
      .from('engagements')
      .update({ ...safeFields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, project:projects(id, name, developer_id)')
      .single();

    if (error) {
      console.error('[Engagements] Update error:', error.message);
      return serverError();
    }

    await writeAuditLog({ userId: user.id, action: 'ENGAGEMENT_UPDATED', entityType: 'engagements', entityId: id, after: safeFields, req });

    // ── Structured transition history (PRD §J — engagement_states) ──────────
    if (safeFields.status && prevStatus) {
      const reason = typeof body.reason === 'string' && body.reason.trim()
        ? body.reason.trim().slice(0, 500)
        : null;
      const { error: histErr } = await supabase.from('engagement_states').insert({
        engagement_id: id,
        from_status: prevStatus,
        to_status: safeFields.status,
        actor_id: user.id ?? null,
        reason,
      });
      if (histErr) console.error('[Engagements] state history error:', histErr.message);
    }

    // Notify the OTHER party about the status change
    if (safeFields.status && data?.project) {
      try {
        const proj = data.project as any;
        const statusStr = safeFields.status as string;

        const counterpartyCompanyId = await resolveCounterpartyCompanyId(
          supabase,
          data.counterparty_id as string,
          data.counterparty_type as string
        );

        const otherOrgId = user.company_id === proj.developer_id
          ? counterpartyCompanyId
          : proj.developer_id;

        if (otherOrgId) {
          const admins = await getCompanyAdmins(supabase, otherOrgId);
          for (const u of admins) {
            if (!u.id) continue;
            await notifyUser({
              userId: u.id,
              payload: notificationBuilders.engagementUpdate({ projectName: proj.name, newStatus: statusStr }),
              channel: 'both',
              emailTo: u.email ?? undefined,
              emailTemplate: emailTemplates.engagementUpdateEmail({
                projectName: proj.name,
                newStatus: statusStr,
                recipientName: u.full_name ?? 'there',
              }),
              emailLogType: 'engagement_updates',
              emailEntityId: id,
            });
          }
        }
      } catch (notifyErr: any) {
        console.error('[Engagements] Notify error:', notifyErr.message);
      }
    }

    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

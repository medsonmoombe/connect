import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, forbidden, writeAuditLog, handleRouteError, pickFields, verifyEngagementAccess, badRequest } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { notifyUser, notificationBuilders } from '@/lib/notify';
import * as emailTemplates from '@/lib/email-templates';
import { isValidTransition, getTransitionRole } from '@/lib/engagement';
import { validate, engagementPatchSchema } from '@/lib/validation';
import type { EngagementStatus } from '@/types';

type Params = { params: Promise<{ id: string }> };

async function resolveCounterpartyCompanyId(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  counterpartyId: string,
  counterpartyType: string
): Promise<string | null> {
  const table =
    counterpartyType === 'CAPITAL'        ? 'capital_partners' :
    counterpartyType === 'CONSULTANT'     ? 'consultants' :
    counterpartyType === 'GRANT_PROVIDER' ? 'grant_providers' :
    'technical_partners';
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
  toStatus: EngagementStatus,
  requestBody?: Record<string, any>,
  projectId?: string,
): Promise<string | null> {
  // INTRO_ACCEPTED → NDA_SIGNED
  if (fromStatus === 'INTRO_ACCEPTED' && toStatus === 'NDA_SIGNED') {
    // 1. Check for an uploaded NDA engagement document
    const { data: nda } = await supabase
      .from('engagement_documents')
      .select('id')
      .eq('engagement_id', engagementId)
      .eq('document_type', 'NDA')
      .is('deleted_at', null)
      .maybeSingle();

    if (nda) return null; // NDA document exists — allow

    // 2. Check for explicit offline attestation via `nda_signed: true` in request body
    if (requestBody?.nda_signed === true) return null;

    return 'An NDA document must be uploaded to the engagement data room, or an offline NDA attestation (nda_signed: true) must be provided to proceed.';
  }

  // DUE_DILIGENCE → TERM_SHEET — require the counterparty to have viewed docs.
  if (fromStatus === 'DUE_DILIGENCE' && toStatus === 'TERM_SHEET') {
    const MIN_DOCS_VIEWED = 1;

    // Check project document downloads (document_access_logs table)
    // Scope to the engagement's project — not platform-wide downloads
    let projectDocCount = 0;
    let projectErr = null;
    if (projectId) {
      // First get the document IDs for this project
      const { data: projectDocs } = await supabase
        .from('project_documents')
        .select('id')
        .eq('project_id', projectId)
        .is('deleted_at', null);
      const docIds = (projectDocs ?? []).map(d => d.id);
      if (docIds.length > 0) {
        const result = await supabase
          .from('document_access_logs')
          .select('id', { count: 'exact', head: true })
          .eq('action', 'DOWNLOAD')
          .in('document_id', docIds);
        projectDocCount = result.count ?? 0;
        projectErr = result.error;
      }
    }

    // Also check engagement document downloads (audit_logs table — engagement
    // docs can't satisfy the document_access_logs FK, so they're logged there)
    const { count: engDocCount, error: engErr } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('action_type', 'ENGAGEMENT_DOCUMENT_DOWNLOAD')
      .eq('entity_type', 'engagement_documents')
      .eq('entity_id', engagementId);

    const totalViewed = (projectDocCount ?? 0) + (engDocCount ?? 0);
    if (!projectErr && !engErr && totalViewed < MIN_DOCS_VIEWED) {
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
    const { id } = await params;    if (!await verifyEngagementAccess(id, user.company_id, user.is_platform_admin)) {
      return forbidden('You are not a participant in this engagement. Only the developer and the partner organisation can view engagement details.');
    }

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
      const table =
        data.counterparty_type === 'CAPITAL'        ? 'capital_partners' :
        data.counterparty_type === 'CONSULTANT'     ? 'consultants' :
        data.counterparty_type === 'GRANT_PROVIDER' ? 'grant_providers' :
        'technical_partners';
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
    if (!await verifyEngagementAccess(id, user.company_id, user.is_platform_admin)) {
      return forbidden('You are not a participant in this engagement. Only engagement participants can update it.');
    }
    const body = await req.json();

    const parsed = validate(engagementPatchSchema, body);
    if (!parsed.ok) return badRequest(parsed.error);

    const supabase = getSupabaseAdmin();
    const safeFields = pickFields(parsed.data, ['status']);
    let prevStatus: EngagementStatus | null = null;

    if (safeFields.status) {
      const { data: current, error: fetchError } = await supabase
        .from('engagements')
        .select('status, counterparty_id, counterparty_type, intro_origin, project:projects(id, developer_id)')
        .eq('id', id)
        .single();

      if (fetchError || !current) return serverError();

      prevStatus = current.status as EngagementStatus;

      // ── Terminal state guard ────────────────────────────────────────────────
      // Dropped and closed engagements are read-only for non-admins (PRD §1.7).
      const TERMINAL = ['DROPPED', 'CLOSED'] as const;
      if (!user.is_platform_admin && TERMINAL.includes(current.status as any)) {
        return badRequest('This engagement is closed and cannot be modified. Contact a platform admin if you need to reopen it.');
      }

      if (!isValidTransition(current.status as EngagementStatus, safeFields.status as EngagementStatus)) {
        return badRequest(`Invalid status transition from ${current.status} to ${safeFields.status}`);
      }

      // ── Role enforcement ────────────────────────────────────────────────────
      // intro_origin decides who must accept an introduction: the party that
      // did NOT initiate the request (see getTransitionRole / migration 073).
      const requiredRole = getTransitionRole(
        current.status as EngagementStatus,
        safeFields.status as EngagementStatus,
        (current as any).intro_origin ?? null
      );
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
          return badRequest(`Only the ${requiredRole === 'developer' ? 'project developer' : 'partner organisation'} can move this engagement to the next stage.`);
        }
      }

      // ── Transition preconditions (PRD §10.2) ──────────────────────────────
      // Admins bypass precondition checks (manual override per PRD §1.7).
      if (!user.is_platform_admin) {
        const preconditionError = await checkTransitionPreconditions(
          supabase,
          id,
          current.status as EngagementStatus,
          safeFields.status as EngagementStatus,
          body,
          (current.project as any)?.id,
        );
        if (preconditionError) {
          return Response.json({ error: preconditionError }, { status: 409 });
        }
      }
    }

    // ── CAS guard: only update if status still matches what we read ───────────
    let updateQuery = supabase
      .from('engagements')
      .update({ ...safeFields, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (prevStatus) {
      updateQuery = updateQuery.eq('status', prevStatus);
    }

    const { data, error, count } = await updateQuery
      .select('*, project:projects(id, name, developer_id)')
      .single();

    if (error) {
      console.error('[Engagements] Update error:', error.message);
      return serverError();
    }

    // If status was part of the update and no rows matched the CAS, the
    // engagement was concurrently modified — reject to prevent lost updates.
    if (safeFields.status && prevStatus && !data) {
      return Response.json(
        { error: 'This engagement was modified by another user. Please refresh and try again.' },
        { status: 409 }
      );
    }

    await writeAuditLog({ userId: user.id, action: 'ENGAGEMENT_UPDATED', entityType: 'engagements', entityId: id, after: safeFields, req, blocking: true });

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
          await Promise.all(
            admins.filter(u => u.id).map(u =>
              notifyUser({
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
              })
            )
          );
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

import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, badRequest, serverError, handleRouteError, verifyEngagementAccess } from '@/lib/api-helpers';
import { getStorageProvider } from '@/lib/storage-provider';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string; docId: string }> };

const SIGNED_URL_EXPIRY = 15 * 60; // 15 minutes (PRD §2.2)

/**
 * GET /api/engagements/{id}/documents/{docId}/download
 *
 * Issues a short-lived signed URL (15 min) for an engagement data-room document.
 * Records a DOWNLOAD event in `document_access_logs` for the audit trail (the
 * `document_id` column references `project_documents`, so for engagement-uploaded
 * docs — which aren't in `project_documents` — we log to audit_logs instead).
 *
 * Access: engagement participants (or platform admin). The engagement
 * membership check is the sole gate for engagement-scoped documents (all such
 * docs default to CONFIDENTIAL and are visible only to participants by design).
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: engagementId, docId } = await params;
    if (!await verifyEngagementAccess(engagementId, user.company_id, user.is_platform_admin)) return forbidden();

    const admin = getSupabaseAdmin();
    const { data: doc, error } = await admin
      .from('engagement_documents')
      .select('id, engagement_id, file_name, storage_path, mime_type, classification')
      .eq('id', docId)
      .eq('engagement_id', engagementId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('[EngagementDocs] download lookup error:', error.message);
      return serverError();
    }
    if (!doc) return badRequest('Document not found');

    const storage = getStorageProvider();
    let signedUrl: string;
    try {
      signedUrl = await storage.createSignedUrl('project-documents', doc.storage_path, SIGNED_URL_EXPIRY);
    } catch (e: any) {
      console.error('[EngagementDocs] signed URL error:', e?.message);
      return serverError();
    }

    // Audit the download (fire-and-forget).
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null;
    const userAgent = req.headers.get('user-agent') || null;
    admin
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action_type: 'ENGAGEMENT_DOCUMENT_DOWNLOAD',
        entity_type: 'engagement_documents',
        entity_id: doc.id,
        after_state: { engagement_id: engagementId, file_name: doc.file_name },
        ip_address: ip,
        user_agent: userAgent,
      })
      .then(({ error }) => {
        if (error) console.error('[EngagementDocs] audit insert error:', error.message);
      });

    return Response.json({ signedUrl, file_name: doc.file_name, mime_type: doc.mime_type });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

/**
 * DELETE /api/engagements/{id}/documents/{docId}
 *
 * Soft-delete an engagement document (sets deleted_at). Only the uploader or a
 * platform admin may delete; engagement access is still verified. The storage
 * object is left in place (deleted_at hides it from the UI; the audit trail
 * references it).
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: engagementId, docId } = await params;
    if (!await verifyEngagementAccess(engagementId, user.company_id, user.is_platform_admin)) return forbidden();

    const admin = getSupabaseAdmin();
    const { data: doc } = await admin
      .from('engagement_documents')
      .select('id, uploaded_by')
      .eq('id', docId)
      .eq('engagement_id', engagementId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!doc) return badRequest('Document not found');
    if (!user.is_platform_admin && doc.uploaded_by !== user.id) {
      return forbidden();
    }

    const { error } = await admin
      .from('engagement_documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', docId);

    if (error) {
      console.error('[EngagementDocs] soft-delete error:', error.message);
      return serverError();
    }
    return Response.json({ data: { id: docId, deleted: true } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

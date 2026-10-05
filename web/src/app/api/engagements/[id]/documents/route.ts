import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, badRequest, serverError, handleRouteError, verifyEngagementAccess, sanitizeFilename, ALLOWED_MIME_TYPES, MAX_FILE_SIZE, writeAuditLog } from '@/lib/api-helpers';
import { checkRateLimit, RATE_LIMIT_UPLOAD } from '@/lib/rate-limit';
import { getStorageProvider } from '@/lib/storage-provider';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

const SIGNED_URL_EXPIRY = 15 * 60; // 15 minutes (PRD §2.2)
const VALID_DOC_TYPES = new Set(['NDA', 'TERM_SHEET', 'CONTRACT', 'SUPPORTING']);
const VALID_CLASSIFICATIONS = new Set(['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL']);

/**
 * Engagement data room — list documents (GET) and upload (POST).
 *
 * Access: any engagement participant (developer org or counterparty org) or a
 * platform admin. RLS narrows reads to participants at the DB layer too.
 *
 * Storage: objects live in the existing `project-documents` bucket, namespaced
 * under `engagements/{engagementId}/...`.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: engagementId } = await params;
    if (!await verifyEngagementAccess(engagementId, user.company_id, user.is_platform_admin)) return forbidden();

    const admin = getSupabaseAdmin();

    // Log the list/view as an audit event for the engagement data room.
    writeAuditLog({
      userId: user.id,
      action: 'DATAROOM_VIEW',
      entityType: 'engagements',
      entityId: engagementId,
      req,
    }).catch(() => {});

    // Track dataroom open as interest signal (fire and forget)
    void (async () => {
      try {
        const { data: eng } = await admin.from('engagements').select('project_id').eq('id', engagementId).maybeSingle();
        if (eng?.project_id) {
          await admin.from('project_interest_signals').insert({
            project_id: eng.project_id,
            user_id: user.id,
            signal_type: 'dataroom_open',
          });
        }
      } catch (_) { /* fire-and-forget */ }
    })();

    const { data, error } = await admin
      .from('engagement_documents')
      .select('id, engagement_id, project_document_id, document_type, file_name, storage_path, mime_type, size_bytes, uploaded_by, classification, created_at, deleted_at')
      .eq('engagement_id', engagementId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[EngagementDocs] list error:', error.message);
      return serverError();
    }
    return Response.json({ data: data ?? [] });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: engagementId } = await params;
    if (!await verifyEngagementAccess(engagementId, user.company_id, user.is_platform_admin)) return forbidden();

    if (!user.id) return badRequest('Session missing user id');

    const admin = getSupabaseAdmin();

    // ── Terminal state guard: dropped/closed engagements are read-only ────────
    const { data: engStatus, error: engStatusErr } = await admin
      .from('engagements')
      .select('status')
      .eq('id', engagementId)
      .single();

    if (engStatusErr || !engStatus) return serverError();
    if (!user.is_platform_admin && ['DROPPED', 'CLOSED'].includes(engStatus.status)) {
      return badRequest('This engagement is in a terminal state. Documents cannot be uploaded.');
    }

    // ── Org role guard: MEMBERs can read but not upload documents ─────────────
    const orgRole = (user as any).org_member_role;
    if (!user.is_platform_admin && orgRole === 'MEMBER') {
      return forbidden();
    }

    // ── Max document count guard: max 5 non-deleted docs per engagement ───────
    const { count: docCount, error: docCountErr } = await admin
      .from('engagement_documents')
      .select('*', { count: 'exact', head: true })
      .eq('engagement_id', engagementId)
      .is('deleted_at', null);

    if (!docCountErr && (docCount ?? 0) >= 5) {
      return badRequest('Maximum of 5 documents allowed per engagement data room.');
    }

    // Per-user upload rate limit (reuse the project upload profile: 20/hr).
    const rateLimitResult = await checkRateLimit(user.id, RATE_LIMIT_UPLOAD);
    if (!rateLimitResult.allowed) {
      return Response.json(
        { error: 'Upload limit reached. Maximum 20 files per hour.' },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return badRequest('No file provided');

    const documentType = (formData.get('document_type') as string) || 'SUPPORTING';
    if (!VALID_DOC_TYPES.has(documentType)) {
      return badRequest('Invalid document_type. Must be NDA, TERM_SHEET, CONTRACT, or SUPPORTING.');
    }

    const classification = (formData.get('classification') as string) || 'CONFIDENTIAL';
    if (!VALID_CLASSIFICATIONS.has(classification)) {
      return badRequest('Invalid classification. Must be PUBLIC, RESTRICTED, or CONFIDENTIAL.');
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return badRequest('File type not allowed. Accepted: PDF, images, Word, Excel, PowerPoint, CSV.');
    }
    if (file.size > MAX_FILE_SIZE) {
      return badRequest(`File too large. Maximum size is ${Math.floor(MAX_FILE_SIZE / 1024 / 1024)}MB.`);
    }

    const safeName = sanitizeFilename(file.name);
    if (!safeName) return badRequest('Invalid filename');

    const timestamp = Date.now();
    const storagePath = `engagements/${engagementId}/${timestamp}_${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const storage = getStorageProvider();
    try {
      await storage.upload('project-documents', storagePath, buffer, file.type);
    } catch (uploadError: any) {
      console.error('[EngagementDocs] upload error:', uploadError.message);
      return serverError();
    }

    const { data, error } = await admin
      .from('engagement_documents')
      .insert({
        engagement_id: engagementId,
        document_type: documentType,
        file_name: safeName,
        storage_path: storagePath,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: user.id,
        classification,
      })
      .select('id, engagement_id, document_type, file_name, storage_path, mime_type, size_bytes, uploaded_by, classification, created_at')
      .single();

    if (error) {
      // Best-effort cleanup of the stored object if the DB insert fails so we
      // don't leak orphaned blobs.
      try { await storage.remove('project-documents', [storagePath]); } catch {}
      console.error('[EngagementDocs] insert error:', error.message);
      return serverError();
    }

    await writeAuditLog({
      userId: user.id,
      action: 'ENGAGEMENT_DOCUMENT_UPLOADED',
      entityType: 'engagement_documents',
      entityId: data.id,
      after: { engagement_id: engagementId, document_type: documentType, file_name: safeName, classification },
      req,
      blocking: true,
    });

    return Response.json({ data }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

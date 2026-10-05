import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, badRequest, forbidden, writeAuditLog, handleRouteError, sanitizeFilename, ALLOWED_MIME_TYPES, MAX_FILE_SIZE, verifyProjectCreator } from '@/lib/api-helpers';
import { checkRateLimit, RATE_LIMIT_UPLOAD } from '@/lib/rate-limit';
import { sniffFileTypeMismatch } from '@/lib/upload-constants';
import { createHash } from 'crypto';
import { getStorageProvider } from '@/lib/storage-provider';

type Params = { params: Promise<{ id: string }> };

const SIGNED_URL_EXPIRY = 15 * 60; // 15 minutes

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: projectId } = await params;
    if (!await verifyProjectCreator(projectId, user.id, user.is_platform_admin)) return forbidden();

    // Enforce upload rate limit (20 files/hour per user)
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

    const classification = (formData.get('classification') as string) || 'RESTRICTED';
    if (!['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL'].includes(classification)) {
      return badRequest('Invalid classification. Must be PUBLIC, RESTRICTED, or CONFIDENTIAL.');
    }

    // The document slot this upload is intended for. Dedupe is scoped by it so
    // the same file can fill several slots (e.g. one PDF proving both ZEMA and
    // the construction permit) without being rejected as a duplicate.
    const documentType = ((formData.get('document_type') as string) || '').trim().slice(0, 200);

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return badRequest('File type not allowed. Accepted: PDF, images, Word, Excel, PowerPoint, CSV.');
    }

    if (file.size === 0) {
      return badRequest('Empty files cannot be uploaded.');
    }

    if (file.size > MAX_FILE_SIZE) {
      return badRequest('File too large. Maximum size is 20MB.');
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Magic-byte check — reject renamed executables/HTML masquerading as docs.
    const mismatch = sniffFileTypeMismatch(buffer, file.type);
    if (mismatch) {
      return badRequest(`File "${file.name}" was rejected: ${mismatch}.`);
    }

    const safeName = sanitizeFilename(file.name);
    if (!safeName) return badRequest('Invalid filename');

    const timestamp = Date.now();
    const storagePath = `${projectId}/${timestamp}_${safeName}`;

    const storage = getStorageProvider();

    // Compute SHA-256 hash for deduplication
    const fileHash = createHash('sha256').update(buffer).digest('hex');

    // Check for duplicate within this project — for the same document slot.
    // A file may be reused across different slots (its content is identical but
    // it answers a different requirement), so scope the check by document_type
    // when the caller told us which slot it is filling. Callers that omit it
    // keep the original content-only behaviour.
    const { getSupabaseAdmin } = await import('@/lib/supabase-server');
    const supabase = getSupabaseAdmin();

    let duplicateQuery = supabase
      .from('project_documents')
      .select('id, document_type, storage_path, uploaded_at')
      .eq('project_id', projectId)
      .eq('file_hash', fileHash)
      .is('deleted_at', null);

    if (documentType) {
      duplicateQuery = duplicateQuery.eq('document_type', documentType);
    }

    const { data: existingDoc } = await duplicateQuery.maybeSingle();

    if (existingDoc) {
      return Response.json(
        {
          error: 'Duplicate file',
          message: 'An identical file already exists in this project.',
          existing_document: {
            id: existingDoc.id,
            document_type: existingDoc.document_type,
            storage_path: existingDoc.storage_path,
            uploaded_at: existingDoc.uploaded_at,
          },
        },
        { status: 409 }
      );
    }

    try {
      await storage.upload('project-documents', storagePath, buffer, file.type);
    } catch (uploadError: any) {
      console.error('[Upload] Storage error:', uploadError.message);
      return serverError();
    }

    // Generate a short-lived signed URL instead of a permanent public URL
    let signedUrl: string;
    try {
      signedUrl = await storage.createSignedUrl('project-documents', storagePath, SIGNED_URL_EXPIRY);
    } catch (signedError: any) {
      console.error('[Upload] Signed URL error:', signedError?.message);
      return serverError();
    }

    await writeAuditLog({
      userId: user.id,
      action: 'DOCUMENT_UPLOADED',
      entityType: 'project_documents',
      entityId: projectId,
      after: { file_name: safeName, storage_path: storagePath, classification, mime_type: file.type },
      req,
      blocking: true,
    });

    return Response.json(
      { file_url: signedUrl, storage_path: storagePath, file_hash: fileHash, mime_type: file.type },
      { status: 201 }
    );
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: projectId } = await params;
    const { searchParams } = new URL(req.url);
    const storagePath = searchParams.get('storage_path');
    if (!storagePath) return badRequest('storage_path required');

    if (!storagePath.startsWith(`${projectId}/`)) {
      return badRequest('Invalid storage path');
    }
    if (!await verifyProjectCreator(projectId, user.id, user.is_platform_admin)) return forbidden();

    const storage = getStorageProvider();
    try {
      await storage.remove('project-documents', [storagePath]);
    } catch (error: any) {
      console.error('[Upload] Storage error:', error.message);
      return serverError();
    }

    return Response.json({ success: true });
  } catch (e) {
    return handleRouteError(e);
  }
}

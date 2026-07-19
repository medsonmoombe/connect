import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, badRequest, forbidden, writeAuditLog, handleRouteError, sanitizeFilename, ALLOWED_MIME_TYPES, MAX_FILE_SIZE, verifyProjectCreator } from '@/lib/api-helpers';
import { checkRateLimit, RATE_LIMIT_UPLOAD } from '@/lib/rate-limit';
import { runProjectAnalysis } from '@/lib/ai-analysis';
import { createHash } from 'crypto';
import { getStorageProvider } from '@/lib/storage-provider';

type Params = { params: Promise<{ id: string }> };
type StoredDocumentPath = { storage_path: string | null };

const SIGNED_URL_EXPIRY = 15 * 60; // 15 minutes

async function triggerAutoAnalysis(projectId: string, storagePath: string) {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase-server');

    const admin = getSupabaseAdmin();

    const { data: settings } = await admin
      .from('platform_settings')
      .select('value')
      .eq('key', 'ai_analysis')
      .maybeSingle();

    const aiConfig = settings?.value;
    if (!aiConfig?.auto_trigger) return;

    const { data: documents } = await admin
      .from('project_documents')
      .select('storage_path')
      .eq('project_id', projectId)
      .is('deleted_at', null);

    const documentPaths = ((documents ?? []) as StoredDocumentPath[])
      .map((d) => d.storage_path)
      .filter((p): p is string => typeof p === 'string');

    if (!documentPaths.includes(storagePath)) documentPaths.push(storagePath);
    if (documentPaths.length === 0) return;

    // Call analysis logic directly — no unauthenticated HTTP fetch
    await runProjectAnalysis(projectId, documentPaths);
  } catch (err) {
    console.error('[Upload] Auto-analysis trigger failed:', err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: projectId } = await params;
    if (!await verifyProjectCreator(projectId, user.id, user.is_platform_admin)) return forbidden();

    // Enforce upload rate limit (20 files/hour per user)
    const rateLimitResult = checkRateLimit(user.id, RATE_LIMIT_UPLOAD);
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

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return badRequest('File type not allowed. Accepted: PDF, images, Word, Excel, PowerPoint, CSV.');
    }

    if (file.size > MAX_FILE_SIZE) {
      return badRequest('File too large. Maximum size is 20MB.');
    }

    const safeName = sanitizeFilename(file.name);
    if (!safeName) return badRequest('Invalid filename');

    const timestamp = Date.now();
    const storagePath = `${projectId}/${timestamp}_${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const storage = getStorageProvider();

    // Compute SHA-256 hash for deduplication
    const fileHash = createHash('sha256').update(buffer).digest('hex');

    // Check for duplicate within this project
    const { getSupabaseAdmin } = await import('@/lib/supabase-server');
    const supabase = getSupabaseAdmin();

    const { data: existingDoc } = await supabase
      .from('project_documents')
      .select('id, document_type, storage_path, uploaded_at')
      .eq('project_id', projectId)
      .eq('file_hash', fileHash)
      .is('deleted_at', null)
      .maybeSingle();

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
      after: { file_name: safeName, storage_path: storagePath, classification },
      req,
    });

    // Auto-trigger AI analysis if enabled (fire and forget)
    triggerAutoAnalysis(projectId, storagePath);

    return Response.json(
      { file_url: signedUrl, storage_path: storagePath, file_hash: fileHash },
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

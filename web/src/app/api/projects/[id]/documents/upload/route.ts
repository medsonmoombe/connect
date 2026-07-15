import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, badRequest, forbidden, writeAuditLog, handleRouteError, sanitizeFilename, ALLOWED_MIME_TYPES, MAX_FILE_SIZE, verifyProjectOwnership } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string }> };
type StoredDocumentPath = { storage_path: string | null };

async function triggerAutoAnalysis(projectId: string, storagePath: string) {
  try {
    const admin = getSupabaseAdmin();

    // Check if auto-trigger is enabled
    const { data: settings } = await admin
      .from('platform_settings')
      .select('value')
      .eq('key', 'ai_analysis')
      .maybeSingle();

    const aiConfig = settings?.value;
    if (!aiConfig?.auto_trigger) return;

    // Get all document paths for this project from the document table.
    const { data: documents } = await admin
      .from('project_documents')
      .select('storage_path')
      .eq('project_id', projectId)
      .is('deleted_at', null);

    const documentPaths = ((documents ?? []) as StoredDocumentPath[])
      .map((document) => document.storage_path)
      .filter((path): path is string => typeof path === 'string');

    // Add the newly uploaded document if not already in the list
    if (!documentPaths.includes(storagePath)) {
      documentPaths.push(storagePath);
    }

    if (documentPaths.length === 0) return;

    // Trigger analysis via internal API call
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    await fetch(`${baseUrl}/api/projects/${projectId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentPaths }),
    });
  } catch (err) {
    console.error('[Upload] Auto-analysis trigger failed:', err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: projectId } = await params;
    if (!await verifyProjectOwnership(projectId, user.company_id, user.is_platform_admin)) return forbidden();

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return badRequest('No file provided');

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return badRequest('File type not allowed. Accepted: PDF, images, Word, Excel, PowerPoint, CSV.');
    }

    if (file.size > MAX_FILE_SIZE) {
      return badRequest('File too large. Maximum size is 50MB.');
    }

    const safeName = sanitizeFilename(file.name);
    if (!safeName) return badRequest('Invalid filename');

    const timestamp = Date.now();
    const storagePath = `${projectId}/${timestamp}_${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.storage
      .from('project-documents')
      .upload(storagePath, buffer, { contentType: file.type, upsert: false });

    if (error) {
      console.error('[Upload] Storage error:', error.message);
      return serverError();
    }

    const { data: { publicUrl } } = supabase.storage
      .from('project-documents')
      .getPublicUrl(storagePath);

    await writeAuditLog({ userId: user.id, action: 'DOCUMENT_UPLOADED', entityType: 'project_documents', entityId: projectId, after: { file_name: safeName, storage_path: storagePath }, req });

    // Auto-trigger AI analysis if enabled (fire and forget)
    triggerAutoAnalysis(projectId, storagePath);

    return Response.json({ file_url: publicUrl, storage_path: storagePath }, { status: 201 });
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
    if (!await verifyProjectOwnership(projectId, user.company_id, user.is_platform_admin)) return forbidden();

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage.from('project-documents').remove([storagePath]);
    if (error) {
      console.error('[Upload] Storage error:', error.message);
      return serverError();
    }

    return Response.json({ success: true });
  } catch (e) {
    return handleRouteError(e);
  }
}

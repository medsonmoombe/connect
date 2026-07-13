import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, badRequest, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: projectId } = await params;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return badRequest('No file provided');

    const timestamp = Date.now();
    const storagePath = `${projectId}/${timestamp}_${file.name}`;

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

    await writeAuditLog({ userId: user.id, action: 'DOCUMENT_UPLOADED', entityType: 'project_documents', entityId: projectId, after: { file_name: file.name, storage_path: storagePath }, req });

    return Response.json({ file_url: publicUrl, storage_path: storagePath }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await getAuthenticatedUser(req);
    const { searchParams } = new URL(req.url);
    const storagePath = searchParams.get('storage_path');
    if (!storagePath) return badRequest('storage_path required');

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage.from('project-documents').remove([storagePath]);
    if (error) {
      console.error('[Upload] Storage error:', error.message);
      return serverError();
    }

    return Response.json({ success: true });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

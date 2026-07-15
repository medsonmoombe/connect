import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, forbidden, writeAuditLog, handleRouteError, pickFields, verifyProjectOwnership } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

const DOCUMENT_FIELDS = ['document_type', 'file_url', 'storage_path'];

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    if (!await verifyProjectOwnership(id, user.company_id, user.is_platform_admin)) return forbidden();
    const body = await req.json();
    const supabase = getSupabaseAdmin();
    const safeFields = pickFields(body, DOCUMENT_FIELDS);

    const { data, error } = await supabase
      .from('project_documents')
      .insert({ ...safeFields, project_id: id })
      .select()
      .single();

    if (error) {
      console.error('[Documents] Insert error:', error.message);
      return serverError();
    }
    await writeAuditLog({ userId: user.id, action: 'DOCUMENT_ADDED', entityType: 'project_documents', entityId: data.id, after: body, req });

    return Response.json({ data }, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    if (!await verifyProjectOwnership(id, user.company_id, user.is_platform_admin)) return forbidden();
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get('document_id');
    if (!documentId) return Response.json({ error: 'document_id required' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('project_documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', documentId)
      .eq('project_id', id);
    if (error) {
      console.error('[Documents] Delete error:', error.message);
      return serverError();
    }
    return Response.json({ success: true });
  } catch (e) {
    return handleRouteError(e);
  }
}

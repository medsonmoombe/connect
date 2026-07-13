import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('project_documents')
      .insert({ ...body, project_id: id })
      .select()
      .single();

    if (error) {
      console.error('[Documents] Insert error:', error.message);
      return serverError();
    }
    await writeAuditLog({ userId: user.id, action: 'DOCUMENT_ADDED', entityType: 'project_documents', entityId: data.id, after: body, req });

    return Response.json({ data }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get('document_id');
    if (!documentId) return Response.json({ error: 'document_id required' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('project_documents').update({ deleted_at: new Date().toISOString() }).eq('id', documentId);
    if (error) {
      console.error('[Documents] Delete error:', error.message);
      return serverError();
    }
    return Response.json({ success: true });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

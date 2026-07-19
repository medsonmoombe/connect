import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, forbidden, badRequest, writeAuditLog, handleRouteError, pickFields, verifyProjectCreator } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

const DOCUMENT_FIELDS = ['document_type', 'file_url', 'storage_path', 'file_hash', 'classification'];

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    if (!await verifyProjectCreator(id, user.id, user.is_platform_admin)) return forbidden();
    const body = await req.json();
    const supabase = getSupabaseAdmin();
    const safeFields = pickFields(body, DOCUMENT_FIELDS);

    // Prevent path traversal: storage_path must be scoped to this project
    if (safeFields.storage_path && typeof safeFields.storage_path === 'string') {
      if (!safeFields.storage_path.startsWith(`${id}/`)) {
        return badRequest('Invalid storage path');
      }
    }

    // Prevent arbitrary external URLs: file_url must reference the project-documents bucket
    if (safeFields.file_url && typeof safeFields.file_url === 'string') {
      const url = safeFields.file_url;
      const isValidUrl = url.includes('/object/sign/project-documents/') || url.includes('/storage/v1/object/project-documents/');
      if (!isValidUrl) {
        return badRequest('Invalid file URL: must be a signed URL from the project-documents bucket');
      }
    }

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
    if (!await verifyProjectCreator(id, user.id, user.is_platform_admin)) return forbidden();
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get('document_id');
    if (!documentId) return Response.json({ error: 'document_id required' }, { status: 400 });

    const supabase = getSupabaseAdmin();

    // Soft-delete the document
    const { error } = await supabase
      .from('project_documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', documentId)
      .eq('project_id', id);
    if (error) {
      console.error('[Documents] Delete error:', error.message);
      return serverError();
    }

    // If the project has AI scores, invalidate them and revert to draft
    const { data: scores } = await supabase
      .from('project_scores')
      .select('id')
      .eq('project_id', id)
      .maybeSingle();

    let scoresInvalidated = false;
    if (scores) {
      const { data: project } = await supabase
        .from('projects')
        .select('status')
        .eq('id', id)
        .single();

      // Wipe scores
      await supabase
        .from('project_scores')
        .delete()
        .eq('project_id', id);

      // Revert project to draft and clear visibility
      await supabase
        .from('projects')
        .update({
          status: 'draft',
          is_visible_to_investors: false,
          scores_visible_at: null,
        })
        .eq('id', id);

      // Log in status history
      if (project?.status && project.status !== 'draft') {
        await supabase.from('project_status_history').insert({
          project_id: id,
          from_status: project.status,
          to_status: 'draft',
          actor_id: user.id,
          reason: 'Document deleted — AI scores invalidated',
        });
      }

      await writeAuditLog({
        userId: user.id,
        action: 'SCORES_INVALIDATED',
        entityType: 'projects',
        entityId: id,
        before: { status: project?.status },
        after: { status: 'draft', reason: 'Document deleted' },
        req,
      });

      scoresInvalidated = true;
    }

    await writeAuditLog({ userId: user.id, action: 'DOCUMENT_DELETED', entityType: 'project_documents', entityId: documentId, req });

    return Response.json({ success: true, scores_invalidated: scoresInvalidated });
  } catch (e) {
    return handleRouteError(e);
  }
}

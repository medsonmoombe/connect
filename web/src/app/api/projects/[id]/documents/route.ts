import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, forbidden, badRequest, writeAuditLog, handleRouteError, pickFields, verifyProjectCreator } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { invalidateProjectAnalysis, markProjectAnalysisDirty } from '@/lib/analysis-trigger';

type Params = { params: Promise<{ id: string }> };

const DOCUMENT_FIELDS = ['document_type', 'file_url', 'storage_path', 'file_hash', 'classification', 'mime_type'];

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

    // â”€â”€ Document versioning: find latest version of this type and increment â”€â”€
    let nextVersion = 1;
    let previousDocId: string | null = null;
    if (safeFields.document_type) {
      const { data: latestDoc } = await supabase
        .from('project_documents')
        .select('id, version')
        .eq('project_id', id)
        .eq('document_type', safeFields.document_type)
        .is('deleted_at', null)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestDoc) {
        nextVersion = (latestDoc.version ?? 0) + 1;
        previousDocId = latestDoc.id;
      }
    }

    const { data, error } = await supabase
      .from('project_documents')
      .insert({
        ...safeFields,
        project_id: id,
        version: nextVersion,
      })
      .select()
      .single();

    if (error) {
      console.error('[Documents] Insert error:', error.message);
      return serverError();
    }

    // Mark the previous version as replaced
    if (previousDocId) {
      await supabase
        .from('project_documents')
        .update({ replaced_by: data.id, replaced_at: new Date().toISOString() })
        .eq('id', previousDocId);
    }

    // Documents changed: invalidate the stored analysis and queue a fresh (throttled) run.
    await invalidateProjectAnalysis(supabase, id, user.id);

    await writeAuditLog({ userId: user.id, action: 'DOCUMENT_ADDED', entityType: 'project_documents', entityId: data.id, after: { ...body, version: nextVersion }, req });

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
          reason: 'Document deleted â€” AI scores invalidated',
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
        blocking: true,
      });

      scoresInvalidated = true;
    }

    // Documents changed: the stored analysis is no longer current.
    await markProjectAnalysisDirty(supabase, id);

    await writeAuditLog({ userId: user.id, action: 'DOCUMENT_DELETED', entityType: 'project_documents', entityId: documentId, req, blocking: true });

    return Response.json({ success: true, scores_invalidated: scoresInvalidated });
  } catch (e) {
    return handleRouteError(e);
  }
}

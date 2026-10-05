import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, handleRouteError, verifyProjectCreator } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/documents/versions?document_type=FEASIBILITY_STUDY
 * Returns version history for documents of a given type within a project.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const docType = searchParams.get('document_type');

    if (!await verifyProjectCreator(id, user.company_id, user.is_platform_admin)) {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('project_documents')
      .select('id, document_type, file_url, version, replaced_by, replaced_at, uploaded_at, file_hash, classification')
      .eq('project_id', id)
      .order('uploaded_at', { ascending: false });

    if (docType) query = query.eq('document_type', docType);

    const { data, error } = await query;

    if (error) {
      console.error('[DocumentVersions] Query error:', error.message);
      return serverError();
    }

    // Group by document_type and chain versions
    const versions = (data ?? []).reduce((acc: Record<string, any[]>, doc: any) => {
      const key = doc.document_type;
      if (!acc[key]) acc[key] = [];
      acc[key].push(doc);
      return acc;
    }, {});

    return Response.json({ data: versions });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

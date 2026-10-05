import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: projectId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, developer_id, status, is_visible_to_investors')
      .eq('id', projectId)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) return serverError();

    const canBookmark = user.is_platform_admin
      || project.developer_id === user.company_id
      || (project.status === 'live' && project.is_visible_to_investors);

    if (!canBookmark) {
      return Response.json({ error: 'Project is not available to bookmark' }, { status: 403 });
    }

    const { data: existing } = await supabase
      .from('project_bookmarks')
      .select('id')
      .eq('user_id', user.auth_id)
      .eq('project_id', projectId)
      .maybeSingle();

    if (existing) {
      await supabase.from('project_bookmarks').delete().eq('id', existing.id);
      return Response.json({ bookmarked: false });
    }

    const { error: insertError } = await supabase
      .from('project_bookmarks')
      .insert({ user_id: user.auth_id, project_id: projectId });

    if (insertError) {
      console.error('[Bookmark] Insert error:', insertError.message);
      return serverError();
    }

    // Track bookmark as interest signal
    try {
      await supabase.from('project_interest_signals').upsert({
        project_id: projectId,
        user_id: user.auth_id,
        signal_type: 'bookmark',
      }, { onConflict: 'project_id,user_id,signal_type', ignoreDuplicates: true });
    } catch { /* non-blocking */ }

    return Response.json({ bookmarked: true }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: projectId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: project } = await supabase
      .from('projects')
      .select('id, developer_id, status, is_visible_to_investors')
      .eq('id', projectId)
      .is('deleted_at', null)
      .single();

    if (!project) return Response.json({ bookmarked: false });

    const canViewBookmark = user.is_platform_admin
      || project.developer_id === user.company_id
      || (project.status === 'live' && project.is_visible_to_investors);

    if (!canViewBookmark) return Response.json({ bookmarked: false });

    const { data } = await supabase
      .from('project_bookmarks')
      .select('id')
      .eq('user_id', user.auth_id)
      .eq('project_id', projectId)
      .maybeSingle();

    return Response.json({ bookmarked: !!data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

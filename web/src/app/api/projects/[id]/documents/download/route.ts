import { NextRequest } from 'next/server';
import { getAuthenticatedUser, badRequest, forbidden, serverError, handleRouteError, verifyProjectOwnership } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { getStorageProvider } from '@/lib/storage-provider';

type Params = { params: Promise<{ id: string }> };

const SIGNED_URL_EXPIRY = 15 * 60; // 15 minutes

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: projectId } = await params;
    const { searchParams } = new URL(req.url);
    const storagePath = searchParams.get('storage_path');

    if (!storagePath) return badRequest('storage_path required');
    if (!storagePath.startsWith(`${projectId}/`)) return badRequest('Invalid storage path');

    const supabase = getSupabaseAdmin();

    // Verify the document actually belongs to this project in the DB
    const { data: doc } = await supabase
      .from('project_documents')
      .select('id, classification')
      .eq('project_id', projectId)
      .eq('storage_path', storagePath)
      .is('deleted_at', null)
      .single();

    if (!doc) return badRequest('Document not found');

    // Access check: owner/admin OR partner with an accepted engagement
    const isOwner = await verifyProjectOwnership(projectId, user.company_id, user.is_platform_admin);
    let engagementId: string | null = null;

    if (!isOwner) {
      // Check if partner has an accepted engagement on this project
      const { data: cpPartner } = await supabase
        .from('capital_partners')
        .select('id')
        .eq('company_id', user.company_id)
        .maybeSingle();
      const { data: tpPartner } = await supabase
        .from('technical_partners')
        .select('id')
        .eq('company_id', user.company_id)
        .maybeSingle();
      const partnerIds = [cpPartner?.id, tpPartner?.id].filter(Boolean) as string[];

      let hasAcceptedEngagement = false;
      if (partnerIds.length > 0) {
        const { data: engagement } = await supabase
          .from('engagements')
          .select('id, status')
          .eq('project_id', projectId)
          .in('counterparty_id', partnerIds)
          .not('status', 'in', '("INTRO_SENT","DROPPED")')
          .maybeSingle();
        hasAcceptedEngagement = !!engagement;
        if (engagement) engagementId = engagement.id;
      }

      if (!hasAcceptedEngagement) return forbidden();

      // Classification enforcement for non-owners
      if (doc.classification === 'CONFIDENTIAL' && !engagementId) {
        return forbidden();
      }
      if (doc.classification === 'RESTRICTED' && !hasAcceptedEngagement) {
        return forbidden();
      }
    }

    const storage = getStorageProvider();
    let signedUrl: string;
    try {
      signedUrl = await storage.createSignedUrl('project-documents', storagePath, SIGNED_URL_EXPIRY);
    } catch (error: any) {
      console.error('[Download] Signed URL error:', error?.message);
      return serverError();
    }

    // Log access to document_access_logs (fire and forget)
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null;
    const userAgent = req.headers.get('user-agent') || null;
    supabase
      .from('document_access_logs')
      .insert({
        user_id: user.id,
        document_id: doc.id,
        action: 'DOWNLOAD',
        ip_address: ip,
        user_agent: userAgent,
      })
      .then(({ error }) => {
        if (error) console.error('[Download] Access log error:', error.message);
      });

    // Track document download as interest signal (fire and forget)
    supabase.from('project_interest_signals').insert({
      project_id: projectId,
      user_id: user.id,
      signal_type: 'document_download',
    });

    return Response.json({ signedUrl });
  } catch (e) {
    return handleRouteError(e);
  }
}

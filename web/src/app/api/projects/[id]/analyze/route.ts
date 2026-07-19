import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, badRequest, forbidden, writeAuditLog, handleRouteError, verifyProjectOwnership } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { checkRateLimit, RATE_LIMIT_AI_ANALYSIS } from '@/lib/rate-limit';
import { runProjectAnalysis } from '@/lib/ai-analysis';
import { transitionProject } from '@/lib/project-state-machine';
import { createHash } from 'crypto';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: projectId } = await params;
    if (!await verifyProjectOwnership(projectId, user.company_id, user.is_platform_admin)) return forbidden();

    const rateLimitResult = checkRateLimit(user.id, RATE_LIMIT_AI_ANALYSIS);
    if (!rateLimitResult.allowed) {
      return Response.json(
        { error: 'AI analysis limit reached. Maximum 5 analyses per hour.' },
        { status: 429 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: project } = await supabase
      .from('projects')
      .select('status')
      .eq('id', projectId)
      .single();

    if (!project) return badRequest('Project not found');

    // Owners can analyze draft, scoring, or pending_live projects; admins can analyze any
    if (!user.is_platform_admin && !['draft', 'scoring', 'pending_live'].includes(project.status)) {
      return badRequest('Analysis can only be run on draft or scoring projects.');
    }

    // Transition to scoring state (idempotent if already scoring)
    if (project.status === 'draft' || project.status === 'pending_live') {
      await transitionProject({ projectId, toStatus: 'scoring', actorId: user.id!, req });
    }

    const { data: documents } = await supabase
      .from('project_documents')
      .select('storage_path, file_url, file_hash')
      .eq('project_id', projectId)
      .is('deleted_at', null);

    const storedPaths = (documents ?? [])
      .map((doc) => {
        if (doc.storage_path) return doc.storage_path;
        try {
          const url = new URL(doc.file_url);
          const marker = '/object/public/project-documents/';
          const idx = url.pathname.indexOf(marker);
          if (idx !== -1) return decodeURIComponent(url.pathname.slice(idx + marker.length));
        } catch {}
        return null;
      })
      .filter((p): p is string => typeof p === 'string' && p.startsWith(`${projectId}/`));

    if (storedPaths.length === 0) {
      // Revert to draft if no documents
      await transitionProject({ projectId, toStatus: 'draft', actorId: user.id!, req });
      return badRequest('No valid project documents found. Please upload documents first.');
    }

    // Compute a hash of the document set (sorted file hashes) for caching
    const docHashes = (documents ?? [])
      .filter((d) => d.file_hash && d.storage_path?.startsWith(`${projectId}/`))
      .map((d) => d.file_hash!)
      .sort();
    const documentsHash = docHashes.length > 0
      ? createHash('sha256').update(docHashes.join('')).digest('hex')
      : null;

    // Check for cached analysis — return existing scores if document set hasn't changed
    if (documentsHash) {
      const { data: cachedScores } = await supabase
        .from('project_scores')
        .select('*')
        .eq('project_id', projectId)
        .eq('documents_hash', documentsHash)
        .maybeSingle();

      if (cachedScores) {
        await writeAuditLog({
          userId: user.id,
          action: 'PROJECT_ANALYZED',
          entityType: 'projects',
          entityId: projectId,
          after: { document_count: storedPaths.length, cached: true },
          req,
        });
        return Response.json({
          success: true,
          data: cachedScores,
          cached: true,
          message: 'Documents unchanged since last analysis. Showing cached scores.',
        });
      }
    }

    let scoringResult: any;
    try {
      scoringResult = await runProjectAnalysis(projectId, storedPaths);
    } catch (e: any) {
      // Revert to draft on analysis failure
      await transitionProject({ projectId, toStatus: 'draft', actorId: user.id!, req });
      throw e;
    }

    // Save scores directly with the document set hash for caching
    const regulatory = Math.round(scoringResult.breakdown?.regulatory?.score ?? 0);
    const financial = Math.round(scoringResult.breakdown?.financial?.score ?? 0);
    const developer = Math.round(scoringResult.breakdown?.developer?.score ?? 0);
    const totalScore = Math.round(scoringResult.total_score ?? (regulatory + financial + developer));

    const { data: savedScores } = await supabase
      .from('project_scores')
      .upsert({
        project_id: projectId,
        capital_readiness_score: totalScore,
        regulatory_score: regulatory,
        financial_score: financial,
        developer_score: developer,
        breakdown: scoringResult.breakdown,
        risk_flags: (scoringResult.risk_signals || []).map((r: any) => `${r.level}: ${r.text}`),
        recommendations: scoringResult.recommendations || [],
        summary: scoringResult.summary || 'Analysis complete.',
        documents_hash: documentsHash,
      }, { onConflict: 'project_id' })
      .select()
      .single();

    // Transition to pending_live after successful scoring
    await transitionProject({ projectId, toStatus: 'pending_live', actorId: user.id!, req });

    // Trigger matching engine in background
    triggerMatching(projectId);

    await writeAuditLog({
      userId: user.id,
      action: 'PROJECT_ANALYZED',
      entityType: 'projects',
      entityId: projectId,
      after: { document_count: storedPaths.length },
      req,
    });

    return Response.json({ success: true, data: savedScores });
  } catch (e: any) {
    if (e.message === 'No documents could be loaded for analysis') {
      return badRequest(e.message);
    }
    return handleRouteError(e);
  }
}

async function triggerMatching(projectId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    await fetch(`${baseUrl}/api/matching/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId }),
    });
  } catch {
    // Matching trigger is fire-and-forget — don't block or spam logs
  }
}

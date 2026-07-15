import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, badRequest, forbidden, writeAuditLog, handleRouteError, verifyProjectOwnership } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { GoogleGenerativeAI } from '@google/generative-ai';

type Params = { params: Promise<{ id: string }> };

const PROMPT = `
You are an expert institutional infrastructure investor specialized in the African energy market.
Analyze the attached project documents.

CRITICAL MANDATE: RELEVANCE & INTEGRITY CHECK
Before scoring, verify if the uploaded documents are relevant to infrastructure development, energy projects, or corporate project finance.
If irrelevant: set total_score to 0, all sub-scores to 0, add a HIGH DATA_INTEGRITY risk signal, and state in summary that analysis cannot proceed.

SCORING CRITERIA (Only apply if documents are relevant):

1. Regulatory & Project Readiness (40%)
   - Site Rights & Land Security (6%), Environmental Approval (5%), Grid Readiness (7%),
     Feasibility Study Quality (8%), PPA/Offtake Agreement (8%), Construction Readiness (3%),
     Licensing Status (2%), Corporate Compliance (1%)

2. Financial Viability (35%)
   - CAPEX Benchmarking (5%), OPEX Sustainability (5%), FIRR (10%), FNPV (7%),
     Payback Period (5%), Sensitivity Analysis (3%)

3. Developer Strength (25%)
   - Legal & Regulatory Compliance (3%), Track Record Development (6%), Track Record Operations (4%),
     EPC/Technical Partnerships (4%), Equity Commitment (4%), Funding Readiness (3%), Company Strength (1%)

Output JSON exactly matching this schema:
{
  "total_score": number,
  "breakdown": {
    "regulatory": { "score": number, "max": 40, "details": { "site_rights": number, "environmental": number, "grid_readiness": number, "feasibility": number, "ppa_status": number, "construction_ready": number, "licensing": number, "compliance": number } },
    "financial": { "score": number, "max": 35, "details": { "capex_benchmarking": number, "opex_sustainability": number, "firr": number, "fnpv": number, "payback_period": number, "sensitivity_analysis": number } },
    "developer": { "score": number, "max": 25, "details": { "legal_compliance": number, "track_record_dev": number, "track_record_ops": number, "epc_partnerships": number, "equity_commitment": number, "funding_readiness": number, "company_strength": number } }
  },
  "risk_signals": [{ "level": "HIGH" | "MEDIUM" | "LOW", "category": string, "text": string }],
  "recommendations": string[],
  "summary": string
}`;

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: projectId } = await params;
    if (!await verifyProjectOwnership(projectId, user.company_id, user.is_platform_admin)) return forbidden();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return serverError('GEMINI_API_KEY not configured');

    const supabase = getSupabaseAdmin();
    const body = await req.json().catch(() => ({}));
    const requestedPaths = Array.isArray(body?.documentPaths)
      ? body.documentPaths.filter((path: unknown): path is string => typeof path === 'string')
      : [];

    const { data: documents, error: documentsError } = await supabase
      .from('project_documents')
      .select('storage_path, file_url')
      .eq('project_id', projectId)
      .is('deleted_at', null);

    if (documentsError) {
      console.error('[Analyze] Document query error:', documentsError.message);
      return serverError();
    }

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
      .filter((path): path is string => typeof path === 'string' && path.startsWith(`${projectId}/`));

    const allowedPaths = new Set(storedPaths);
    const documentPaths = requestedPaths.length
      ? requestedPaths.filter((path) => allowedPaths.has(path))
      : storedPaths;

    if (documentPaths.length === 0) {
      return badRequest('No valid project document storage paths found. Please re-upload the documents.');
    }

    // Download files from Supabase Storage and convert to inline base64 parts.
    // Paths are loaded from project_documents and constrained to this project id.
    const fileParts: { inlineData: { data: string; mimeType: string } }[] = [];

    for (const storagePath of documentPaths) {
      const { data, error } = await supabase.storage
        .from('project-documents')
        .download(storagePath);
      if (error || !data) {
        console.warn(`Could not download ${storagePath}:`, error?.message);
        continue;
      }
      const buffer = Buffer.from(await data.arrayBuffer());
      fileParts.push({
        inlineData: { data: buffer.toString('base64'), mimeType: data.type || 'application/pdf' }
      });
    }

    if (fileParts.length === 0) return badRequest('No documents could be loaded for analysis');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const result = await model.generateContent([PROMPT, ...fileParts]);
    let text = result.response.text().trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    }

    let scoringResult;
    try {
      scoringResult = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/,(\s*[\]}])/g, '$1');
      scoringResult = JSON.parse(cleaned);
    }

    await writeAuditLog({ userId: user.id, action: 'PROJECT_ANALYZED', entityType: 'projects', entityId: projectId, after: { document_count: fileParts.length }, req });

    return Response.json({ success: true, data: scoringResult });
  } catch (e) {
    return handleRouteError(e);
  }
}

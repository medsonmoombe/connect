import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, badRequest, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
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
    const { documentPaths } = await req.json();

    if (!documentPaths?.length) return badRequest('documentPaths required');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return serverError('GEMINI_API_KEY not configured');

    // Download files from Supabase Storage and convert to inline base64 parts
    const supabase = getSupabaseAdmin();
    const fileParts: { inlineData: { data: string; mimeType: string } }[] = [];

    for (const storagePath of documentPaths) {
      // storagePath could be a Supabase path (projectId/timestamp_name.pdf)
      // or a Firebase Storage path (projects/projectId/timestamp_name.pdf) for old docs
      const isSupabasePath = !storagePath.startsWith('projects/');

      if (isSupabasePath) {
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
      } else {
        // Old Firebase Storage path — fetch via public URL as fallback
        const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        const url = `https://storage.googleapis.com/${bucket}/${storagePath}`;
        const res = await fetch(url);
        if (!res.ok) { console.warn(`Could not fetch ${url}`); continue; }
        const buffer = Buffer.from(await res.arrayBuffer());
        const mimeType = res.headers.get('content-type') || 'application/pdf';
        fileParts.push({ inlineData: { data: buffer.toString('base64'), mimeType } });
      }
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
  } catch (e: any) {
    return handleRouteError(e);
  }
}

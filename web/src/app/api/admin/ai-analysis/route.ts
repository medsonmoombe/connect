import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, writeAuditLog } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { checkRateLimit, RATE_LIMIT_AI_ANALYSIS } from '@/lib/rate-limit';
import { getAiProvider } from '@/lib/ai-provider';

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const TEMPERATURE = 0.1;

const FALLBACK_RESULT = {
  macroSummary: 'AI analysis failed — score defaulted to 0. Admin review required.',
  portfolioScore: 0,
  marketContext: {
    regionalOutlook: 'Analysis unavailable',
    regulatoryClimate: 'Analysis unavailable',
    financingConditions: 'Analysis unavailable',
  },
  systemicRisks: [],
  positiveHighlights: [],
  predictions: [],
  bottleneckAnalysis: {
    mostCommonBottleneck: 'AI analysis failure',
    affectedProjects: 0,
    estimatedDelayMonths: 0,
    industryBenchmark: 'N/A',
    resolutionStrategy: 'Retry analysis or contact support',
  },
  capitalReadiness: {
    readyForFinancing: 0,
    needsPreparation: 0,
    criticalGaps: ['AI analysis could not complete'],
    recommendedFinancingStructure: 'N/A',
  },
  strategicRecommends: [],
  projectSummaries: {},
};

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
  return getAiProvider();
};

const MODEL = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

/** Rough token estimator: ~4 chars per token */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function stripMarkdown(text: string): string {
  let t = text.trim();
  if (t.startsWith('```')) t = t.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  return t.replace(/,(\s*[}\]])/g, '$1');
}

export async function POST(req: NextRequest) {
  let user: any;
  try {
    user = await getAuthenticatedUser(req);
  } catch {
    return unauthorized();
  }
  if (!user.is_platform_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { action, projects, question, fileHash, fileName, analysisId: bodyAnalysisId } = await req.json();
    const supabase = getSupabaseAdmin();

    // ── ANALYZE ──────────────────────────────────────────────
    if (action === 'analyze') {
      if (!fileHash) {
        return NextResponse.json({ error: 'fileHash is required' }, { status: 400 });
      }

      // 1. Per-user AI rate limit (5 analyses/hour)
      const rl = checkRateLimit(user.id, RATE_LIMIT_AI_ANALYSIS);
      if (!rl.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'AI_RATE_LIMIT_EXCEEDED',
              message: `AI analysis limit reached. You can run ${RATE_LIMIT_AI_ANALYSIS.limit} analyses per hour. Resets at ${new Date(rl.resetAt).toLocaleTimeString()}.`,
              resetAt: new Date(rl.resetAt).toISOString(),
            },
          },
          { status: 429 }
        );
      }

      // 2. Deduplication — check if this exact file was already analysed
      const { data: existing } = await supabase
        .from('portfolio_analyses')
        .select('id, analysis_data, created_at, completed_at, portfolio_score, project_count, file_name')
        .eq('file_hash', fileHash)
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existing) {
        return NextResponse.json({
          success: true,
          data: existing.analysis_data,
          cached: true,
          cachedAt: existing.created_at,
          analysisId: existing.id,
          message: `This file was already analysed on ${new Date(existing.created_at).toLocaleDateString()}. Showing cached results. Upload a modified file to trigger a new analysis.`,
        });
      }

      // 3. Find previous analysis for this user (for versioning link)
      const { data: previous } = await supabase
        .from('portfolio_analyses')
        .select('id')
        .eq('performed_by', user.id)
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // 4. Create a pending record immediately (so failures are tracked)
      const { data: record, error: insertError } = await supabase
        .from('portfolio_analyses')
        .insert({
          file_hash: fileHash,
          file_name: fileName || 'unknown.xlsx',
          project_count: projects.length,
          performed_by: user.id,
          status: 'pending',
          projects_snapshot: projects,
          previous_analysis_id: previous?.id ?? null,
        })
        .select('id')
        .single();

      if (insertError || !record) {
        throw new Error('Failed to create analysis record');
      }

      const analysisId = record.id;

      // 5. Build prompt
      const totalCost = projects.reduce((s: number, p: any) => s + (p.costUSD || 0), 0);
      const totalMW = projects.reduce((s: number, p: any) => s + (p.capacityMW || 0), 0);
      const highRisk = projects.filter((p: any) => p.riskScore === 'High').length;
      const locations = [...new Set(projects.map((p: any) => p.location).filter(Boolean))].join(', ');

        const prompt = `
You are a senior infrastructure investment analyst specializing in African energy markets with access to real-time web data.

PORTFOLIO OVERVIEW:
- Total projects: ${projects.length}
- Total capital required: $${totalCost.toFixed(1)}M USD
- Total generation capacity: ${totalMW.toLocaleString()} MW
- High-risk projects: ${highRisk}
- Locations: ${locations}

FULL PROJECT DATA:
${JSON.stringify(projects, null, 2)}

TASK: Perform a comprehensive institutional-grade portfolio analysis. Use your Google Search access to ground your analysis with:
- Current African energy market conditions and trends (2024-2025)
- Zambia/regional electricity tariff rates and ZESCO grid capacity
- ZEMA regulatory timelines and approval backlogs
- ERB licensing current processing times
- African Development Bank and IFC energy financing conditions
- Regional PPA market rates and offtake trends
- EPC contractor availability and cost escalation in Southern Africa

Return ONLY valid JSON matching this EXACT schema (no markdown, no extra text):
{
  "macroSummary": "4-5 sentence executive summary grounded in current market context",
  "portfolioScore": number,
  "marketContext": {
    "regionalOutlook": "string",
    "regulatoryClimate": "string",
    "financingConditions": "string"
  },
  "systemicRisks": [
    {
      "title": "string",
      "severity": "High|Medium|Low",
      "rootCause": "string",
      "description": "string",
      "impact": "string",
      "solution": "string"
    }
  ],
  "positiveHighlights": [
    { "title": "string", "impact": "High|Medium|Low", "description": "string" }
  ],
  "predictions": [
    {
      "horizon": "6 months|12 months|24 months|5 years",
      "prediction": "string",
      "confidence": "High|Medium|Low",
      "basis": "string"
    }
  ],
  "bottleneckAnalysis": {
    "mostCommonBottleneck": "string",
    "affectedProjects": number,
    "estimatedDelayMonths": number,
    "industryBenchmark": "string",
    "resolutionStrategy": "string"
  },
  "capitalReadiness": {
    "readyForFinancing": number,
    "needsPreparation": number,
    "criticalGaps": ["string"],
    "recommendedFinancingStructure": "string"
  },
  "strategicRecommends": [
    {
      "priority": "Immediate|Short-term|Long-term",
      "action": "string",
      "rationale": "string",
      "expectedOutcome": "string"
    }
  ],
  "projectSummaries": {
    "<exact project name>": {
      "summary": "string",
      "keyRisk": "string",
      "nextAction": "string",
      "timeToFinancialClose": "string"
    }
  }
}`;

        // 6. Call Gemini with retry + fallback
        const ai = getGenAI();

        let analysisData: any;
        let geminiFailed = false;
        let lastError: unknown;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            const rawText = await ai.generateContent(MODEL(), prompt, {
              temperature: TEMPERATURE,
              tools: [{ googleSearch: {} }],
            });
            const cleanText = stripMarkdown(rawText);
            analysisData = JSON.parse(cleanText);
            geminiFailed = false;
            break;
          } catch (geminiError: any) {
            geminiFailed = true;
            lastError = geminiError;
            if (attempt < MAX_RETRIES) {
              const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
              await new Promise(r => setTimeout(r, delay));
            }
          }
        }

        if (geminiFailed || !analysisData) {
          analysisData = FALLBACK_RESULT;
        }

        const rawTextForTokens = JSON.stringify(analysisData);
        const tokens = estimateTokens(prompt + rawTextForTokens);

        // 7. Update record to complete (or mark failed and use fallback)
        await supabase
          .from('portfolio_analyses')
          .update({
            status: geminiFailed ? 'failed' : 'complete',
            analysis_data: analysisData,
            portfolio_score: analysisData.portfolioScore ?? 0,
            estimated_tokens: tokens,
            completed_at: new Date().toISOString(),
          })
          .eq('id', analysisId);

        await writeAuditLog({ userId: user.id, action: 'AI_ANALYSIS_COMPLETED', entityType: 'portfolio_analyses', entityId: analysisId, after: { file_name: fileName, project_count: projects.length, failed: geminiFailed }, req });

        return NextResponse.json({
          success: true,
          data: analysisData,
          cached: false,
          analysisId,
          failed: geminiFailed,
        });

      // ── ANALYZE end
      }

      // ── CHAT ─────────────────────────────────────────────────
      if (action === 'chat') {
        const ai = getGenAI();

        const prompt = `You are an expert AI Portfolio Assistant for an African energy infrastructure investment platform. You have deep knowledge of African energy markets, project finance, regulatory frameworks (ZEMA, ERB, ZESCO), and DFI financing.

You have access to real-time web search — use it to ground your answers with current market data when relevant.

Portfolio context:
${JSON.stringify(projects, null, 2)}

Question: ${question}

Provide a thorough, expert answer. Be specific, cite relevant market data or regulatory context where applicable, and give actionable insights.`;

      const text = await ai.generateContent(MODEL(), prompt, {
        tools: [{ googleSearch: {} }],
      });
      return NextResponse.json({ text });
    }

    // ── GET HISTORY ──────────────────────────────────────────
    if (action === 'history') {
      const { data: history, error } = await supabase
        .from('portfolio_analyses')
        .select('id, file_name, project_count, portfolio_score, status, estimated_tokens, created_at, completed_at, performed_by')
        .eq('performed_by', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return NextResponse.json({ success: true, data: history });
    }

    // ── GET SINGLE ANALYSIS ──────────────────────────────────
    if (action === 'get') {
      const id = bodyAnalysisId || req.nextUrl.searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'analysisId required' }, { status: 400 });

      const { data, error } = await supabase
        .from('portfolio_analyses')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (err: any) {
    console.error('[AI Analysis] Error:', err);
    return serverError();
  }
}

// GET /api/admin/ai-analysis?action=history
export async function GET(req: NextRequest) {
  let user: any;
  try {
    user = await getAuthenticatedUser(req);
  } catch {
    return unauthorized();
  }
  if (!user.is_platform_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('portfolio_analyses')
    .select('id, file_name, project_count, portfolio_score, status, estimated_tokens, created_at, completed_at, performed_by')
    .eq('performed_by', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[AI Analysis] Query error:', error.message);
    return serverError();
  }
  return NextResponse.json({ success: true, data });
}

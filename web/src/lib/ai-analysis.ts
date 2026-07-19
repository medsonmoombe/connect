import { getStorageProvider } from './storage-provider';
import { getAiProvider } from './ai-provider';

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const TEMPERATURE = 0.1;

const FALLBACK_SCORE = {
  total_score: 0,
  breakdown: {
    regulatory: { score: 0, max: 40, details: { site_rights: 0, environmental: 0, grid_readiness: 0, feasibility: 0, ppa_status: 0, construction_ready: 0, licensing: 0, compliance: 0 } },
    financial: { score: 0, max: 35, details: { capex_benchmarking: 0, opex_sustainability: 0, firr: 0, fnpv: 0, payback_period: 0, sensitivity_analysis: 0 } },
    developer: { score: 0, max: 25, details: { legal_compliance: 0, track_record_dev: 0, track_record_ops: 0, epc_partnerships: 0, equity_commitment: 0, funding_readiness: 0, company_strength: 0 } },
  },
  risk_signals: [{ level: 'HIGH' as const, category: 'AI_ANALYSIS_FAILURE', text: 'AI analysis failed — score defaulted to 0. Admin review required.' }],
  recommendations: ['AI analysis failed. Please retry or contact support.'],
  summary: 'AI analysis could not be completed. Scores have been set to 0 pending manual review.',
};

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

export async function runProjectAnalysis(projectId: string, documentPaths: string[]) {
  const storage = getStorageProvider();

  const fileParts: { inlineData: { data: string; mimeType: string } }[] = [];

  for (const storagePath of documentPaths) {
    if (!storagePath.startsWith(`${projectId}/`)) continue;
    try {
      const buffer = await storage.download('project-documents', storagePath);
      fileParts.push({
        inlineData: { data: buffer.toString('base64'), mimeType: 'application/pdf' },
      });
    } catch (err: any) {
      console.warn(`[AI] Could not download ${storagePath}:`, err?.message);
      continue;
    }
  }

  if (fileParts.length === 0) throw new Error('No documents could be loaded for analysis');

  const ai = getAiProvider();
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const text = await ai.generateContentWithFiles(modelName, PROMPT, fileParts, {
        responseMimeType: 'application/json',
        temperature: TEMPERATURE,
      });

      let cleanText = text.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }

      try {
        return JSON.parse(cleanText);
      } catch {
        const cleaned = cleanText.replace(/,(\s*[\]}])/g, '$1');
        return JSON.parse(cleaned);
      }
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  console.error('[AI Analysis] All retries exhausted:', lastError);
  return FALLBACK_SCORE;
}

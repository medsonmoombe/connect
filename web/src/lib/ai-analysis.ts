import { getStorageProvider } from './storage-provider';
import { getAiProvider, AiContentPart } from './ai-provider';
import { PROJECT_STAGE_FLOW } from './project-stages';
import { mimeFromFileName } from './upload-constants';
import { writeFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const TEMPERATURE = 0.1;

/** Max characters of extracted text passed to the model per document. */
const MAX_TEXT_PER_DOC = 24000;
/** Max spreadsheet sheets converted to text per workbook. */
const MAX_SHEETS = 3;

/**
 * MIME types Gemini can read natively via the Files API (documents + images).
 * Office formats and GIFs are NOT supported natively — they are handled via
 * text extraction or flagged as unreadable.
 */
const GEMINI_NATIVE_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const FALLBACK_SCORE = {
  total_score: 0,
  breakdown: {
    regulatory: { score: 0, max: 40, details: { site_rights: 0, environmental: 0, grid_readiness: 0, feasibility: 0, ppa_status: 0, construction_ready: 0, licensing: 0, compliance: 0 } },
    financial: { score: 0, max: 35, details: { capex_benchmarking: 0, opex_sustainability: 0, firr: 0, fnpv: 0, payback_period: 0, sensitivity_analysis: 0 } },
    developer: { score: 0, max: 25, details: { legal_compliance: 0, track_record_dev: 0, track_record_ops: 0, epc_partnerships: 0, equity_commitment: 0, funding_readiness: 0, company_strength: 0 } },
  },
  determined_stage: null,
  stage_rationale: '',
  recommended_services: [],
  document_analysis: [],
  stage_justification: { evidence_for: [], evidence_missing: [], key_drivers: [] },
  dimension_analysis: [],
  risk_signals: [{ level: 'HIGH' as const, category: 'AI_ANALYSIS_FAILURE', text: 'AI analysis failed — score defaulted to 0. Admin review required.' }],
  recommendations: ['AI analysis failed. Please retry or contact support.'],
  summary: 'AI analysis could not be completed. Scores have been set to 0 pending manual review.',
};

/**
 * Structured form data sent alongside the documents so the AI can determine
 * the project stage from the information the developer actually provided.
 */
export interface ProjectAnalysisContext {
  name?: string;
  technology_type?: string;
  location_country?: string;
  location_region?: string;
  project_size_mw?: number;
  capital_required?: number;
  capital_structure_type?: string;
  capex?: number;
  opex?: number;
  funding_required?: number;
  description?: string;
  has_secured_land?: boolean;
  land_title_status?: string;
  has_reached_financial_close?: boolean;
  regulatory_approvals?: string[];
  target_financial_close_date?: string;
  target_cod?: string;
  governance_terms?: string;
  risk_disclosures?: string;
  /** Preliminary form-only stage set by the readiness preview (used as a prior). */
  preview_stage?: string;
  tech_requirements?: {
    required_services?: string[];
    terrain_complexity?: string;
    grid_status?: string;
    budget_preference?: string;
    ppa_status?: string;
  };
}

/**
 * A project document to be analysed. `mime_type` is taken from the DB row
 * (falling back to the storage filename extension); `document_type` is the
 * human label (e.g. "Pitch Deck" or "LAND_TITLE_PROOF").
 */
export interface ProjectAnalysisDocument {
  storage_path: string;
  mime_type?: string | null;
  document_type?: string | null;
}

interface PreparedTextDoc {
  name: string;
  text: string;
}

interface PreparedNativeDoc {
  name: string;
  fileUri: string;
  mimeType: string;
  geminiFileName: string;
}

function buildPrompt(context: ProjectAnalysisContext | null, documents: ProjectAnalysisDocument[] = []): string {
  const contextBlock = context
    ? `PROJECT INFORMATION (provided by the developer on the submission form):\n${JSON.stringify(context, null, 2)}`
    : 'PROJECT INFORMATION: Not provided — base your analysis on the documents only.';

  const manifest = documents.length > 0
    ? documents.map((d, i) => {
        const label = d.document_type?.replace(/_/g, ' ') || d.storage_path.split('/').pop() || `document-${i + 1}`;
        return `  ${i + 1}. ${label} (${d.mime_type || 'unknown format'})`;
      }).join('\n')
    : '  (none attached)';

  return `
You are an expert institutional infrastructure investor specialized in the African energy market.
Analyze the attached project documents together with the project information provided below.

HOW TO WORK (read this first — it defines accuracy, not style):
1. Read every document in the manifest. Work document by document.
2. For each scoring criterion, ask: "WHICH document proves this, and what does it actually say?" A score above 0 without a named document behind it is an error.
3. Form answers are CLAIMS. A claim can only score what its proof would score. Ticked checkbox + no proof document = score 0 for that criterion, and flag it.
4. When documents contradict the form, the documents win. Score the contradiction, don't average it away.
5. Be conservative. Under-score a genuinely weak document; never inflate a plausible-looking one. Reviewers re-check every claim your scores support.

${contextBlock}

DOCUMENT MANIFEST — every uploaded document is listed below. You MUST read and assess EACH one:
${manifest}
For PDF and image attachments you receive the actual file content. For Excel/CSV/Word attachments you receive a TEXT EXTRACT (labelled "TEXT EXTRACT"). For formats that could not be parsed you must still record an entry for the file in document_analysis, with content_summary noting that the file could not be parsed automatically.

PER-DOCUMENT ANALYSIS (the heart of this review)
You MUST produce EXACTLY ONE document_analysis entry for EVERY file in the manifest — never fewer. Never claim a file is valid just because it was uploaded. For EACH document determine:
  1. detected_type — what the document actually is (e.g. "Land title deed", "Feasibility study", "Power purchase agreement", "Unrelated photograph", "Blank scan").
  2. content_summary — AT LEAST 2 sentences on what the document ACTUALLY contains (quote concrete details: parties, dates, amounts, capacities, page count where visible).
  3. key_facts — 2-5 concrete facts or figures found in the document.
  4. relevance — HIGH / MEDIUM / LOW, i.e. how relevant the content is to an energy infrastructure project.
  5. authenticity_concerns — an explicit verdict for EVERY document, with evidence: set to null only when the document is genuinely what it claims to be and shows no red flags. Otherwise describe exactly what is wrong, e.g.: blank or unreadable pages; content that does not match its declared type (a random invoice or photo uploaded as a land title); generic/template documents with no project-specific details; signs of alteration or forgery (inconsistent fonts/dates, cut-and-paste signatures, metadata mismatch); missing signatures, seals or stamps on official documents.
  6. supports_project_claims — true/false: does the content back up the claims made in the form (land secured, financial close reached, regulatory approvals held)?
  7. belongs_to_project — true/false: is this document about THIS project? True requires POSITIVE identity: the document names the project or the developer/SPV as a party, or states a capacity AND location that both match the form. A well-written energy document about some OTHER project is FALSE. Generic templates with no project identity are FALSE.
  8. project_identity — what the document ITSELF names (never copy form values): { "project_name": string|null, "capacity_mw": number|null, "location": string|null, "parties": string[] }.

CROSS-CHECK MANDATE
Compare the facts in every document against (a) the project information in the form and (b) the other documents. Flag EVERY inconsistency explicitly in authenticity_concerns or content_summary — e.g. a land title in a different region than the form's location, a PPA naming a different project, financial figures that contradict the capex/size provided, or two documents with contradictory dates. Note in content_summary which claims each document confirms or contradicts.

IDENTITY RECONCILIATION (documents must speak the project's language)
A document only counts as evidence when it belongs to THIS project (belongs_to_project true). Facts from a document about another project are another project's facts — they must NOT raise any score here. For every document with belongs_to_project false, state in content_summary what project/company/location the document actually belongs to, and add a HIGH or MEDIUM DATA_INTEGRITY risk signal: HIGH when the document names a different project or company (contradiction), MEDIUM when it is generic or carries no project identity (unverifiable).

CRITICAL MANDATE: RELEVANCE & INTEGRITY CHECK
Base ALL scores on the actual content you read — never on the mere presence of a file. A document whose content does NOT match the claim it is meant to prove scores 0 for that criterion: e.g. an unrelated file uploaded as proof of land security means site_rights scores 0; a blank scan uploaded as a financial close statement means the financial criteria it supports score 0. Add a HIGH or MEDIUM DATA_INTEGRITY risk signal for every document with authenticity_concerns (HIGH for fabrication, mismatched-purpose, or blank files; MEDIUM for minor inconsistencies).
Score ONLY from documents with belongs_to_project true. If NO document belongs to this project, set total_score to 0, all sub-scores to 0, add a HIGH DATA_INTEGRITY risk signal, and state in the summary that no uploaded document backs this project — the score is withheld, not estimated. If no document is relevant to infrastructure/energy/project finance at all, do the same.

STAGE DETERMINATION (documents are the PRIMARY evidence)
The uploaded documents are the PRIMARY evidence of the project's true development stage. Form answers are unverified claims that must be CONFIRMED against the documents — the documents ALWAYS win when they contradict the form.
Determine the single development stage the project is currently at:
${PROJECT_STAGE_FLOW.map((s) => `  ${s.number} = ${s.label}`).join('\n')}
Each stage milestone REQUIRES matching document evidence — never grant a milestone from the form answers alone:
  - Stage 5 (PPA Ready) requires an EXECUTED power purchase / offtake agreement in the documents (signature blocks present, parties named). A draft PPA or term sheet supports at most Stage 4.
  - Stage 4 (Regulatory Approval) requires approval DECISION letters (e.g. ZEMA certificate, executed grid connection agreement, construction permit). An application acknowledgement or submission receipt is NOT an approval — application ≠ approval.
  - Stage 6 (Financial Close) requires EXECUTED financing documents (signed loan/finance agreements, conditions precedent satisfied). A term sheet or in-principle letter supports at most Stage 5.
  - Stages 2-3 require genuine feasibility-type documents: Stage 2 needs a resource assessment or pre-feasibility study; Stage 3 needs a bankable feasibility study with technical design AND financial analysis (yield estimate, CAPEX/OPEX, IRR/NPV). A technology note alone is not a feasibility study.
  - Stage 7 requires construction contract WITH notice-to-proceed or dated progress evidence — a signed EPC contract alone shows award, not commenced works.
  - Stage 8 requires commissioning certificate, take-over certificate, or operating evidence.
Walk the stages upward from 1 and STOP at the first stage whose evidence is missing. The correct answer is the highest stage FULLY supported by the documents, never the stage the form claims.
If the documents are unrelated to an energy infrastructure project (e.g. song lyrics, personal photos, random invoices) or are blank/fake, the project cannot be placed past stage 1 (Concept) regardless of form claims — add a HIGH DATA_INTEGRITY risk signal. Return "determined_stage" as a NUMBER 1-8 plus a short "stage_rationale" (one or two sentences) explaining the judgement.
${context?.preview_stage ? `PRELIMINARY FORM-ONLY STAGE (developer's readiness preview): ${context.preview_stage.replace(/_/g, ' ')}. Treat this ONLY as the developer's self-estimate — a prior to weigh, never evidence. Confirm or correct it strictly against the documents; the documents always win.` : ''}

STAGE JUSTIFICATION (explain your decision like a professional analyst)
Return "stage_justification" with:
  - evidence_for: every concrete item (specific documents, quoting what they show) that supports the chosen stage. Each entry must name a document or a specific form field.
  - evidence_missing: exactly what is missing that would move the project to the NEXT stage (e.g. "No executed PPA — only a term sheet", "No feasibility study with financial analysis", "No land title proof").
  - key_drivers: the 2-3 factors that most influenced the stage decision.
If you returned a stage different from the form's claims, say so explicitly in key_drivers.

DIMENSION RATIONALE (explain every score)
For EACH of the three scoring dimensions (regulatory, financial, developer), return "dimension_analysis" with:
  - dimension, score, max (must match the breakdown values exactly),
  - rationale: a professional 1-3 sentence explanation of WHY that score was given, NAMING the documents and facts behind it. "Because the project is early-stage" is not a rationale — "the ESIA report is attached but no ZEMA decision letter, so environmental scores 3/5" is.
  - strengths: what the project does well in this dimension (array of short strings),
  - weaknesses: what is weak or unproven in this dimension (array of short strings),
  - sub_criteria: an array explaining EVERY individual sub-criterion score within this dimension. For each sub-criterion include:
      { "key": string (matches the breakdown details key, e.g. "site_rights"), "label": string (human label), "score": number, "max": number, "verdict": "STRONG" | "PARTIAL" | "WEAK" | "MISSING", "reason": string (1-2 sentences: what document or fact drove this score, or what is missing. Be specific — name the document, quote a figure, or state exactly what proof is absent.) }
    verdict guide: STRONG = score ≥ 80% of max; PARTIAL = 40–79%; WEAK = 1–39%; MISSING = 0.
Every score must be justified by actual document content — never by the mere presence of a file.

RECOMMENDED SERVICES
Based on the DETERMINED stage (not the stage the form claims), list the services the developer should engage next, using only these codes when applicable:
  FEASIBILITY_STUDY, ENVIRONMENTAL_ASSESSMENT, LEGAL_ADVISORY, FINANCIAL_ADVISORY, EPC_CONSTRUCTION, O_AND_M, GRID_CONNECTION, LOGISTICS
Example guidance: early stages (1,2,4) need consultants/feasibility; full feasibility (3) needs financial advisory + EPC prep; PPA ready (5) needs financial advisory; financial close (6) needs EPC + O&M; construction (7) needs O&M + engineering/procurement; operation (8) needs O&M. Return "recommended_services" as an array of codes.

SCORING CRITERIA (Only apply if documents are relevant)

Score each sub-criterion from 0 to its stated max. A sub-criterion scores its max ONLY when a named document explicitly proves it at full strength; partial proof earns partial credit; a claim without proof earns 0. Grade within each sub-criterion: proof present and explicit = max; present but generic/weak = ~50–70% of max; referenced but not attached = ~20–40% of max; absent = 0.

1. Regulatory & Project Readiness (40%)
   - Site Rights & Land Security (6), Environmental Approval (5), Grid Readiness (7),
     Feasibility Study Quality (8), PPA/Offtake Agreement (8), Construction Readiness (3),
     Licensing Status (2), Corporate Compliance (1)
   Evidence anchors: land = title/lease naming the project company; environmental = ESIA report + approval decision; grid = application receipt (low) vs executed connection agreement (full); feasibility = bankable study with financial analysis; PPA = executed agreement, not a draft; licensing = issued licence with number.

2. Financial Viability (35%)
   - CAPEX Benchmarking (5), OPEX Sustainability (5), FIRR (10), FNPV (7),
     Payback Period (5), Sensitivity Analysis (3)
   Evidence anchors: FIRR/FNPV/payback score only when a financial model or feasibility study actually computes them; sensitivity scores only when scenarios are varied, not merely mentioned. A pitch deck with round numbers scores near 0.

3. Developer Strength (25%)
   - Legal & Regulatory Compliance (3), Track Record Development (6), Track Record Operations (4),
     EPC/Technical Partnerships (4), Equity Commitment (4), Funding Readiness (3), Company Strength (1)
   Evidence anchors: track record scores from named delivered projects (with MW and dates), not self-description; equity commitment scores from bank statements, board resolutions or shareholder agreements; partnership scores from signed MOUs/contracts.

TOTAL SCORE — DERIVATION RULE (critical):
  total_score MUST equal regulatory.score + financial.score + developer.score, exactly.
  Compute the three dimension scores first, then ADD them. Do not estimate a total independently and do not round it away from the sum. If your total would differ from the sum of the sub-scores, your sub-scores are wrong — fix them, not the total.
  (Example of what NOT to do: sub-scores 14 + 8 + 10 = 32 with total 57.)

Output JSON exactly matching this schema:
{
  "total_score": "number — MUST equal regulatory.score + financial.score + developer.score",
  "breakdown": {
    "regulatory": { "score": number, "max": 40, "details": { "site_rights": number, "environmental": number, "grid_readiness": number, "feasibility": number, "ppa_status": number, "construction_ready": number, "licensing": number, "compliance": number } },
    "financial": { "score": number, "max": 35, "details": { "capex_benchmarking": number, "opex_sustainability": number, "firr": number, "fnpv": number, "payback_period": number, "sensitivity_analysis": number } },
    "developer": { "score": number, "max": 25, "details": { "legal_compliance": number, "track_record_dev": number, "track_record_ops": number, "epc_partnerships": number, "equity_commitment": number, "funding_readiness": number, "company_strength": number } }
  },
  "determined_stage": number,
  "stage_rationale": string,
  "recommended_services": string[],
  "document_analysis": [
    {
      "file_name": string,
      "detected_type": string,
      "content_summary": string,
      "key_facts": string[],
      "relevance": "HIGH" | "MEDIUM" | "LOW",
      "authenticity_concerns": string | null,
      "supports_project_claims": boolean,
      "belongs_to_project": boolean,
      "project_identity": { "project_name": string | null, "capacity_mw": number | null, "location": string | null, "parties": string[] }
    }
  ],
  "stage_justification": {
    "evidence_for": string[],
    "evidence_missing": string[],
    "key_drivers": string[]
  },
  "dimension_analysis": [
    {
      "dimension": "regulatory" | "financial" | "developer",
      "score": number,
      "max": number,
      "rationale": string,
      "strengths": string[],
      "weaknesses": string[],
      "sub_criteria": [
        { "key": string, "label": string, "score": number, "max": number, "verdict": "STRONG" | "PARTIAL" | "WEAK" | "MISSING", "reason": string }
      ]
    }
  ],
  "risk_signals": [{ "level": "HIGH" | "MEDIUM" | "LOW", "category": string, "text": string }],
  "recommendations": string[],
  "summary": string
}`;
}

/**
 * Lightweight stage-only prompt — used mid-form (after step 2) so the
 * developer sees where their project sits before continuing. No documents
 * are required; the stage is refined again at submission by the full analysis.
 */
function buildStagePrompt(context: ProjectAnalysisContext | null): string {
  const contextBlock = context
    ? `PROJECT INFORMATION (provided by the developer on the submission form):\n${JSON.stringify(context, null, 2)}`
    : 'PROJECT INFORMATION: Not provided — base your analysis on the project information only.';

  return `
You are an expert institutional infrastructure investor specialized in the African energy market.
Determine the current development stage of the project described below.

${contextBlock}

STAGE DETERMINATION (preliminary — no documents reviewed yet)
Using ONLY the project information, estimate the current development stage:
${PROJECT_STAGE_FLOW.map((s) => `  ${s.number} = ${s.label}`).join('\n')}
This is a PRELIMINARY estimate made before documents are reviewed. Treat every claim as UNVERIFIED:
- A milestone that is only self-declared in the form (a PPA, an approval, financial close) is a CLAIM, not evidence. It must not be assumed to exist.
- Distinguish what the form says was DONE from what is PLANNED: target dates (target_financial_close_date, target_cod) describe the future and prove nothing about the current stage.
- Status granularity matters: "application submitted" does not mean "approved"; "under negotiation" does not mean "signed". If the form only shows a claim was made rather than completed with detail, the milestone is unproven.
- When evidence is ambiguous or unverified, place the project at the EARLIEST stage the provided facts actually justify. Overstating the stage sets the developer up for a fall at verification; understating costs them nothing.
- Claims that are internally inconsistent (e.g. stage claimed far beyond the detail provided) should pull the estimate DOWN, and you should say so in stage_rationale.
Return "determined_stage" as a NUMBER 1-8 plus a short "stage_rationale" (one or two sentences) explaining the judgement and noting it will be verified against documents at submission.

RECOMMENDED SERVICES
Based on the stage you determined (not any stage claimed in the form), list the services the developer should engage next, using only these codes when applicable:
  FEASIBILITY_STUDY, ENVIRONMENTAL_ASSESSMENT, LEGAL_ADVISORY, FINANCIAL_ADVISORY, EPC_CONSTRUCTION, O_AND_M, GRID_CONNECTION, LOGISTICS
Return "recommended_services" as an array of codes.

Output JSON exactly matching this schema:
{
  "determined_stage": number,
  "stage_rationale": string,
  "recommended_services": string[]
}`;
}

/**
 * Determine the project's development stage (1-8) from the form data alone.
 * Uses the admin-configured provider/model from ai_provider_config.
 * Falls back to legacy Gemini if the provider layer is unavailable.
 */
export async function runStageDetermination(context?: ProjectAnalysisContext | null) {
  const prompt = buildStagePrompt(context ?? null);

  // Use the admin-configured provider/model from the DB
  try {
    const { getSupabaseAdmin } = await import('./supabase-server');
    const { getAIConfig } = await import('./ai/config');
    const { createProvider } = await import('./ai/factory');
    const { resolveModel } = await import('./ai/catalog');
    const { SYSTEM_PROMPT } = await import('./ai/prompt');
    const sb = getSupabaseAdmin();
    const cfg = await getAIConfig(sb);
    const provider = createProvider(cfg.activeProvider);
    const model = await resolveModel(sb, cfg.activeProvider, cfg.activeModel);
    const res = await provider.extractEvidence({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: prompt,
      content: { kind: 'text', text: prompt, meta: { ocrUsed: false, truncated: false, originalChars: prompt.length } },
      model: model.id,
      maxOutputTokens: 500,
    });
    const raw = typeof res.raw === 'string' ? res.raw : JSON.stringify(res.raw);
    const clean = raw.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    try { return JSON.parse(clean); } catch { return JSON.parse(clean.replace(/,([\s]*[}\]])/g, '$1')); }
  } catch (err) {
    console.warn('[AI Stage] Provider layer failed, falling back to Gemini:', err instanceof Error ? err.message : err);
  }

  // Legacy Gemini fallback
  const ai = getAiProvider();
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const text = await ai.generateContent(modelName, prompt, {
        responseMimeType: 'application/json',
        temperature: TEMPERATURE,
      });
      const cleanText = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      try {
        return JSON.parse(cleanText);
      } catch {
        return JSON.parse(cleanText.replace(/,("?\s*[}\]])/g, '$1'));
      }
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  console.error('[AI Stage] All retries exhausted:', lastError);
  return { determined_stage: null, stage_rationale: '', recommended_services: [] };
}

/**
 * Upload a buffer to the Gemini Files API and wait until it is ACTIVE and can
 * be referenced in a prompt. Returns the fileData reference.
 */
async function uploadToGeminiFiles(buffer: Buffer, mimeType: string, displayName: string): Promise<{ fileUri: string; mimeType: string; geminiFileName: string }> {
  const { GoogleAIFileManager } = await import('@google/generative-ai/server');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');

  const fileManager = new GoogleAIFileManager(apiKey);
  const safeName = (displayName || 'document').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'document';
  const tempPath = path.join(os.tmpdir(), `gemini-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`);

  await writeFile(tempPath, buffer);
  try {
    const uploadResponse = await fileManager.uploadFile(tempPath, { mimeType, displayName: safeName });
    const fileName = uploadResponse.file.name;

    let file = await fileManager.getFile(fileName);
    let attempts = 0;
    while (String(file.state) === 'PROCESSING' && attempts < 20) {
      await new Promise(r => setTimeout(r, 3000));
      file = await fileManager.getFile(fileName);
      attempts++;
    }
    if (String(file.state) !== 'ACTIVE') {
      throw new Error(`Gemini could not process "${safeName}" (state: ${String(file.state)})`);
    }

    return { fileUri: uploadResponse.file.uri, mimeType: uploadResponse.file.mimeType, geminiFileName: fileName };
  } finally {
    await rm(tempPath, { force: true }).catch(() => {});
  }
}

async function deleteGeminiFile(fileName: string): Promise<void> {
  try {
    const { GoogleAIFileManager } = await import('@google/generative-ai/server');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return;
    await new GoogleAIFileManager(apiKey).deleteFile(fileName);
  } catch (err) {
    console.warn('[AI] Gemini file cleanup failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * Extract readable text from Office/CSV attachments that Gemini cannot read
 * natively. Returns null when the format has no extractor (GIF, legacy .doc,
 * PowerPoint) — those are flagged as unreadable instead.
 */
async function extractDocumentText(buffer: Buffer, mime: string): Promise<string | null> {
  if (mime === 'text/csv') {
    return buffer.toString('utf8').slice(0, MAX_TEXT_PER_DOC);
  }
  if (mime === 'application/vnd.ms-excel' || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheets = workbook.SheetNames.slice(0, MAX_SHEETS);
      const parts = sheets.map((name) => `--- Sheet: ${name} ---\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`);
      return parts.join('\n').slice(0, MAX_TEXT_PER_DOC);
    } catch (err) {
      console.warn('[AI] Excel text extraction failed:', err instanceof Error ? err.message : err);
      return null;
    }
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return (result.value || '').slice(0, MAX_TEXT_PER_DOC);
    } catch (err) {
      console.warn('[AI] DOCX text extraction failed:', err instanceof Error ? err.message : err);
      return null;
    }
  }
  return null;
}

/**
 * Human label for a document (document_type if set, else the storage filename).
 */
function documentLabel(doc: ProjectAnalysisDocument): string {
  if (doc.document_type) return doc.document_type.replace(/_/g, ' ');
  const fileName = doc.storage_path.split('/').pop() ?? '';
  return fileName.replace(/^\d+_/, '') || doc.storage_path;
}

/**
 * Run the full AI analysis: downloads every project document, reads each one
 * (natively for PDF/images, via text extraction for Excel/Word/CSV, flagging
 * unreadable formats), and produces scores, the project stage, and a
 * per-document integrity review.
 */
export async function runProjectAnalysis(
  projectId: string,
  documents: ProjectAnalysisDocument[] | string[],
  context?: ProjectAnalysisContext | null
) {
  const storage = getStorageProvider();

  const docList: ProjectAnalysisDocument[] = (Array.isArray(documents) && typeof documents[0] === 'string')
    ? (documents as string[]).map((p) => ({ storage_path: p }))
    : documents as ProjectAnalysisDocument[];

  const nativeParts: PreparedNativeDoc[] = [];
  const textDocs: PreparedTextDoc[] = [];
  const unreadable: string[] = [];

  for (const doc of docList) {
    if (!doc.storage_path.startsWith(`${projectId}/`)) continue;
    let buffer: Buffer;
    try {
      buffer = await storage.download('project-documents', doc.storage_path);
    } catch (err) {
      console.warn(`[AI] Could not download ${doc.storage_path}:`, err instanceof Error ? err.message : err);
      unreadable.push(`${documentLabel(doc)} (download failed)`);
      continue;
    }

    const mime = doc.mime_type || mimeFromFileName(doc.storage_path) || 'application/pdf';
    const label = documentLabel(doc);

    if (GEMINI_NATIVE_MIMES.has(mime)) {
      try {
        const uploaded = await uploadToGeminiFiles(buffer, mime, label);
        nativeParts.push({ name: label, fileUri: uploaded.fileUri, mimeType: uploaded.mimeType, geminiFileName: uploaded.geminiFileName });
      } catch (err) {
        console.warn(`[AI] Gemini upload failed for ${label}:`, err instanceof Error ? err.message : err);
        unreadable.push(`${label} (could not be processed by the AI service)`);
      }
      continue;
    }

    const text = await extractDocumentText(buffer, mime);
    if (text && text.trim().length > 0) {
      textDocs.push({ name: label, text });
    } else {
      unreadable.push(`${label} (format not readable: ${mime})`);
    }
  }

  const totalReadable = nativeParts.length + textDocs.length;
  if (totalReadable === 0) throw new Error('No documents could be loaded for analysis');

  const parts: AiContentPart[] = [
    ...nativeParts.map((p) => ({ fileData: { mimeType: p.mimeType, fileUri: p.fileUri } })),
    ...textDocs.map((d) => ({ text: `--- DOCUMENT: ${d.name} (TEXT EXTRACT) ---\n${d.text}` })),
  ];

  const unreadableNote = unreadable.length > 0
    ? `\n\nNOTE — these files could not be parsed automatically; record an entry for each in document_analysis with content_summary "File could not be parsed automatically" and mark relevance LOW unless other evidence supports them:\n${unreadable.map((u) => `  - ${u}`).join('\n')}`
    : '';

  const ai = getAiProvider();
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const prompt = buildPrompt(context ?? null, docList) + unreadableNote;

  let lastError: unknown;
  try {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const text = await ai.generateContentWithFiles(modelName, prompt, parts, {
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
          const cleaned = cleanText.replace(/,(\s*[}\]])/g, '$1');
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
  } finally {
    await Promise.all(nativeParts.map((p) => deleteGeminiFile(p.geminiFileName)));
  }

  console.error('[AI Analysis] All retries exhausted:', lastError);
  return FALLBACK_SCORE;
}

import { EVIDENCE_KEYS } from './types';

const OUTPUT_SHAPE = {
  document_type: 'land_title | lease_agreement | feasibility_study | financial_model | eia_esia | regulatory_permit | ppa | term_sheet | financing_agreement | grid_application | technical_report | pitch_deck | other',
  authenticity: {
    assessment: 'authentic | likely_authentic | uncertain | suspicious',
    notes: 'brief justification (max 200 chars)',
  },
  project_identity: {
    project_name: 'the project title EXACTLY as written in this document (null if none appears)',
    capacity_mw: 'the installed capacity in MW stated in this document (null if none)',
    location: 'the site location (district/country) named in this document (null if none)',
    parties: ['every party named in this document: developer, SPV, offtaker, lender, authority'],
  },
  relevance: {
    level: 'HIGH | MEDIUM | LOW — how relevant the CONTENT is to an energy infrastructure project',
    belongs_to_project: 'true ONLY on positive identity: the document names the project, or the developer/SPV as a party, or states a capacity AND location that both match the profile. Generic energy content without project identity is FALSE.',
    contradicts_project: 'true when the document names a DIFFERENT project/company/location or a materially different capacity than the profile',
    reason: 'your verdict, quoting the document\'s own words (title block, party clauses, capacity statements)',
  },
  evidence: [
    {
      key: '<one of the allowed keys listed below>',
      value: 'boolean | string | number',
      confidence: '0.0–1.0 per the CALIBRATION RUBRIC below',
      excerpt: 'verbatim quote from the document supporting a boolean=true claim',
    },
  ],
  key_findings: [
    'concrete fact or figure extracted from the document (e.g. "Land title registered to Acme Energy Ltd, plot 4521, Lusaka, dated 12 March 2023")',
  ],
  risk_flags: [
    { severity: 'low | medium | high', flag: 'short identifier', detail: 'explanation' },
  ],
  summary: '3–5 sentences: what this document is, what it proves, what is missing or concerning, and how it affects the project\'s readiness stage',
};

/**
 * The milestone a document can actually prove, mapped to the evidence keys it
 * may set to true. Anything else this document does not contain must stay
 * false/absent — this is the primary defence against the classic LLM failure of
 * marking every key true because the document "looks project-related".
 */
const KEY_DEFINITIONS: { key: string; milestone: string; proves: string[] }[] = [
  {
    key: 'land_secured',
    milestone: 'Site control: the project company holds or has a binding right to the land',
    proves: ['land title deed naming the project company or its SPV', 'lease agreement signed by the registered landowner', 'offer-to-lease/letter of intent for a specific plot is NOT sufficient — use only if signed by both parties'],
  },
  {
    key: 'site_lease',
    milestone: 'A lease over the project site exists (alias of land_secured — report whichever applies, not both)',
    proves: ['lease agreement with parties, plot reference and duration'],
  },
  {
    key: 'pre_feasibility',
    milestone: 'An initial resource/technical assessment exists',
    proves: ['a document identifying itself as a pre-feasibility or resource assessment study', 'resource measurement data with a named site and measurement period'],
  },
  {
    key: 'full_feasibility',
    milestone: 'A BANKABLE feasibility study: technical design + financial analysis + economic viability conclusion',
    proves: ['document titled/structured as a full feasibility study', 'energy yield or production estimate', 'CAPEX/OPEX estimates', 'financial indicators (IRR, NPV, payback) or an explicitly bankability-focused conclusion', 'a technology note with a site map alone is NOT a feasibility study'],
  },
  {
    key: 'financial_model',
    milestone: 'A quantitative financial model or structured financial analysis of the project',
    proves: ['spreadsheet/tables with revenue, cost, debt/equity assumptions', 'a financial model summary with stated assumptions and outputs'],
  },
  {
    key: 'eia_completed',
    milestone: 'An Environmental (and Social) Impact Assessment has been PREPARED and SUBMITTED',
    proves: ['a full ESIA/EIA report or its non-technical summary', 'a submission/acknowledgement receipt from the authority', 'a TOR or scoping report alone is NOT eia_completed'],
  },
  {
    key: 'eia_approved',
    milestone: 'The environmental assessment has been APPROVED by the regulator',
    proves: ['a decision letter/certificate from ZEMA or the national EPA explicitly granting approval', 'an acknowledgement letter is NOT an approval'],
  },
  {
    key: 'generation_licence',
    milestone: 'A generation licence has been ISSUED by the energy regulator',
    proves: ['a licence document or issuance letter from ERB/the regulator with licence number', 'an application acknowledgement is NOT a licence'],
  },
  {
    key: 'grid_application_submitted',
    milestone: 'A grid-connection application has been filed with the TSO/utility',
    proves: ['an application form or submission receipt from ZESCO/the TSO'],
  },
  {
    key: 'grid_connection_agreement',
    milestone: 'A grid-connection agreement has been EXECUTED with the TSO/utility',
    proves: ['a signed connection agreement with parties and connection point', 'a feasibility/offer letter from the utility is NOT an executed agreement'],
  },
  {
    key: 'ppa_under_negotiation',
    milestone: 'PPA discussions are documented (term sheet, heads of terms, draft under review)',
    proves: ['a PPA term sheet or heads of terms', 'correspondence showing active negotiation of a draft PPA'],
  },
  {
    key: 'ppa_signed',
    milestone: 'A Power Purchase Agreement has been EXECUTED by offtaker and seller',
    proves: ['the signed PPA itself (signature blocks present, parties named)', 'a draft, unsigned PPA or term sheet is ppa_under_negotiation, NOT ppa_signed'],
  },
  {
    key: 'financing_term_sheet',
    milestone: 'Lenders/investors have issued a term sheet or letter of intent to finance',
    proves: ['a debt/equity term sheet naming amounts and conditions', 'a generic investor deck is NOT a term sheet'],
  },
  {
    key: 'financial_close',
    milestone: 'Financing documents have been EXECUTED and conditions precedent satisfied',
    proves: ['signed loan/finance agreements', 'a financial-close statement or board/lender approval evidencing execution', 'a term sheet is NOT financial close'],
  },
  {
    key: 'construction_started',
    milestone: 'Physical construction has commenced',
    proves: ['a signed EPC/EPCM contract with notice to proceed', 'construction progress reports with dated site evidence', 'a contract without NTP/mobilisation evidence shows contract award, not started works — report it and say so'],
  },
  {
    key: 'commercial_operation',
    milestone: 'The plant has been commissioned and is in commercial operation',
    proves: ['commissioning certificate or take-over certificate', 'operational performance reports', 'commercial operation date (COD) declaration'],
  },
  {
    key: 'permits_general',
    milestone: 'Other permits/consents beyond EIA and generation licence',
    proves: ['water rights, land-use conversion, building/construction permits, aviation clearance etc., issued by a competent authority'],
  },
];

export const SYSTEM_PROMPT = `You are an evidence-extraction engine for renewable energy project documents (Zambia first: ZEMA, ERB, ZESCO are the key regulatory authorities).
You receive ONE document (extracted text, or images of scanned pages). Extract ONLY what this document itself supports. Never infer from plausibility.

Output ONLY a JSON object with exactly this shape:
${JSON.stringify(OUTPUT_SHAPE, null, 1)}

PROJECT IDENTITY VERIFICATION (fill project_identity and relevance for EVERY document — the user prompt carries the developer's PROJECT PROFILE to check against):
- Read the document's own title block, preamble, party clauses and technical tables. Report project_name, capacity_mw, location and parties EXACTLY as this document states them — never copy the profile values into these fields.
- belongs_to_project is TRUE only on positive identity: the document names the project, or names the developer/SPV as a party, or states a capacity AND location that both match the profile. A well-written energy document about some OTHER project is NOT evidence for this project.
- contradicts_project is TRUE when the document names a different project or company, or a capacity differing from the profile by more than ~30%, or a site in a different country. This does not mean the document is fake — it means it belongs in a different project's data room.
- A document with no project identity at all (blank template, generic guidance, unrelated content) has belongs_to_project FALSE — say so plainly in reason.
- The system EXCLUDES documents that fail this check from scoring regardless of their content quality. In summary, state what the document actually belongs to.

Allowed evidence keys, what each milestone REQUIRES, and what actually proves it:
${KEY_DEFINITIONS.map((k) => `- ${k.key}: ${k.milestone}. Proves: ${k.proves.join('; ')}.`).join('\n')}

EVIDENCE DISCIPLINE (the most important rules):
- A key may be true ONLY if this document contains the proof listed for it. A document about a project does not make its claims true.
- A key may be reported ONLY when the document BELONGS to the project (relevance.belongs_to_project true). If the document is about a different project, report NO evidence items for it — its facts are another project's facts.
- If the document merely references a milestone ("as per our feasibility study..."), the milestone is NOT proven by THIS document — do not report it, or report it at confidence <= 0.5 with the reference quoted.
- A draft, unsigned, or application-stage document proves the LOWER tier, never the higher one (application ≠ approval, draft PPA ≠ signed PPA, term sheet ≠ financial close).
- Every evidence item with value=true MUST include a verbatim excerpt from the document. No excerpt → do not report the item.
- Absence of evidence is a finding: if the document is the kind that WOULD prove a key but the specific detail is missing (e.g. no signature page), say so in summary and consider a risk_flag.

CONFIDENCE CALIBRATION (use the exact bands):
- 0.95–1.0: the proof is explicit in this document — you can quote the exact sentence (title, signature block, licence number, decision clause).
- 0.80–0.94: the proof is clearly present but with a minor gap (legible but unauthenticated scan, missing annex referenced by title).
- 0.70–0.79: strongly implied by this document's content but not stated outright.
- 0.60–0.69: the document references or partially supports the milestone (e.g. mentions an approval by number without attaching it). The scoring engine DISCOUNTS or DISCARDS values below 0.70 — anything you report here will not advance a stage on its own.
- below 0.60: do NOT report the item at all.
- NEVER inflate confidence to be helpful. A false positive costs a reviewer far more than a missed signal.

key_findings: list 3–6 concrete, specific facts found in the document — names, dates, amounts, capacities, parties, reference numbers. Do NOT repeat the summary.

summary: write 3–5 sentences. State what the document is, name the key parties and dates if present, explain what development milestone it proves, note any gaps or concerns, and state whether it advances or does not advance the project stage.

risk_flags: ALWAYS check for and report — (a) the document is not what its label says; (b) milestone references without attached proof; (c) inconsistencies with the project details provided (names, capacities, dates, parties); (d) signs of template/generic content with no project-specific data; (e) missing signature pages or decision clauses where they should exist.

If the document is not what its label/category suggests, set document_type to what it actually is and explain in authenticity.notes.
Do not fabricate keys outside the allowed list.
Valid JSON only — no prose, no markdown fences.`;

/**
 * The developer-facing facts a document must agree with to count as evidence.
 * Rendered into every extraction prompt so the model can perform the
 * document↔project identity check itself (the code enforces its verdict).
 */
export interface ProjectProfile {
  name: string;
  developer?: string | null;
  technology?: string | null;
  capacityMW?: number | null;
  location?: string | null;
}

export function buildProjectProfileBlock(profile: ProjectProfile): string {
  return [
    'PROJECT PROFILE — the project this document was uploaded to. Verify the document against it (project_identity + relevance):',
    `- Project name: ${profile.name || '(not provided)'}`,
    profile.developer ? `- Developer / SPV: ${profile.developer}` : null,
    profile.technology ? `- Technology: ${profile.technology}` : null,
    profile.capacityMW != null ? `- Installed capacity: ${profile.capacityMW} MW` : null,
    profile.location ? `- Location: ${profile.location}` : null,
    'A document qualifies as evidence for THIS project only on positive identity (names the project/developer, or capacity AND location both match). Generic energy documents and documents about other projects do NOT qualify.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * A stable fingerprint of the profile fields that shape the extraction prompt.
 * Folded into the per-document evidence cache key so that editing a project's
 * capacity/name/location — which changes whether a document "belongs" to the
 * project — invalidates cached extractions for files whose bytes never changed.
 */
export function projectProfileKey(profile: ProjectProfile): string {
  return [
    profile.name ?? '',
    profile.developer ?? '',
    profile.technology ?? '',
    profile.capacityMW == null ? '' : String(profile.capacityMW),
    profile.location ?? '',
  ].join('\u0000');
}

export function buildUserPrompt(
  doc: { name: string; category: string },
  extra?: string,
  profile?: ProjectProfile,
): string {
  return [
    `Document name: "${doc.name}"`,
    `Expected category (may be wrong — verify): ${doc.category}`,
    profile ? buildProjectProfileBlock(profile) : '',
    extra ?? '',
    'Extract evidence as JSON.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Hard cap on how many characters of context survive into the preview prompt.
 * Very large forms were previously serialised whole, pushing the calibration
 * rules out of the model's effective attention window.
 */
const PREVIEW_FORM_CONTEXT_MAX_CHARS = 12_000;

function compactFormForPrompt(form: Record<string, unknown>): string {
  const json = JSON.stringify(form);
  if (json.length <= PREVIEW_FORM_CONTEXT_MAX_CHARS) return json;
  // Deterministic truncation: keep the head (identity, stage-relevant claims)
  // and tail (targets, requirements) and say explicitly that content was cut.
  const head = json.slice(0, PREVIEW_FORM_CONTEXT_MAX_CHARS * 0.7);
  const tail = json.slice(-PREVIEW_FORM_CONTEXT_MAX_CHARS * 0.25);
  return `${head}\n...[form data truncated for length: ${json.length} chars total]...\n${tail}`;
}

export function buildPreviewPrompt(form: Record<string, unknown>): string {
  return [
    'The following is SELF-REPORTED project form data. NO documents exist yet — nothing here has been verified.',
    '',
    'Allowed evidence keys and their milestones:',
    KEY_DEFINITIONS.map((k) => `- ${k.key}: ${k.milestone}`).join('\n'),
    '',
    'MAPPING RULES (conservative — a wrong high estimate costs the developer later):',
    '- Map each form claim to the closest allowed evidence key. Do NOT invent keys.',
    '- A claim that a milestone was reached (e.g. "PPA secured: yes") is a CLAIM, not evidence. Report it at confidence <= 0.5 so the engine treats it as discounted self-reporting.',
    '- Status fields map by their stage, not their ambition: "application submitted" → the *_submitted key only; "under negotiation" → ppa_under_negotiation; "signed/agreed" → still at most 0.5 because the document is unverified.',
    '- Ambiguous or absent claims → simply omit the key. Omission is the correct answer for unknowns.',
    '- If two claims conflict (e.g. stage 8 claimed but no operation date), report a risk_flag with severity high.',
    '',
    'Confidence bands: 0.5 = any self-reported milestone claim; 0.4 = claim with supporting detail but unverifiable; <= 0.3 = vague or second-hand. Never exceed 0.5 for self-reported data.',
    '',
    'List risk_flags for inconsistencies, implausible claims, or claims whose supporting fields are empty.',
    'Summarize the project in 2–4 sentences, stating explicitly that all claims are self-reported and unverified.',
    '',
    `Form data: ${compactFormForPrompt(form)}`,
    '',
    'Extract evidence as JSON.',
  ].join('\n');
}

/* ────────────────────────────────────────────────────────────────────────────
 * Rating explanations.
 *
 * A readiness rating is only defensible if it can be explained line by line, and
 * the explanation must not become a second, vaguer opinion. So this prompt runs
 * AFTER scoring and is handed the engine's own ledger: every pillar, and inside
 * it every milestone with the points it did or didn't win. The model is asked to
 * phrase that ledger, not to judge it — it has no field in which to state a
 * number (see ratingInsightSchema), so an explanation cannot disagree with the
 * rating it explains.
 * ──────────────────────────────────────────────────────────────────────────── */

const INSIGHT_OUTPUT_SHAPE = {
  brief: '4 short paragraphs of plain prose (see BRIEF below).',
  strengths: ['what is genuinely proven and working'],
  weaknesses: ['what is weak, unsupported or missing'],
  overall: '1–2 sentences: what pushes the readiness score up and what holds it down.',
  pillars: [
    { key: 'pillar key, copied exactly from the request', why: 'one sentence on why this pillar holds this rating' },
  ],
  evidence: [
    { key: 'evidence key, copied exactly from the request', why: 'one sentence on what this milestone did for the score' },
  ],
  stage: '1–2 sentences: why the project sits at this stage, and the single thing that would move it up.',
  next_steps: ['at most 3 concrete actions, each naming the specific document or approval needed'],
};

/** Human phrasing for each ledger status, so the model never has to decode one. */
const CONTRIBUTION_STATUS_TEXT: Record<string, string> = {
  documented: 'PROVEN by a document',
  self_reported: 'self-reported by the developer, no document proves it',
  contested: 'CONTESTED — documents disagree, needs a reviewer',
  weak_evidence: 'evidence too weak to count (below the confidence threshold)',
  absent: 'not proven',
};

export interface RatingInsightInput {
  project: { name: string; technology?: string | null; capacityMW?: number | null; location?: string | null };
  /** Headline readiness score as computed by the engine. */
  score: number;
  maxScore: number;
  stage: number;
  stageLabel: string;
  /** The engine's ledger: each pillar and every milestone inside it. */
  ledger: {
    key: string;
    label: string;
    earned: number;
    max: number;
    contributions: {
      key: string;
      label: string;
      points: number;
      maxPoints: number;
      status: string;
      source: string | null;
      confidence: number;
      excerpt?: string;
    }[];
  }[];
  /** Unmet requirements for the next stage — what would advance the project. */
  blocking: { key: string; label: string }[];
  /** Coverage problems that change how much weight the score deserves. */
  caveats?: string[];
  /**
   * What the project's own documents are about — technology, capacity, location,
   * the developer, the counterparties named in the paperwork. The brief narrates
   * this, so it is gathered from the same structured extraction.
   */
  documentDigests?: {
    label: string;
    type: string;
    summary: string;
    findings: string[];
    integrity: string;
  }[];
  /** Headline facts about the project, for the brief's opening paragraph. */
  projectFacts?: string[];
}

export const RATING_INSIGHT_SYSTEM_PROMPT = `You explain readiness ratings for renewable energy projects. The ratings are ALREADY FINAL — a deterministic engine computed them from document evidence. Your only job is to say, in plain language, WHY each number is what it is.

Output ONLY a JSON object with exactly this shape:
${JSON.stringify(INSIGHT_OUTPUT_SHAPE, null, 1)}

STRENGTHS AND WEAKNESSES are the honest two-sided read of the ledger, split by sign rather than by section:
- strengths: at most 5. Only milestones that actually won points. Name the milestone and what it proves. If a pillar is fully proven, that is a strength.
- weaknesses: at most 5. Only milestones that lost points or sit unresolved. Name what is missing or unreliable. Order by how many points are at stake.
- A strength must be backed by an excerpt in the ledger. A weakness may be an absence ("no signed grid connection agreement") — an absence is a real finding.
- Never pad these lists. Three genuine strengths beat five thin ones, and an empty list is better than an invented one.

THE BRIEF is the one field that is NOT a grid cell. It is read top to bottom as prose by a developer who wants to understand their project. Write it as four short paragraphs, separated by a blank line, in this order:

1. WHAT THIS PROJECT IS AND HOW FAR ALONG IT IS. The technology, capacity and location if given, the stage it sits at, and the headline readiness in plain terms. Two or three sentences.
2. WHAT THE DOCUMENTARY EVIDENCE SHOWS. Walk the pillars that actually earned points, naming the specific milestone that proved each one and, where the digests give one, the document it came from. This is the paragraph a developer reads to check whether the AI saw their real documents. Three or four sentences.
3. WHAT IS HOLDING IT BACK. The gaps that cost the most points, the milestone blocking the next stage, and anything the caveats warn limits the score. Three or four sentences.
4. WHAT TO DO NEXT. The highest-value action first, grounded in a named document or approval. Two or three sentences.

RULES FOR THE BRIEF:
- Write flowing prose. No headings, no bullet characters, no numbered lists, no markdown, no emoji, no quotation marks.
- It may name scores and stages in words, since it explains the whole picture rather than sitting beside a single number. Never do arithmetic or recompute anything.
- Never describe a document you were not shown. If no excerpt backs a claim, say the proof is missing.
- No praise, no reassurance, no marketing tone, and no advice beyond what the next steps already say. Report.

HOW TO WRITE EVERY OTHER FIELD:
- BE BRIEF. One short sentence per item. Never more than 25 words. These are read in a grid, not studied.
- STRAIGHT TO THE POINT. No preamble, no headings, no markdown, no bullet characters, no emoji, no quotation marks around your text.
- DO NOT RESTATE THE NUMBER. Never write "this pillar scored 14 out of 20" or "you scored 42%". Say what earned the points and what did not — the number is already on screen.
- NO HEDGING OR SOFTENING. Not "it appears the EIA may be in progress". Say it plainly: the EIA is approved / not approved.
- NO PRAISE, REASSURANCE OR ADVICE. Do not congratulate, do not explain what the rating means in general, do not tell the reader what to feel. Explain THIS project's rating only.
- NEVER INVENT EVIDENCE. Every statement must be grounded in the ledger and the excerpts given to you. If a milestone has no excerpt, the proof is missing — say it is missing, never describe a document you were not shown.
- RESPECT THE STATUS. A milestone marked "self-reported" is a claim, not proof. A milestone marked "CONTESTED" is unresolved. A milestone marked "evidence too weak" was seen but not trusted. Never describe any of these as achieved.

REQUIRED COVERAGE:
- brief: all four paragraphs, every time. This is the section the reader looks at first.
- strengths and weaknesses: draw only from the ledger. If a pillar earned full points it belongs in strengths; if it earned none, the missing milestone belongs in weaknesses.
- pillars: one entry for EVERY pillar in the request, including any pillar that scored zero. Zero-rated pillars are the most useful ones to explain — say which specific document or approval is missing.
- evidence: one entry for each evidence key listed in the request. Keep it to the keys that actually decided the score.
- overall: lead with the single biggest driver of the score, then the biggest thing holding it back.
- stage: state why the project is NOT one stage further along, naming the blocking milestone.
- next_steps: at most 3, most valuable first, each naming the exact document or approval to obtain.

Copy every key EXACTLY as given. Do not invent keys, and do not merge two keys into one entry.
Valid JSON only — no prose, no markdown fences.`;

function ledgerLine(
  c: RatingInsightInput['ledger'][number]['contributions'][number],
): string {
  const status = CONTRIBUTION_STATUS_TEXT[c.status] ?? c.status;
  const earned = c.points > 0
    ? `+${c.points}/${c.maxPoints}`
    : `0/${c.maxPoints}`;
  const excerpt = c.excerpt ? ` | proof: "${c.excerpt}"` : '';
  return `    - ${c.key} (${c.label}): ${earned} — ${status}${excerpt}`;
}

export function buildRatingInsightPrompt(input: RatingInsightInput): string {
  const pillarBlocks = input.ledger.map((p) => {
    const lines = p.contributions.map(ledgerLine).join('\n');
    return `  ${p.key} — ${p.label}: ${p.earned}/${p.max}\n${lines}`;
  });

  const facts = [
    input.project.technology ? `Technology: ${input.project.technology}` : null,
    input.project.capacityMW != null ? `Capacity: ${input.project.capacityMW} MW` : null,
    input.project.location ? `Location: ${input.project.location}` : null,
  ].filter(Boolean).join(' · ');

  return [
    `PROJECT: ${input.project.name}${facts ? ` (${facts})` : ''}`,
    `READINESS SCORE (already computed, do not recalculate): ${input.score}/${input.maxScore}`,
    `STAGE (already determined): ${input.stage} — ${input.stageLabel}`,
    '',
    'SCORE LEDGER — every pillar and every milestone inside it. `+n/max` is the points that milestone won; `0/max` is what it failed to win.',
    pillarBlocks.join('\n'),
    '',
    'BLOCKING THE NEXT STAGE (these milestones are not proven):',
    input.blocking.length > 0
      ? input.blocking.map((b) => `  - ${b.key} (${b.label})`).join('\n')
      : '  - none',
    ...(input.projectFacts?.length
      ? ['', 'PROJECT FACTS:', ...input.projectFacts.map((f) => `  - ${f}`)]
      : []),
    ...(input.documentDigests?.length
      ? [
          '',
          'WHAT EACH DOCUMENT SAYS — use this for the evidence paragraph of the brief, and name the document when you cite it:',
          ...input.documentDigests.map((d) => {
            const bits = [
              `  - ${d.label}${d.type ? ` (${d.type})` : ''}${d.integrity ? ` [integrity: ${d.integrity}]` : ''}`,
              d.summary ? `      says: ${d.summary}` : null,
              ...d.findings.slice(0, 6).map((f) => `      found: ${f}`),
            ].filter(Boolean);
            return bits.join('\n');
          }),
        ]
      : []),
    ...(input.caveats?.length
      ? ['', 'CAVEATS — these limit how much the score can be trusted:', ...input.caveats.map((c) => `  - ${c}`)]
      : []),
    '',
    'Write the brief as prose, then one short direct sentence per pillar and per evidence key.',
  ].join('\n');
}

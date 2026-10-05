# Readiness ↔ Stage Consistency — Review & Plan

**Status:** structural fixes implemented (see §D). Historic data reconciliation and the
band-ceiling sign-off are outstanding.
**Trigger:** a project reported at **Concept** showed **57/100 readiness** with pillars
**Regulatory 14/40 · Financial 8/35 · Developer 10/25** (14 + 8 + 10 = **32**, not 57).

---

## A. What was wrong

### A1. The total was never derived from its parts
`api/projects/[id]/analyze/route.ts` persisted the LLM's asserted `total_score` verbatim
(only falling back to the sub-score sum when the model returned none). Nothing checked that
the two agreed, and the prompt asked for both — a reliable way to get arithmetic that does
not add up. **57 against 14 + 8 + 10 is that failure, not rounding.**

The only other writer of the column was the manual override, which *did* sum — so two paths
already disagreed about what `capital_readiness_score` means.

### A2. Four competing readiness models wrote into one row
| Model | Where | Shape |
|---|---|---|
| Evidence engine (`SCORING_V2`) | `lib/scoring/engine.ts` (preview + orchestrator) | Land 10 · Technical 20 · Regulatory 20 · Grid 15 · Financial 20 · Construction 15 |
| Legacy one-shot LLM | `lib/ai-analysis.ts` + analyze route | Regulatory 40 · Financial 35 · Developer 25 **+ asserted total** |
| Gap engine | `lib/gap-analysis.ts` (`overallReadiness`) | complete requirements ÷ 17 rules |
| Historical/plan variants | `plans/phase4_ai_scoring_engine.md`, `lib/scoring.ts.bak` | 20/20/20/15/15/10 |

All four surfaced in the product under the single word **"Readiness"**.

### A3. The Land pillar was written and rendered as "Developer"
`lib/ai/orchestrator.ts` persisted `developer_score` from the **land** pillar, and
`components/developer/AiInsightsPanel.tsx` mapped `land → developer` for display, against a
hardcoded maximum of 25. That is literally where "Developer 10/25" came from: land control
out of 10, labelled as developer strength. The panel also hardcoded 40/35/25 regardless of
which engine produced the numbers.

The orchestrator additionally wrote `projects.readiness_score` — a column that exists in no
migration in this repo — with the error unchecked, and never wrote
`breakdown.regulatory/financial/developer`, so the "Score Dimensions" card silently vanished
on the evidence path.

### A4. Stage and score used different epistemologies
Stage is evidence-gated (documents only). The legacy score was claim-based: it weighted
site rights, feasibility and PPA straight off the form. Hence a Concept project showing 35 %
regulatory readiness because a checkbox was ticked. Nothing anywhere required the two numbers
to agree — no per-stage score ceiling, no shared vocabulary.

### A5. Stage was defined in five places
`lib/project-stages.ts`, `STAGE_GATES` in `engine.ts`, `STAGE_NUMBER` in
`lib/matching-engine.ts`, `STAGE_ORDER`/`STAGE_COLORS` in two pages, and an inline
`['CONCEPT', …][scored.stage - 1]` array in the orchestrator. `projects.project_stage` was
written by the preview, the analyze route, the orchestrator and the submit default, last
writer wins, with no provenance.

### A6. Downstream consumers read 0–20 values as 0–100
`lib/matching-engine.ts` compared `regulatory_score` against 75/55/45 and blended it with
`documentation_score`/`governance_score`/`financial_transparency_score` — columns neither
engine ever wrote. CONSULTANT/TECHNICAL readiness therefore collapsed to `0.15 × regulatory`.

---

## B. The invariants now enforced

1. **One engine.** `SCORING_V2` is the only readiness model. Its pillar metadata
   (`PILLAR_META`/`PILLAR_MAXIMA`) is the single definition of what each dimension is
   measured out of.
2. **Derived totals.** `score === Σ(pillars)`, computed by `deriveTotal()`; `verifyScoreInvariant()`
   must return null before a score is persisted. Nothing accepts a total from the AI.
3. **Stage and score share their evidence.** Both come from the same resolved-evidence map, so
   the stage gate and the score cannot be computed from different facts.
4. **Every stage has a band.** `STAGE_SCORE_BANDS` states the floor the stage position proves
   and the ceiling it can support; `evaluateStageConsistency()` reports a violation instead of
   hiding it.
5. **One taxonomy.** Stage numbers, labels, gates and bands live in `lib/project-stages.ts`.
6. **Provenance is visible.** Scores carry `breakdown.readiness` (model, version, band,
   consistency) and the UI states whether a score is evidence-scored or AI-assessed.
7. **Overrides are validated.** Dimension edits are checked against the maxima the stored score
   was actually measured with; a non-numeric or out-of-range value is rejected with 422.

---

## C. Stage bands (derived, reviewable)

| Stage | Band | Basis |
|---|---|---|
| Concept | 0–44 | Land control not documented |
| Pre-Feasibility | 10–54 | Land proven, feasibility outstanding |
| Full Feasibility | 30–66 | Bankable study proven, approvals outstanding |
| Regulatory Approval | 38–74 | EIA clearance proven, approval/licence outstanding |
| PPA Ready | 50–86 | Approvals + licence proven, offtake outstanding |
| Financial Close | 58–91 | PPA signed, financial close outstanding |
| Construction | 62–95 | Financial close proven, operating evidence outstanding |
| Operation | 77–100 | Full evidence set attainable |

Floors are the cumulative evidence each gate proves. Ceilings are 100 minus the points
unreachable while the later gates are unproven (a tier group forfeits only the gap between its
highest tier and the best tier still attainable). **Neither is invented**: `deriveStageCeilings()`
recomputes the ceilings from the pillar rules and gates, and
`lib/__tests__/readiness-consistency.test.ts` asserts the table still matches — change a rule
point and the test fails until the band is updated deliberately.

The floors still need a domain review; the ceilings are arithmetic.

---

## D. Implemented

| Area | Change |
|---|---|
| `lib/scoring/engine.ts` | `SCORING_VERSION` 3; `PILLAR_META`/`PILLAR_MAXIMA`; `deriveTotal()`; `verifyScoreInvariant()`; pillar earns capped at their max; `normalizeBreakdown()`; `dimensionMaximaFromBreakdown()`; `deriveStageCeilings()`; `stageBand()`; results now carry `stageValue`, `band`, `consistency`, `derivedTotal`, `consistent`, `maxScore`; gate labels come from the taxonomy |
| `lib/project-stages.ts` | `STAGE_SCORE_BANDS`, `evaluateStageConsistency()`, `stageNumberFromEnum()`, documented derivation |
| `api/projects/[id]/analyze/route.ts` | Total **derived** from normalised sub-scores; the AI's asserted total is logged, never persisted; stage-band check adds a HIGH risk flag on mismatch; `breakdown.readiness` provenance; summary states the band |
| `lib/ai/orchestrator.ts` | Land no longer written as `developer_score` (`scalarColumns()` maps only genuine pillars); writes `breakdown.readiness`; risk flag on stage mismatch; `determined_stage` taken from the taxonomy instead of an inline enum array; removed the write to the non-existent `projects.readiness_score`; invariant verified before persisting |
| `api/projects/[id]/route.ts` | Score overrides validated against the maxima the row was measured with; out-of-range/non-numeric → 422; when dimensions are supplied the headline total is re-derived |
| `api/projects/[id]/readiness/route.ts` | Returns the evidence-based preliminary `score`, `band`, `stage_consistent` — and renamed the gap-engine number to `documentation_completeness` |
| `lib/ai/preview.ts` | Carries `band` + `consistency` |
| `components/developer/AiInsightsPanel.tsx` | Pillars render from the data with their real maxima and labels (no `land → developer` remap, no hardcoded 40/35/25); provenance badge; stage band and consistency note |
| `components/developer/GapMatrix.tsx`, `GapResolutionTracker.tsx` | The gap-engine percentage is labelled **Documentation Completeness**, not "Readiness" |
| `app/developer/submit/page.tsx` | Preview ring shows the evidence score with its stage band; the gap metric is named and shown separately; band-exceeded notice |
| `lib/__tests__/readiness-consistency.test.ts` | New: 19 tests covering the invariant, band derivation/drift, normalisation of the reported 57/32 case, maxima detection, and the Concept scenario |

Verified: `npx tsc --noEmit` clean; `npx vitest run` 430/430 pass (the two suites that fail
without `MFA_COOKIE_SECRET` are an environment requirement, unrelated to this change).

---

## F. Round 2 — prompts, matching scales, unified thresholds

### F1. Matching engine now speaks both scoring models
`lib/matching-engine.ts` previously compared `regulatory_score` (0–20 on evidence rows,
0–40 on legacy rows) against absolute 0–100 thresholds, and blended
`technical_readiness_score` / `documentation_score` / `governance_score` — columns neither
engine writes — straight into the score, so CONSULTANT/TECHNICAL readiness collapsed to
`0.15 × regulatory` on fresh rows.

New behaviour:
- `readinessView()` detects the row's model from `breakdown.pillars` and scales the
  regulatory sub-score **relative to the max that row was measured with**.
- `stageRelativeReadiness()` scores readiness against the **stage band ceiling** — a 40 at
  Concept (its ceiling is 44) now scores as strong progress instead of being structurally
  penalised against a PPA-Ready project.
- Legacy admin-vetting columns are blended only when actually present; otherwise the
  stage-relative evidence score is used.
- `STAGE_NUMBER` table deleted; stage numbers come from `STAGE_BY_VALUE` in the taxonomy.

### F2. One threshold definition
`lib/readiness-thresholds.ts` now defines the bands (rework < 50 ≤ attention < 75 ≤ ready,
action bar 40) matching `review-intelligence.ts`. Consumers updated: project detail page,
admin review, authority project page, AiInsightsPanel, submit preview. Remaining literal
thresholds in marketplace cards etc. are colour-only; sweep them when touching those files.

### F3. Prompt overhaul (error-margin reduction)

**Evidence-extraction prompt (`lib/ai/prompt.ts`):**
- Every evidence key now carries its milestone definition and **what actually proves it**
  (e.g. `eia_approved` requires a ZEMA decision letter; an acknowledgement is NOT an
  approval; a draft PPA is `ppa_under_negotiation`, never `ppa_signed`).
- Evidence-discipline rules: milestone *references* don't count; draft/application documents
  prove the lower tier only; no verbatim excerpt → don't report the item.
- **Confidence calibration bands** replacing the vague three-line rubric: 0.95–1.0 explicit
  (quotable), 0.80–0.94 present with minor gap, 0.70–0.79 strongly implied,
  0.60–0.69 referenced/partial (engine discounts these), below 0.60 do not report. Explicit
  instruction never to inflate confidence.
- Mandatory risk-flag checklist (label mismatch, referenced-not-attached proof, form
  contradictions, template content, missing signature pages).

**Preview prompt:**
- Key milestone definitions included; claims capped at confidence ≤ 0.5 (was ≤ 0.6); status
  granularity spelled out ("submitted" ≠ "approved", "negotiation" ≠ "signed"); target dates
  explicitly prove nothing; conflicting claims → high-severity risk flag; oversized forms
  truncated deterministically with an explicit marker instead of silently blowing the
  context window.

**Full-analysis prompt (`lib/ai-analysis.ts`):**
- New "HOW TO WORK" preamble: every score needs a named document behind it; claims without
  proof score 0; contradictions are scored, not averaged away.
- Stage gates tightened with tier discipline (application ≠ approval, term sheet ≠ financial
  close, EPC award ≠ construction started) and an explicit "walk upward and stop at the first
  missing stage" procedure.
- Per-criterion evidence anchors plus an internal grading scale (explicit proof = max,
  generic = 50–70%, referenced = 20–40%, absent = 0).
- **total_score derivation rule** stating the total must equal the sub-score sum, with the
  reported 14+8+10=57 failure as the worked negative example. (The API still derives the
  total itself — the prompt rule is defence in depth, not the mechanism.)
- Dimension rationales must name documents; services follow the *determined* stage, not the
  claimed one.

**Stage-only prompt:** conservative-estimate rules (done vs planned, status granularity,
"when in doubt, round down and say why").

### F4. Verification
tsc clean; full vitest suite 430/430 (97 more with MFA_COOKIE_SECRET set).

---

## G. Round 3 — document↔project reconciliation (the 61%-with-wrong-docs fix)

The reported failure: a project scored 61% while several uploaded documents did not match
the project details at all. Root cause: both analysis paths scored **every** document's
evidence regardless of whether the document was about *this* project — a well-written PPA
for a different project counted the same as the project's own PPA.

### G1. The reconciliation gate (`lib/ai/reconciliation.ts`)

A deterministic, code-enforced layer between extraction and scoring:

1. **The AI reports what each document IS**: `project_identity` (project name, capacity,
   location, parties — as written in the document, never copied from the form) and
   `relevance` (`belongs_to_project`, `contradicts_project`, reason quoting the document).
2. **Code enforces the verdict mechanically** (`reconcileDocuments`), first match wins:
   - `contradicts_project` → excluded, status `contradicts` (HIGH flag).
   - Names the project (≥0.5 name-token overlap) or the developer as a party → included
     as `match` — code-verified identity wins even if the AI hedged.
   - Identity signals present but wrong (belongs=false, or capacity >30% off, or location
     outside the project country) → excluded as `mismatch` (HIGH flag).
   - No identity signals + low relevance → excluded as `unverifiable` (MEDIUM flag).
   - Otherwise (relevant + AI says belongs) → included, reviewer sees the reason.
3. **Score withholding** (`mustWithholdScore` + `withheldScoreResult`): if NO analyzed
   document belongs to the project, the score is 0 at Concept — never a percentage
   invented from foreign documents. The result is a regular ScoreResult (invariant-safe),
   and the stage rationale states why the score was withheld.
4. Generic industry words (energy, power, project, ltd, MW) can never produce a name
   match (`STOP_TOKENS`), so two unrelated projects can't match on boilerplate.

### G2. Both paths wired

- **Orchestrator**: extraction prompt now carries a structured PROJECT PROFILE block
  (name, developer company name fetched from `companies`, technology, capacity, location);
  `mergeEvidence` receives only reconciled-in documents; `breakdown.reconciliation` and
  per-doc `project_match` verdicts are persisted for the review UI; reconciliation flags
  join the risk-flag list.
- **Legacy path** (`ai-analysis.ts` + analyze route): prompt requires `belongs_to_project`
  and `project_identity` per document with an IDENTITY RECONCILIATION mandate; the route
  classifies each doc (match/mismatch/unverifiable/unreviewed), emits HIGH flags for
  non-belonging docs, forces Concept + zeroes all scores when nothing belongs, and shows
  the verdict badges in the Document Checker.
- **Prompt-version bump** (migration 074): cached pre-reconciliation extractions are
  invalidated so no document is scored without an identity check.

### G3. UI

- Developer Document Checker: per-document badge — ✓ Matches this project / ✗ Not this
  project — excluded from scoring / ? Cannot verify identity — not scored / Not reviewed,
  plus a "Document names: …" line showing what the AI extracted (name · MW · location ·
  parties) so the developer can see WHY.
- Admin review: normalized `project_match` verdict per document (both shapes) with the
  reason and extracted identity.

### G4. Verification
tsc clean; full vitest suite 444/444 (with MFA_COOKIE_SECRET), including 14 new
reconciliation tests (identity matching, exclusion rules, withholding, flags, invariants).

---

## E. Outstanding

1. **Historic rows.** Stored scores from before `SCORING_VERSION` 3 still hold asserted totals
   that may disagree with their breakdown (and land-derived `developer_score` values). Needs a
   reconciliation script/ops decision: recompute from `ai_evidence` where present, otherwise
   re-run analysis or flag for reviewer re-approval.
2. **Band floors** need sign-off from a domain reviewer (§C).
3. **Legacy path still scores 40/35/25** claim-weighted. It is now internally consistent,
   band-checked, and its prompt is evidence-anchored, but it is not the evidence engine.
   Migrating it onto `SCORING_V2` needs an AI cost/rollout decision —
   `AI_ORCHESTRATOR_ENABLED` currently decides which model runs in production.
4. **Prompt evaluation.** The rewritten prompts should be validated against a golden set of
   real documents (strong feasibility, draft-only PPA, unrelated files) before the next
   production batch — `web/scripts/golden-test-ai.ts` is the natural harness.
5. **Colour-only threshold literals** remain in marketplace/list cards; harmless but should
   be swept onto `readiness-thresholds.ts` when those files are next edited.

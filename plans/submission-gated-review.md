# Submission-Gated Review

**Status:** implemented (code + tests green).
**Trigger:** a project moved into `under_review` on its own, before the developer
had submitted it — leaving the submission wizard at the stage-determination step
and opening the project page showed it "Under Regulator Review".

---

## A. Root cause

Entering the review queue was a side effect of *scoring*, not of *submitting*:

1. Uploading a document calls `POST /api/projects/[id]/documents`, which called
   `invalidateProjectAnalysis()` → `markProjectAnalysisDirty()` **+ an `ai_jobs`
   insert**. The wizard uploads documents early (the readiness preview after step
   2 reads them), so a draft queued a full analysis job.
2. The AI worker (`/api/internal/ai-worker`, `claim_ai_jobs`) or the inline
   (`AI_SYNC_WORKER=true`) path then ran `runProjectAnalysis(jobId)`, which:
   - moved the project `draft → scoring` (`transitionProjectInternal`), then
   - **always finished on `under_review`**.
3. The legacy `/api/projects/[id]/analyze` path did the same thing inline: it
   promoted `draft → scoring` and ended with `scoring → under_review`.

So any scoring run — readiness preview documents, a manual "Run AI Analysis" on
a draft — dragged a half-finished project into the review queue.

## B. The invariant now enforced

**A project is only in the review pipeline after the developer's final
submission.** `POST /api/projects/[id]/submit` is the single door into it
(`draft → scoring`, notifications included); scoring then completes
`scoring → under_review`.

Implemented as one predicate in the lifecycle source of truth
(`lib/project-state-machine.ts`):

```ts
SUBMITTED_STATUSES   = scoring | scoring_retry | under_review | pending_live | live | deactivated | archived
isSubmittedForReview(status) // false for `draft` and `paused`
```

| Call site | Behaviour before | Behaviour now |
|---|---|---|
| `lib/analysis-trigger.ts` `enqueueAnalysisJob` | enqueued for every status | only for `isSubmittedForReview` statuses; a draft is merely marked `analysis_dirty` |
| `lib/ai/orchestrator.ts` `runProjectAnalysis` | `draft → scoring` → … → `under_review` | scores without touching the status unless submitted; the completion re-reads the live status and only fires from `scoring`; a failed run no longer parks a draft in `scoring_retry` |
| `api/projects/[id]/analyze` | promoted `draft → scoring`, ended on `under_review` | `draft` is never promoted (score-only); completion goes through `enterReviewIfSubmitted()` (no-op unless the live status is `scoring`) |
## Stage-gated recommended profiles (follow-up)

After the AI determines the stage, the stage step (and the Find Partners / Gaps
pages, which share the helpers) shows only the profile types that belong to that
stage — `STAGE_ALLOWED_CATEGORIES` in `lib/project-stages.ts`:

| Stage | Contactable profiles |
|---|---|
| Concept | Consultants, Grant Providers |
| Pre-Feasibility | Consultants, Grant Providers |
| Full Feasibility | Consultants, Financial, EPC, Grant Providers |
| Regulatory Approval | Consultants, Grant Providers |
| PPA Ready | Financial, Grant Providers, Power Traders (offtake) |
| Financial Close | EPC, O&M, Financial, Grant Providers |
| Construction | O&M, EPC, Grant Providers |
| Operation | O&M, Grant Providers |

Power Traders were removed from Full Feasibility and Financial Close (offtake
belongs to PPA Ready).

UX on the stage step: each gap card is collapsed and shows the matched count
("4 consultants found") plus a **Contact** button; Contact opens that card's
profile list (top match + % match), where each profile is engaged via the
existing introduction flow (duplicates surface as "Engaged"). Data: the
readiness payload now returns `match_count` (full stage-allowed pool) per
profile alongside the top-3 `candidates`; `countCandidatesForGap` in
`lib/partner-candidates.ts` is the counting helper.

Tests: `src/lib/__tests__/stage-partner-gating.test.ts` (14 tests) pins the
stage table, the Offtaker↔Power Trader mapping, gap suppression and the
count-vs-slice behaviour.

---

| `api/projects/[id]/analyze` guard | `cached` / `throttled` could leave a submission parked in `scoring` | `cached` still completes the submission; only a **draft** is throttled by the anti-abuse cooldown |
| `developer/submit` wizard | only resubmissions called `/submit` (new projects relied on `/analyze`) | the final CTA always submits: `/submit` for a new project, a first-time draft edit, and resubmissions; editing an already-submitted project only saves |
| `projects/[id]` "Run AI Analysis" | optimistically rendered `under_review` | re-reads the project, so a scored draft still shows "Draft" |

## C. Flow (canonical)

```
draft ──(final Submit: POST /submit)──► scoring ──(analysis completes)──► under_review
  ▲                                        │                                  │
  └────── reviewer returns (comment) ──────┴──────── reviewer approves ─────► live
```

Scoring from a draft (wizard preview, manual run, insights page) is
status-neutral: the project stays a draft until Submit.

## D. Verification

- `npx tsc --noEmit` clean.
- `npx vitest run` 483/483 (4 new `isSubmittedForReview` tests, including the
  regression assertion that a draft is not submitted).

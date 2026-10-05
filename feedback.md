15/07/2026
**Energy Capital Match — Security & Architecture Review Findings (development branch)**

**Reviewed against:** `prd - Copy.txt` (in-repo) + the 8-week execution plan / production-transformation plan (external context). Core rules checked: matching must be deterministic (no AI), AI must be scoped to document analysis only, nothing server-side may trust client-supplied identity/status.

---

### 🔴 Fix first — security/architecture violations

- **Documents are served via permanent public URLs, not signed URLs.** `getPublicUrl()` is used at [web/src/app/api/projects/[id]/documents/upload/route.ts:88](web/src/app/api/projects/[id]/documents/upload/route.ts:88) — no `createSignedUrl` call exists anywhere in the codebase. Plan requires private buckets + 15-min signed URLs, with "no public document URLs ever" called out explicitly. The `project-documents` bucket also has no migration defining/securing it (only `avatars` does) — its policy is unreviewable, hand-configured state.
- **`storage.rules` (Firebase) allows any authenticated user to read/write any project's files** — `allow read, write: if request.auth != null` on `projects/{projectId}/**`. Delete if Firebase Storage is dead; tighten if still deployed via `firebase.json`.
- **Matching engine has no eligibility gate.** No org-verified check, no currency match, no sector-overlap prefilter before scoring every partner against every project. Worse: the single-project path in [web/src/app/api/matching/run/route.ts:44](web/src/app/api/matching/run/route.ts:44) applies **no status filter at all** — a developer can trigger matching on their own unvalidated draft project (the `run_all` path does filter `status = 'validated'`, this one doesn't).
- **AI analysis is triggered directly from the browser** at [web/src/app/projects/[id]/page.tsx:183](web/src/app/projects/[id]/page.tsx:183) — plan explicitly forbids this. The route checks project ownership but not project status eligibility, and has **no rate limit at all** (the existing 5/hr limiter only covers the separate admin AI route).
- **Client-supplied `storage_path`/`file_url` trusted on document creation.** [web/src/app/api/projects/[id]/documents/route.ts](web/src/app/api/projects/[id]/documents/route.ts) lets the client set both fields freely via `pickFields`; ownership is checked but the path isn't constrained to `${projectId}/`. The upload route's own DELETE handler already has this `startsWith` guard — just needs applying here too.

### 🟠 Architectural debt — gets more expensive the longer it's deferred

- **No `StorageProvider`/`DocumentStorageService` abstraction.** `supabase.storage.from(...)` is called directly in route handlers. Required by the plan so storage can move to R2/B2 without touching business logic.
- **No `AiProviderService` abstraction.** `new GoogleGenerativeAI(...)` constructed inline in 3 route files. Required so the AI vendor is swappable.
- **No async job runner.** Matching and AI scoring both run synchronously inside the HTTP request. Plan calls for Inngest/Trigger.dev/Supabase Edge Functions with dead-letter queues + idempotency keys — none present. This is a structural blocker to the "never block the UI" performance target.
- **AI model contract doesn't match the plan:** default model is `gemini-2.5-flash` (the plan's escalation tier) used as default, with no Flash-Lite tier and no escalation logic. `functions/index.js` still hardcodes `gemini-1.5-flash`. No `temperature: 0.1` set anywhere (plan requires it for deterministic JSON output). No 3-retry exponential backoff. No fallback `AIScore=0` + admin flag on failure. No per-org monthly AI budget cap. Hash-based document reuse exists only in the admin AI route (`file_hash`) — the project `/analyze` route re-analyzes every time, unconditionally.
- **10 tables from the plan don't exist yet:** `analysis_jobs`, `analysis_results`, `ai_usage_events`, `document_access_logs`, `document_requirements`, `match_results_history`, `engagement_state_history`, `engagement_documents`, `rate_limit_events`, `grant_provider_profiles`. Two matter most: missing `document_access_logs` means sensitive document downloads aren't logged (security baseline requirement); missing `match_results_history` means match scores aren't versioned.
- **Engagement state machine diverges from the plan.** Built version ([web/src/lib/engagement.ts](web/src/lib/engagement.ts)) adds `NDA_SIGNED` (not in plan) and lets `TERM_SHEET → CLOSED` skip `CONTRACT_SIGNED`. `CONTRACT_SIGNED` and `CAPITAL_COMMITTED` are defined but **unreachable** — nothing transitions into them, yet the matching route's EPC-bonus check still references both as "accepted" states, so part of that logic is dead code.

### 🟡 Scope decisions needed (not bugs — need a decision logged)

- **MFA, user-facing analytics, notification preferences, and automated technical-partner scoring are all built but explicitly marked "v1.1 — do not build early without a logged decision."** Either log the decision to pull these into v1, or hold them back.
- **Grant Provider role is built and active.** The two planning docs disagree on when it's scoped: `prd - Copy.txt` says v1.1, the external plan says v2.0. Needs reconciling.
- **Sprint 3 requirement not yet built:** document access should be gated on mutual "Introduction Acceptance" in the engagement flow — not implemented today.

### 🟢 Code health / smaller items

- **Zero tests in the repo** — no test files, no runner configured. `scoring.ts` (deterministic scoring/matching) is pure functions and would be cheap to cover; it's exactly the code an institutional platform should have regression tests on.
- **`triggerAutoAnalysis` silently fails.** [web/src/app/api/projects/[id]/documents/upload/route.ts:41](web/src/app/api/projects/[id]/documents/upload/route.ts:41) does a server-to-server fetch to `/analyze` without forwarding auth cookies — always 401s, error swallowed into a `console.error`. Auto-trigger-after-upload has never worked.
- **Error message mismatch:** `MAX_FILE_SIZE` is 20MB but the rejection message says "Maximum size is 50MB."
- **Two colliding migration directories** — `web/supabase/migrations/` and `supabase/migrations/` both define different migrations numbered 004–007. Needs reconciling before next deploy; not clear which set is actually applied to production.
- **Rate limiter is in-memory (`Map`)**, single-instance only — won't hold under multi-instance/serverless deployment (comment in the file itself admits this).
- **`RATE_LIMIT_UPLOAD` is defined but never imported/used anywhere** — the 20-files/hour upload cap is unenforced.
- **Missing:** document classification (PUBLIC/RESTRICTED/CONFIDENTIAL), malware scanning on uploads, Sentry/error monitoring.
- **`zod` is a dependency but used in only 2 of ~65 API route files** — validation is largely manual/ad hoc elsewhere.
- Dead functions in `web/src/lib/scoring.ts`: `calculateServiceMatch`, `calculateMWCompatibility`, `calculateTrackRecordScore`.

### ✅ Holding up correctly — no action needed

- **Matching engine is fully deterministic** — `web/src/lib/scoring.ts` is pure arithmetic, imports only types, zero network/AI calls. Formulas match the plan (Capital 30/20/15/15/10/10, EPC 25/25/20/15/15) including the +10 joint-entity bonus.
- **AI is correctly scoped to document analysis only** — all 3 Gemini call sites feed a score into the DB; none writes match results or project status.
- **Server-side identity is consistently enforced** — role is derived from `company_members` on every request via `getAuthenticatedUser`; `pickFields` blocks mass assignment; `status` can't be client-set except by admins.
- **RLS is enabled and properly scoped on all sensitive tables** — projects, documents, companies, engagements, messages, and 20+ others. The `USING (true)` policies are all correctly restricted `TO service_role`.
- **No hardcoded secrets** — nothing tracked in git, `.gitignore` covers `.env*` and service account keys.
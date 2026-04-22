# Energy Capital Match - MVP Hardening Plan (April Phase)

## Overview
This plan focuses on transitioning the Afri Connect platform from a functional prototype to an institutional-grade marketplace. The primary objectives are to secure the data infrastructure, implement a rigorous 21-parameter project readiness scoring model, and finalize the matching and engagement workflows.

---

## Sprint 0: Security & Stabilization (The "Gatekeeper" Sprint)
**Goal:** Close vulnerabilities and ensure institutional-grade protection.

### Key Actions
1.  **Hardening Supabase RLS:**
    *   Remove all `USING (true)` and `WITH CHECK (true)` policies in `schema.sql`.
    *   Implement ownership-based access for the `projects`, `project_documents`, and `organizations` tables.
    *   Restrict `engagements` and `messages` visibility strictly to participants.
2.  **Signup Gatekeeping:**
    *   Modify `SignupPage.tsx` to require a `setup_key` (Admin-provided token).
    *   Add database logic to prevent user creation without a valid invite/token.
3.  **Auth Lifecycle Management:**
    *   Fix the logout bug by ensuring both Firebase and Supabase sessions are explicitly terminated in `useAuth.tsx`.
    *   Implement forced hard-redirects to `/login` to clear browser state.
4.  **Currency & Localization:**
    *   Standardize all financial fields and UI labels to **ZMW (Zambian Kwacha)**.
    *   Enforce a UI "Waiting Room" for users with a `verification_status` of `PENDING`.

---

## Sprint 1: Advanced Scoring Engine (Phase 3 Revamp)
**Goal:** Implement the multi-factor readiness model (40/35/25).

### Scoring Model (Total: 100%)
1.  **Regulatory & Project Readiness (40%)**
    *   Site Rights & Land Security (6%), Environmental Approval (5%), Grid Readiness (7%), Feasibility Study Quality (8%), PPA / Offtake Agreement (8%), Construction Readiness (3%), Licensing Status (2%), Corporate Compliance (1%).
2.  **Financial Viability (35%)**
    *   CAPEX Benchmarking (5%), OPEX Sustainability (5%), FIRR (10%), FNPV (7%), Payback Period (5%), Sensitivity Analysis (3%).
3.  **Developer Strength (25%)**
    *   Legal Compliance (3%), Track Record - Development (6%), Track Record - Operations (4%), EPC/Technical Partnerships (4%), Equity Commitment (4%), Funding Readiness (3%), Company Strength (1%).

### Implementation
*   **AI Integration:** Orchestrate Gemini Flash to scan project documents specifically for these 21 parameters.
*   **Developer Controls:** Allow developers to re-run AI scoring (capped at 3 attempts to manage credits) and manually supplement missing data from the dashboard.
*   **Visual Insights:** Replace the simple summary with a **Readiness Radar Chart** and a prioritized list of "Action Items" to improve the score.

---

## Sprint 2: Matching & Discovery (Phase 4 Completion)
**Goal:** Connect projects to capital based on the new readiness scores.

### Key Actions
1.  **Matching Algorithm:** Implement a server-side `MatchingService` that compares a Project's readiness and requirements against Capital Partner mandates.
2.  **Match Persistence:** Automatically populate `capital_match_results` and `technical_match_results` tables upon project validation.
3.  **Discovery UI:** Build the "My Matches" tab for Developers, showing the "Top 5" partners with a compatibility breakdown.

---

## Sprint 3: Engagement Workflow & Audit (Phase 5/6 Completion)
**Goal:** Secure the deal lifecycle from "Match" to "Close".

### Key Actions
1.  **Milestone State Machine:** Enforce transitions: `INTRO_SENT` → `INTRO_ACCEPTED` → `DUE_DILIGENCE` → `TERM_SHEET` → `CLOSED`.
2.  **Milestone Room:** Finalize the deal portal (`/dashboard/engagements/[id]`) with a professional progress timeline.
3.  **Hardened Data Room:** Grant document access *only* after a mutual "Introduction Acceptance."
4.  **Audit Trail:** Log all state changes and sensitive document downloads in the `audit_logs` table for compliance.

---

## Immediate Priority: "Security & Scoring"
1.  Rewrite RLS Policies in `schema.sql`.
2.  Implement the `setup_key` signup gate.
3.  Deploy the 40/35/25 scoring backend logic.
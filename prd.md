# Energy Capital Match - Product Requirements Document (PRD)

## 1. PRODUCT OVERVIEW

### 1.1. Product Vision
To become the leading B2B digital platform for structuring and financing energy infrastructure projects, accelerating the global transition to sustainable energy by connecting developers, capital providers, and technical experts with unparalleled efficiency and intelligence.

### 1.2. Target Users
The platform serves five key user roles:
*   **Project Developers:** Organizations seeking capital and technical expertise to build energy projects.
*   **Capital Partners:** Investment firms, funds, and financial institutions looking to deploy capital into viable energy projects.
*   **Technical Partners:** Engineering, Procurement, and Construction (EPC) firms, Operations & Maintenance (O&M) providers, and specialized advisors providing services to projects.
*   **Grant Providers:** Public or private organizations offering non-dilutive funding for energy projects.
*   **Admin:** Internal team responsible for platform oversight, user verification, and quality control.

### 1.3. Core Value Proposition
Energy Capital Match solves the critical problem of fragmentation and inefficiency in the energy financing market. Our platform provides:
*   **For Developers:** A streamlined, data-driven process to access a curated network of relevant capital and technical partners, reducing the time and cost of capital raising.
*   **For Capital Partners:** A proprietary scoring and matching system to source pre-vetted, high-quality project opportunities that align with their specific investment thesis.
*   **For Technical Partners:** A targeted channel to win contracts for services on well-defined, capital-ready projects.
*   **For All Users:** A secure, standardized, and transparent environment for deal-making and due diligence.

### 1.4. Primary Workflows
1.  **Onboarding:** Users register, create company profiles, and undergo a verification process.
2.  **Project Submission:** Developers create detailed project listings, upload required documentation, and submit them for scoring and validation.
3.  **Scoring & Matching:** The system's hybrid AI and rules-based engines generate Capital and Technical Readiness scores. The platform then calculates compatibility scores and presents the top 5 matches to each party.
4.  **Engagement:** Matched parties can initiate contact, engage in secure messaging, exchange documents in a secure data room, and move through a structured deal workflow from introduction to financial close.

### 1.5. Success Metrics (KPIs)
*   **Platform Growth:**
    *   Number of active, verified users per role.
    *   Number of new projects submitted per month.
    *   Total capital required by projects on the platform.
*   **Engagement & Matching:**
    *   Average number of matches per project.
    *   Match-to-engagement conversion rate.
    *   Time from project submission to first engagement.
*   **Deal Flow:**
    *   Number of engagements reaching "Term Sheet" stage.
    *   Number of projects reaching "Capital Committed" or "Closed" status.
    *   Total value of deals closed through the platform.

## 2. USER ROLES & PERMISSIONS MATRIX

This matrix defines the core permissions for each user role. C=Create, R=Read, U=Update, D=Delete.

| Feature / Module              | DEVELOPER        | CAPITAL_PARTNER  | TECHNICAL_PARTNER | GRANT_PROVIDER   | ADMIN            |
| ----------------------------- | ---------------- | ---------------- | ----------------- | ---------------- | ---------------- |
| **User Account**              | CRU (Own)        | CRU (Own)        | CRU (Own)         | CRU (Own)        | CRUD (All)       |
| **Company Profile**           | CRU (Own Org)    | CRU (Own Org)    | CRU (Own Org)     | CRU (Own Org)    | CRUD (All)       |
| **Projects**                  | CRUD (Own Org)   | R (Validated)    | R (Validated)     | R (Validated)    | CRUD (All)       |
| **Project Documents**         | CRU (Own Org)    | R (In Engagement)| R (In Engagement) | R (In Engagement)| CRUD (All)       |
| **Capital Partner Profiles**  | R (Active)       | CRUD (Own Org)   | R (Active)        | R (Active)       | CRUD (All)       |
| **Technical Partner Profiles**| R (Active)       | R (Active)       | CRUD (Own Org)    | R (Active)       | CRUD (All)       |
| **Project Scores**            | R (Own Org)      | R (Validated)    | R (Validated)     | R (Validated)    | CRU (All)        |
| **Match Results**             | R (Own Org)      | R (Own Org)      | R (Own Org)       | R (Own Org)      | R (All)          |
| **Engagements**               | CRU (Participant)| CRU (Participant)| CRU (Participant) | CRU (Participant)| R (All)          |
| **Messages**                  | CRU (Participant)| CRU (Participant)| CRU (Participant) | CRU (Participant)| R (All)          |
| **Admin Dashboard**           | No Access        | No Access        | No Access         | No Access        | Full Access      |
| **Analytics**                 | R (Own Org)      | R (Own Org)      | R (Own Org)       | R (Own Org)      | R (All)          |

### Dashboard Components Required:

*   **Developer:**
    *   My Projects (List, Create, Edit)
    *   My Matches (Capital & Technical)
    *   My Engagements
    *   Company Profile
*   **Capital Partner:**
    *   Project Marketplace (Browse, Filter)
    *   My Matches
    *   My Engagements
    *   Investment Profile
*   **Technical Partner:**
    *   Project Marketplace (Browse, Filter)
    *   My Matches
    *   My Engagements
    *   Service Profile
*   **Grant Provider:**
    *   Project Marketplace (Browse, Filter)
    *   My Engagements
    *   Grant Program Profile
*   **Admin:**
    *   User Management
    *   Company Verification
    *   Project Moderation
    *   Platform Analytics
    *   Dispute Resolution

## 3. CORE PRODUCT MODULES

### A. User Onboarding & Verification

**Functional Requirements:**
*   Users must be able to sign up using an email/password combination or Google OAuth.
*   During signup, users must select their primary role (Developer, Capital Partner, etc.).
*   After signup, users are guided to create their individual profile and a corresponding company profile.
*   Admin users must be able to verify company profiles to grant full platform access. Unverified users will have limited access.

**Required Fields:**
*   **User:** `full_name`, `email`, `password`, `role`.
*   **Company:** `name`, `type`, `country`, `website`.

**Validation Rules:**
*   Email must be unique and in a valid format.
*   Password must be at least 8 characters long.
*   Company website must be a valid URL.

**Backend Logic:**
*   Create a new user record in Firebase Authentication.
*   Create a corresponding user profile in the Supabase `users` table, linking it to the Firebase UID.
*   Create a new company profile in the `organizations` table.
*   Associate the user with the newly created organization.
*   Send a welcome email upon successful registration.
*   Send a notification to the Admin queue for company verification.

**UI Screens Required:**
*   Signup Page (with role selection)
*   Login Page
*   "Create Your Profile" wizard (multi-step form)
*   "Pending Verification" status page

**API Endpoints Required:**
*   `POST /api/auth/signup`
*   `POST /api/auth/login`
*   `POST /api/organizations`
*   `PUT /api/users/{userId}`

**Database Tables Impacted:**
*   `users`
*   `organizations`

### B. Company Profiles

**Functional Requirements:**
*   Each organization must have a detailed profile tailored to its type.
*   The profile should serve as the primary source of information for matching.
*   Users within an organization can edit their company's profile.

**Required Fields:**
*   **All Companies:** `name`, `logo_url`, `website`, `description`, `country_of_operation` (Default: "Zambia"), `years_operating`, `team_size`.
*   **Capital Partners:** `preferred_structures` (EQUITY, etc.), `min_ticket_size_zmw`, `max_ticket_size_zmw`, `risk_tolerance`, `governance_preference`, `sector_focus`, `geographic_focus` (within Zambia).
*   **Technical Partners:** `service_categories`, `sector_experience`, `min_mw_capacity`, `max_mw_capacity`, `regions_operated` (within Zambia), `delivery_models`.

**Backend Logic:**
*   Data will be stored in the `organizations`, `capital_partners`, and `technical_partners` tables.
*   Logic to handle profile creation and updates based on user role.

**UI Screens Required:**
*   "Edit Company Profile" page with tabbed sections for different profile types.
*   Public view of a company profile.

**API Endpoints Required:**
*   `GET /api/organizations/{orgId}`
*   `PUT /api/organizations/{orgId}`
*   `POST /api/capital-partners`
*   `PUT /api/capital-partners/{partnerId}`
*   `POST /api/technical-partners`
*   `PUT /api/technical-partners/{partnerId}`

**Database Tables Impacted:**
*   `organizations`
*   `capital_partners`
*   `technical_partners`

### C. Project Creation & Editing

**Functional Requirements:**
*   Project Developers must be able to create, edit, and manage detailed project listings.
*   Projects must have a clear status (`draft`, `submitted`, `validated`, etc.).
*   All monetary fields will be in Zambian Kwacha (ZMW) for the MVP.

**Required Fields:**
*   `name`, `technology_type`, `location_country` (Default: "Zambia"), `location_region` (Zambian provinces), `project_size_mw`, `capital_required_zmw`, `project_stage`, `target_financial_close_date`, `target_cod`.

**Backend Logic:**
*   A new record is created in the `projects` table.
*   The project is associated with the developer's organization.
*   Initial status is set to `draft`.
*   A "submit for review" action changes the status and triggers a notification to the Admin.

**UI Screens Required:**
*   "Create Project" multi-step form/wizard.
*   Project Dashboard to view and manage all created projects.
*   "Edit Project" page.

**API Endpoints Required:**
*   `POST /api/projects`
*   `GET /api/projects` (for the developer's own projects)
*   `GET /api/projects/{projectId}`
*   `PUT /api/projects/{projectId}`
*   `POST /api/projects/{projectId}/submit`

**Database Tables Impacted:**
*   `projects`

### D. Capital Structure Selection

**Functional Requirements:**
*   Developers must select one of the allowed capital structures for their project.
*   The system must enforce that only allowed structures can be chosen.
*   The selection will be a key input for the capital matching algorithm.

**System Constraints:**
*   **Allowed Structures:** `EQUITY`, `PROFIT_SHARING`, `LEASING`, `GRANT`.
*   **Disallowed:** No debt instruments, loans, or fixed-return fields.

**Required Fields:**
*   `capital_structure_type` (Enum on `projects` table).
*   `governance_terms` (Text field for equity-like structures).
*   `exit_terms` (Text field).
*   `risk_disclosures` (Text field).

**Validation Rules:**
*   Enforced at the database schema level (`CHECK` constraint).
*   Validated in the backend API.
*   Controlled via a dropdown/select component in the frontend.

**UI Screens Required:**
*   A dedicated step/section within the "Create/Edit Project" form.

**API Endpoints Required:**
*   Integrated into `POST /api/projects` and `PUT /api/projects/{projectId}`.

**Database Tables Impacted:**
*   `projects`

### E. Document Upload & Secure Data Room

**Functional Requirements:**
*   Developers must upload a set of required documents for their project to be considered "complete".
*   Uploaded documents will be analyzed by the AI Scoring Engine.
*   A secure data room will be created for each engagement, where participants can share sensitive documents.
*   Access to documents must be strictly controlled using signed URLs.

**Required Document Types:**
*   Pitch Deck, Financial Model, Technical Report, Environmental Permits, etc.

**Backend Logic:**
*   Files are uploaded to Google Cloud Storage.
*   A record is created in the `project_documents` table with a reference to the GCS URL.
*   When a user requests a document, the backend generates a short-lived signed URL for secure access.

**UI Screens Required:**
*   File upload component in the "Create/Edit Project" form.
*   A "Data Room" view within an active engagement.

**API Endpoints Required:**
*   `POST /api/projects/{projectId}/documents` (to upload)
*   `GET /api/documents/{documentId}/download` (to get a signed URL)

**Database Tables Impacted:**
*   `project_documents`
*   `documents` (for engagement-specific files)

### F. Capital Readiness Scoring

**Functional Requirements:**
*   The system must automatically calculate a "Capital Readiness Score" for each submitted project.
*   The score will be a hybrid of rule-based checks and AI-powered document analysis.
*   The score (0-100) and its breakdown must be visible to the Project Developer and the Admin.

**Backend Logic:**
*   A Cloud Function is triggered when a project is moved to `submitted` status.
*   The function executes the scoring engine, which:
    1.  Calculates a score based on the completeness of structured data fields.
    2.  Calls the Gemini API to analyze uploaded documents for clarity, completeness, and risk signals.
    3.  Combines the scores based on a weighted formula.
    4.  Saves the final score, breakdown, and AI analysis to the `project_scores` table.

**UI Screens Required:**
*   A "Scoring" tab on the Project Details page for the developer.
*   A detailed score view in the Admin dashboard.

**API Endpoints Required:**
*   `POST /api/scoring/capital/{projectId}` (Webhook for the Cloud Function)
*   `GET /api/projects/{projectId}/scores`

**Database Tables Impacted:**
*   `project_scores`
*   `projects` (status update)

### G. Technical Readiness Scoring

**Functional Requirements:**
*   This score is generated by a human Technical Partner or an Admin, not automatically.
*   It assesses the technical viability and readiness of a project.
*   The score (0-100) is based on a standardized rubric.

**Backend Logic:**
*   An Admin assigns a project to a Technical Partner for review (Post-MVP). For MVP, Admin will perform this role.
*   The reviewer submits a score through a dedicated form.
*   The score is saved in the `project_scores` table.

**UI Screens Required:**
*   A "Technical Review" form/dashboard for Admins/assigned Technical Partners.

**API Endpoints Required:**
*   `POST /api/scoring/technical/{projectId}`

**Database Tables Impacted:**
*   `project_scores`

### H. Capital Matching Engine

**Functional Requirements:**
*   The system must calculate a "Compatibility Score" between each validated project and every active Capital Partner.
*   The matching process should run automatically when a new project is validated or a new Capital Partner becomes active.
*   Each party should see a ranked list of their top 5 matches.

**Backend Logic:**
*   A background job (e.g., a scheduled Cloud Function) runs periodically or is triggered by events.
*   For each project/partner pair, it calculates a score based on the weighted formula (Capital Range, Structure, Risk, etc.).
*   The results, including the score and a JSON breakdown, are stored in the `capital_match_results` table.

**UI Screens Required:**
*   A "My Matches" tab in the Developer and Capital Partner dashboards.
*   A "Match Details" view to show the score breakdown.

**API Endpoints Required:**
*   `GET /api/matches/capital` (to get matches for the current user)
*   `POST /api/matches/calculate` (to trigger a recalculation, admin only)

**Database Tables Impacted:**
*   `capital_match_results`

### I. Technical Matching Engine

**Functional Requirements:**
*   Calculates a "Compatibility Score" between each validated project and every active Technical Partner.
*   Provides developers with a ranked list of suitable EPC, O&M, and advisory firms.

**Backend Logic:**
*   Similar to the Capital Matching Engine, a background job calculates scores based on service category, sector experience, MW size, etc.
*   Results are stored in the `technical_match_results` table.

**UI Screens Required:**
*   A "Find Technical Partners" tab in the Developer dashboard.

**API Endpoints Required:**
*   `GET /api/matches/technical`

**Database Tables Impacted:**
*   `technical_match_results`

### J. Engagement Workflow (State Machine)

**Functional Requirements:**
*   Once a match is accepted, a formal "Engagement" is created.
*   The engagement must progress through a series of predefined states, from initial introduction to a closed deal.
*   Only designated users can trigger state transitions.

**Backend Logic:**
*   The state machine is implemented in the backend API.
*   Each state transition is a controlled action that checks for user permissions.
*   An `engagement_states` history table logs every transition for audit purposes.
*   Transitions trigger notifications to relevant parties.

**UI Screens Required:**
*   A "Deal Workflow" or "Engagement Details" page showing the current state and a history of a given engagement.
*   Buttons/actions to trigger valid state transitions (e.g., "Accept Introduction", "Move to Due Diligence").

**API Endpoints Required:**
*   `POST /api/engagements`
*   `GET /api/engagements/{engagementId}`
*   `PUT /api/engagements/{engagementId}/state`

**Database Tables Impacted:**
*   `engagements`
*   `engagement_states`

### K. Messaging System

**Functional Requirements:**
*   Users involved in an active engagement must be able to communicate through a secure messaging portal.
*   Messages should be private to the participants of that engagement.

**Backend Logic:**
*   Messages are stored in the `messages` table, linked to a specific `engagement_id`.
*   RLS policies ensure that only engagement participants can read or write messages.

**UI Screens Required:**
*   A chat/messaging interface within the "Engagement Details" page.

**API Endpoints Required:**
*   `GET /api/engagements/{engagementId}/messages`
*   `POST /api/engagements/{engagementId}/messages`

**Database Tables Impacted:**
*   `messages`

### L. Notifications

**Functional Requirements:**
*   The system must send both in-app and email notifications for critical events.
*   Users should have basic control over their notification preferences (Post-MVP).

**Notification Triggers:**
*   New Match found
*   Engagement invitation received
*   Engagement state changed
*   New message received
*   Project status changed (e.g., validated)

**Backend Logic:**
*   An event-driven system. When a key action occurs, a "notification" event is published.
*   A listener service picks up these events and handles the delivery of in-app and email (via SendGrid/Resend) notifications.

**UI Screens Required:**
*   An in-app notification center/dropdown.
*   Email templates for each notification type.

**API Endpoints Required:**
*   `GET /api/notifications`
*   `POST /api/notifications/mark-read`

**Database Tables Impacted:**
*   `notifications` (or a similar table to track in-app notifications)

### M. Admin Oversight & Moderation

**Functional Requirements:**
*   Admin users need a dedicated dashboard to manage the platform and its users.
*   Admins must be able to perform key quality control and moderation tasks.

**Core Admin Functions:**
*   Verify new organizations.
*   Review and validate/reject submitted projects.
*   Manually trigger scoring/matching recalculations.
*   View all users, projects, and engagements.
*   Resolve user-reported disputes.
*   Suspend or deactivate abusive accounts.

**UI Screens Required:**
*   A dedicated, role-protected Admin Dashboard with sections for each of the functions above.

**API Endpoints Required:**
*   A separate set of `/api/admin/*` routes with strict role-based access control.

**Database Tables Impacted:**
*   All tables, via admin-privileged access.

### N. Analytics Dashboard

**Functional Requirements:**
*   Provide high-level insights into platform activity for Admins.
*   Provide basic performance metrics for individual users (e.g., developers on their projects).

**Metrics to Track (Admin):**
*   User growth over time (by role).
*   Project submission and validation rates.
*   Engagement and deal flow funnel.

**Metrics to Track (User):**
*   Views on their project/profile.
*   Number of matches received.
*   Engagement success rate.

**UI Screens Required:**
*   A data visualization dashboard for Admins.
*   A simple analytics widget on the user's main dashboard.

**API Endpoints Required:**
*   `GET /api/analytics/platform` (Admin only)
*   `GET /api/analytics/user`

**Database Tables Impacted:**
*   `audit_logs`
*   Aggregated views/queries on core tables.

## 4. MATCHING SYSTEM SPECIFICATION

The matching system is designed to compute a compatibility score between projects and capital/technical partners.

### 4.1. Capital Matching Score (0–100)

*   **Weight Distribution:**
    *   Capital Range Overlap: 30%
    *   Structure Compatibility: 20%
    *   Risk Tolerance Alignment: 15%
    *   Governance Preference Alignment: 15%
    *   Sector Match: 10%
    *   Geographic Match: 10%
*   **Recalculation Triggers:**
    *   A new project is `validated`.
    *   A new Capital Partner becomes `active`.
    *   A developer or capital partner significantly updates their profile.
*   **Pseudocode:**
    ```
    FUNCTION calculate_capital_match(project, partner):
      score = 0
      // 1. Capital Range Overlap
      IF project.capital_required BETWEEN partner.min_ticket AND partner.max_ticket:
        score += 30
      // 2. Structure Compatibility
      IF project.capital_structure IN partner.preferred_structures:
        score += 20
      // 3. Risk Alignment
      IF project.risk_level == partner.risk_tolerance:
        score += 15
      // 4. Governance Alignment
      IF project.governance_preference == partner.governance_preference:
        score += 15
      // 5. Sector Match
      IF project.sector IN partner.sector_focus:
        score += 10
      // 6. Geographic Match
      IF project.region IN partner.geographic_focus:
        score += 10
      RETURN score
    ```

### 4.2. Technical Matching Score (0–100)

*   **Weight Distribution:**
    *   Service Category Match: 25%
    *   Sector Experience Match: 20%
    *   MW Size Compatibility: 20%
    *   Geographic Coverage: 15%
    *   Timeline Availability: 10% (Post-MVP)
    *   Track Record Strength: 10%
*   **Pseudocode:**
    ```
    FUNCTION calculate_technical_match(project, partner):
      score = 0
      // 1. Service Match (assumes project.required_services)
      IF ANY(service IN partner.service_categories FOR service IN project.required_services):
        score += 25
      // 2. Sector Match
      IF project.sector IN partner.sector_experience:
        score += 20
      // 3. Size Compatibility
      IF project.size_mw BETWEEN partner.min_mw AND partner.max_mw:
        score += 20
      // 4. Geographic Match
      IF project.region IN partner.regions_operated:
        score += 15
      // 5. Track Record (simple proxy)
      IF partner.total_mw_delivered > 100:
        score += 10
      RETURN score
    ```

## 5. SCORING ENGINE SPECIFICATION

The scoring engine provides a quantitative measure of a project's viability and readiness.

### 5.1. Capital Readiness Score (0-100)

*   **Weight Distribution:**
    *   Documentation Completeness: 20%
    *   Governance Clarity: 20%
    *   Financial Transparency: 20%
    *   Risk Disclosure Quality: 15%
    *   Developer Track Record: 15%
    *   AI Risk Analysis: 10%
*   **AI Integration (Gemini API):**
    *   A Cloud Function sends the text content of uploaded documents to the Gemini API.
    *   The prompt asks the AI to rate clarity, identify risks, and check for missing information.
*   **Input/Output JSON Schema (for AI):**
    *   **Input:** `{ "documents": [{ "type": "PITCH_DECK", "content": "..." }] }`
    *   **Output:**
        ```json
        {
          "total_score": 85,
          "breakdown": {
            "clarity": 90,
            "completeness": 80
          },
          "risk_flags": [
            "High reliance on a single off-taker",
            "Aggressive timeline assumptions"
          ],
          "recommendations": [
            "Provide a more detailed financial model.",
            "Clarify the land acquisition status."
          ]
        }
        ```
*   **Error Handling:**
    *   The system will implement a retry-with-backoff mechanism for API calls.
    *   If the AI analysis fails after 3 retries, the AI portion of the score is omitted, and an alert is sent to an Admin.

## 6. DATABASE ARCHITECTURE

The database will be a PostgreSQL instance managed by Supabase.

*   **Full Relational Schema:** The complete SQL schema is defined in the `energy_capital_match_mvp_design.md` document and will be migrated to a dedicated `supabase/schema.sql` file.
*   **Indexing Strategy:** Indexes are created on foreign keys and frequently queried columns (e.g., `status`, `project_stage`, `capital_requirement_zmw`) to ensure query performance.
*   **Row Level Security (RLS):** RLS is enabled on all tables holding sensitive data. Policies are defined in the design document and restrict data access based on the authenticated user's role and organization, ensuring users can only see and modify data they own or are permitted to view.

## 7. BACKEND ARCHITECTURE

*   **API Route Structure:** The backend uses Next.js API Routes. Routes are organized by resource (e.g., `/api/projects`, `/api/users`).
*   **Service Layer Separation:** Business logic is abstracted into a service layer, separate from the API route handlers, to improve modularity and testability.
*   **Background Jobs:** Google Cloud Functions will be used for asynchronous tasks like sending emails, running the scoring engine, and recalculating matches.
*   **Logging & Audit Trail:** An `audit_logs` table records all critical mutations (Create, Update, Delete) and state changes, capturing who made the change and when.

## 8. FRONTEND ARCHITECTURE

*   **Folder Structure:** The frontend follows the standard Next.js 14 App Router structure (`/app`). Reusable components are located in `/components`, business logic in `/lib`, and state management in `/hooks`.
*   **Component Architecture:** The UI is built with React and Tailwind CSS, using a combination of shadcn/ui for primitives and custom-built components for specialized UI patterns.
*   **State Management:** A combination of React Server Components for data fetching and React Context/Hooks for managing client-side state (like the authenticated user).
*   **Role-Based Routing:** A middleware (`/middleware.ts`) checks the user's role and protects routes, redirecting them if they lack the necessary permissions.

## 9. ENGAGEMENT WORKFLOW STATE MACHINE

The state machine governs the lifecycle of a deal on the platform.

*   **Allowed States:**
    *   `INTRO_SENT`
    *   `INTRO_ACCEPTED`
    *   `DUE_DILIGENCE`
    *   `TERM_SHEET`
    *   `CONTRACT_SIGNED`
    *   `CAPITAL_COMMITTED`
    *   `CLOSED`
    *   `DROPPED` (can be entered from any state)
*   **Transition Rules:** Transitions are linear and enforced by the backend. For example, a deal cannot move to `TERM_SHEET` without first being in `DUE_DILIGENCE`.
*   **Triggers:** State transitions are triggered by user actions in the UI (e.g., clicking "Accept Introduction").
*   **Notification Triggers:** Every state change triggers an in-app and email notification to all participants in the engagement.

## 10. SECURITY & COMPLIANCE

*   **Authentication:** Handled by Firebase Auth (JWT-based).
*   **Authorization:** Enforced at multiple levels:
    *   Route-level via Next.js middleware.
    *   API-level via checks within each route handler.
    *   Database-level via Supabase RLS policies.
*   **Document Storage:** All sensitive documents are stored in a private Google Cloud Storage bucket. Access is granted only through short-lived signed URLs generated by the backend, preventing direct, unauthorized access.
*   **Input Sanitization:** All user input is validated and sanitized on the backend to prevent XSS and other injection attacks.

## 5. SCORING ENGINE SPECIFICATION

## 6. DATABASE ARCHITECTURE

## 7. BACKEND ARCHITECTURE

## 8. FRONTEND ARCHITECTURE

## 9. ENGAGEMENT WORKFLOW STATE MACHINE

## 10. SECURITY & COMPLIANCE

## 11. PHASED DEVELOPMENT PLAN

The project will be developed in seven distinct phases. A detailed breakdown of each phase, including deliverables, dependencies, and testing criteria, is located in the `build_plan.md` document.

*   **Phase 1: Core infrastructure stabilization** - Solidify auth, database, and hosting.
*   **Phase 2: Project submission module** - Build the complete workflow for developers to submit projects.
*   **Phase 3: Scoring engine** - Implement the Capital and Technical readiness scoring.
*   **Phase 4: Matching engine** - Build the background jobs to calculate compatibility scores.
*   **Phase 5: Engagement workflow** - Implement the state machine and messaging for deal-making.
*   **Phase 6: Admin & analytics** - Build the necessary tools for platform oversight.
*   **Phase 7: Hardening, performance & production launch** - Final testing, optimization, and go-live.

## 12. NON-FUNCTIONAL REQUIREMENTS

*   **Performance:**
    *   API response times should be < 200ms for 95% of requests.
    *   Page load times (Largest Contentful Paint) should be < 2.5 seconds.
*   **Scalability:**
    *   The system should be designed to handle an initial load of 1,000 concurrent users.
    *   Backend services (Cloud Run, Cloud Functions) should be configured to auto-scale based on traffic.
*   **Uptime:** The platform should have a 99.9% uptime target.
*   **Monitoring:**
    *   Set up uptime monitoring (e.g., Google Cloud Monitoring).
    *   Implement error tracking and logging (e.g., Sentry, Logtail).
*   **Backup & Disaster Recovery:** Supabase provides automated daily backups. A formal disaster recovery plan will be documented prior to launch.

## 13. MVP VS POST-MVP ROADMAP

### MVP (Launch Version - Zambia Focus)
*   All core modules defined in this PRD, with a focus on the Zambia market.
*   Roles: Developer, Capital Partner, Admin.
*   Manual Technical Readiness Scoring performed by Admin.
*   Basic analytics dashboard for Admins.

### v1.1 (Fast Follow)
*   Onboard Technical Partners and Grant Providers as active roles.
*   Enable automated Technical Matching.
*   Introduce user-facing analytics.
*   Allow users to manage their notification preferences.

### v2.0 (Expansion)
*   Expand to new geographic markets (e.g., Kenya, Nigeria).
*   Introduce multi-currency support.
*   Advanced analytics and market intelligence reports.
*   Integrate with third-party data providers for enhanced project validation.

### Long-Term Vision
*   Integrate carbon finance and carbon credit marketplaces.
*   Build a mobile application.
*   Develop a B2B API for partners to integrate with the platform.
*   Become the definitive source for energy project intelligence in emerging markets.

## 12. NON-FUNCTIONAL REQUIREMENTS

## 13. MVP VS POST-MVP ROADMAP

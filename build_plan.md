# Energy Capital Match - Phased Build Plan

## Phase 1: Core infrastructure stabilization

*   **Objectives:**
    *   To ensure the foundational technology stack is robust, secure, and ready for feature development.
    *   To solidify the authentication and database setup.
*   **Deliverables:**
    *   Production-ready Firebase and Supabase projects.
    *   Next.js application hosted on Google Cloud Run or Firebase Hosting.
    *   CI/CD pipeline for automated deployments.
    *   Finalized SQL schema applied to the Supabase database, including RLS policies.
    *   Comprehensive logging and error tracking setup.
*   **Dependencies:**
    *   Finalized tech stack decisions.
    *   Access to Google Cloud and Supabase accounts.
*   **Testing Criteria:**
    *   Users can successfully sign up, log in, and log out.
    *   RLS policies correctly restrict access to data.
    *   Automated deployments to a staging environment are successful.
*   **Definition of Done:** The core infrastructure is stable, and the development team can begin building product features on a secure and scalable foundation.

## Phase 2: Project submission module

*   **Objectives:**
    *   To build the end-to-end workflow for Project Developers to create and submit projects.
    *   To implement the necessary UI and backend logic for user and company profiles.
*   **Deliverables:**
    *   User profile creation and editing functionality.
    *   Company profile creation and editing for all core roles.
    *   Multi-step project creation form, including document uploads.
    *   A dashboard for developers to view and manage their projects.
    *   Backend API endpoints to support all CRUD operations for projects and profiles.
    *   Admin interface for verifying new organizations.
*   **Dependencies:**
    *   Phase 1 (Core Infrastructure) must be complete.
    *   Finalized UI/UX designs for the dashboard and forms.
*   **Testing Criteria:**
    *   A developer can create a project, fill in all required fields, upload documents, and submit it for review.
    *   An admin can see the submitted project and the verified/unverified status of the company.
    *   Input validation and error handling work correctly on all forms.
*   **Definition of Done:** The platform can successfully onboard developers and ingest complete project data, ready for the scoring and matching phases.

## Phase 3: Scoring engine

*   **Objectives:**
    *   To implement the automatic Capital Readiness Scoring engine.
    *   To build the manual Technical Readiness Scoring workflow.
*   **Deliverables:**
    *   A Google Cloud Function that orchestrates the scoring process.
    *   Integration with the Gemini API for document analysis.
    *   The backend logic to calculate and store all components of the project scores.
    *   A UI for Admins to submit Technical Readiness scores.
    *   A "Scoring" tab on the project details page for developers to view their results.
*   **Dependencies:**
    *   Phase 2 (Project Submission) must be complete.
    *   A Google Cloud project with billing enabled for the Gemini API.
*   **Testing Criteria:**
    *   Submitting a project successfully triggers the scoring Cloud Function.
    *   The AI analysis returns a structured JSON object as expected.
    *   The final score is calculated correctly and saved to the database.
    *   Admins can successfully submit a manual technical score.
*   **Definition of Done:** Projects submitted to the platform are automatically scored for capital readiness, and a workflow exists for manual technical scoring.

## Phase 4: Matching engine

*   **Objectives:**
    *   To build the backend systems that match projects with capital and technical partners.
*   **Deliverables:**
    *   A scheduled background job that calculates compatibility scores.
    *   The implementation of the capital and technical matching algorithms.
    *   Database tables (`capital_match_results`, `technical_match_results`) to store the results.
    *   A "My Matches" UI for both developers and capital partners.
*   **Dependencies:**
    *   Phase 2 (Project Submission) and Phase 3 (Scoring) are complete.
*   **Testing Criteria:**
    *   The matching job runs successfully on a schedule or when triggered.
    *   Compatibility scores are calculated correctly based on the defined formulas.
    *   Users see a ranked list of their top 5 matches.
*   **Definition of Done:** The platform can intelligently and automatically connect relevant parties, fulfilling its core value proposition.

## Phase 5: Engagement workflow

*   **Objectives:**
    *   To build the tools for users to interact and move deals forward after a match is made.
*   **Deliverables:**
    *   The backend state machine for managing engagement lifecycle.
    *   An "Engagement Details" page showing the deal status and history.
    *   A secure messaging system for engagement participants.
    *   A secure data room for sharing documents within an engagement.
    *   In-app and email notifications for all engagement-related events.
*   **Dependencies:**
    *   Phase 4 (Matching) must be complete.
*   **Testing Criteria:**
    *   Users can accept a match to create an engagement.
    *   The engagement correctly moves through its states based on user actions.
    *   Messages and documents can be exchanged securely between participants.
    *   Notifications are triggered and sent reliably.
*   **Definition of Done:** Users have a fully functional and secure environment to conduct due diligence and close deals.

## Phase 6: Admin & analytics

*   **Objectives:**
    *   To build a comprehensive dashboard for platform administration and moderation.
    *   To provide basic analytics for both admins and users.
*   **Deliverables:**
    *   A role-protected Admin Dashboard.
    *   UI for managing users, verifying companies, and moderating projects.
    *   A platform-level analytics dashboard for key metrics.
    *   A user-level analytics widget showing profile/project performance.
*   **Dependencies:**
    *   All core product modules (Phases 2-5) are complete.
*   **Testing Criteria:**
    *   Admins can successfully perform all moderation and management tasks.
    *   Analytics data is accurate and updates correctly.
*   **Definition of Done:** The internal team has the necessary tools to manage the platform and gain insights into its performance.

## Phase 7: Hardening, performance & production launch

*   **Objectives:**
    *   To prepare the platform for a public, production launch.
    *   To conduct final testing, optimization, and security audits.
*   **Deliverables:**
    *   Completion of a full security audit and penetration test.
    *   Performance optimization of all key queries and frontend pages.
    *   A comprehensive suite of end-to-end tests.
    *   Finalized documentation for the codebase and operational procedures.
    *   The public launch of the platform.
*   **Dependencies:**
    *   All previous phases are complete.
*   **Testing Criteria:**
    *   The platform passes all security and performance benchmarks.
    *   No critical bugs are found in the final round of E2E testing.
*   **Definition of Done:** The Energy Capital Match platform is live, stable, secure, and ready to onboard its first users in Zambia.

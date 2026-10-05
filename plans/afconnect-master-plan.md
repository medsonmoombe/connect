# AfriConnect — Master Project Plan

> **Date:** August 26, 2026
> **Current Status:** ~60% complete (Phases 1–5 done, with the project lifecycle now using explicit authority review; Phase 6–10 pending)
> **Target:** Production-ready product for Zambia market

---

## 1. WHAT I UNDERSTAND ABOUT THE SYSTEM

### The Core Idea

AfriConnect is a **B2B marketplace** that connects people building renewable energy projects (developers) with the people who fund them (financiers), build them (EPCs), advise them (consultants), and buy their electricity (power traders).

**The unique value:** It's not just a marketplace — it's a **diagnostic system**. When a developer uploads a project, the AI reads the documents, determines what stage the project is at, identifies what's missing (gaps), and recommends the right partners to fill those gaps.

### How Profiles Coordinate

```
Developer uploads project
  ↓
AI analyzes → determines stage → identifies gaps
  ↓
System recommends partner types based on gaps:
  - Missing feasibility study → Consultant
  - Missing EIA → Environmental Consultant
  - Missing financing → Capital Partner (Debt/Equity)
  - Missing EPC → Technical Partner
  - Missing grant → Grant Provider
  ↓
Developer clicks "Find Matching Partners"
  ↓
Sees partners who can cover their specific gaps
  ↓
Developer sends "Request for Quote" or "Request for Meeting"
  ↓
Partner receives notification → accepts/declines
  ↓
If accepted → Engagement created → deal workflow begins
  ↓
Messaging → Data Room → Due Diligence → Term Sheet → Close
```

### The Five Roles (Plus Admin)

| Role | What They Do | What They Need | What They Get |
|---|---|---|---|
| **Developer** | Builds energy projects | Capital, technical partners, consultants | Gap analysis, matched partners, deal tracking |
| **Financier** | Funds projects | Investable projects | Pre-vetted projects, readiness scores, deal workflow |
| **EPC** | Constructs projects | Construction contracts | Project matches, technical details, engagement |
| **Consultant** | Advises developers | Projects needing expertise | Gap-matched projects, quote requests, engagements |
| **Grant Provider** | Gives non-dilutive funding | Early-stage projects | Concept/pre-feasibility projects, grant matching |
| **Power Trader** | Buys electricity | Projects with PPA potential | PPA-ready projects, offtake matching |
| **Admin** | Manages platform | Full visibility | Verification, moderation, analytics, overrides |
| **Authority / Regulator** | Reviews projects for compliance | Submitted projects awaiting review | Review queue, decision tools, history |

### Project Lifecycle (current)

```
draft ──submit──▶ scoring ──AI done──▶ under_review
                                          │
                            ┌─────────────┴─────────────┐
                            │                           │
                       APPROVE                        RETURN
                            │                           │
                            ▼                           ▼
                          live                     draft (with comments)
```

Key behaviour:

- **No 24h auto-activation.** A project only goes `live` when a human
  reviewer (authority / platform admin) approves it.
- **AI score is hidden from the developer** while the project is in
  `scoring`, `scoring_retry`, or `under_review`. It is revealed when the
  project is `live` (approved) or `draft` with a `rejection_reason`
  (returned for changes).
- **Returned projects** show the reviewer's comment + score on the
  developer's project listing and detail page, with a one-click "Edit &
  resubmit" link.
- **Every reviewer decision is logged** in the `project_reviews` table and
  visible to the developer and to other reviewers as a Review History
  timeline on the project page.

---

## 2. WHAT'S BUILT (Phases 1–5) ✅

### Phase 1: Core Infrastructure ✅
- [x] Supabase auth (email/password, invite tokens)
- [x] MFA (TOTP for admins/owners)
- [x] Session timeout (24hr)
- [x] Rate limiting (3-tier: ioredis, Upstash, in-memory)
- [x] RBAC (platform admin vs org member)
- [x] RLS policies (migration 047)
- [x] Audit logging
- [x] Security headers (CSP, HSTS, X-Frame-Options)
- [x] Middleware (route protection, session refresh)

### Phase 2: Project Submission ✅
- [x] 5-step project creation wizard
- [x] Document upload (PDF, Word, Excel, PowerPoint, images)
- [x] Document hash deduplication
- [x] Proof enforcement (land title, financial close, regulatory approvals)
- [x] Project lifecycle state machine (draft → scoring → under_review → live, or under_review → draft with reviewer comments)
- [x] AI score hidden from developer until `live` or returned-to-`draft`
- [x] Authority / platform-admin review queue with Approve / Return actions
- [x] `project_reviews` table — every reviewer decision logged with comments + status transition
- [x] Review History section on the project page (visible to developer + reviewer)
- [x] Developer dashboard with project management

### Phase 3: AI Scoring ✅
- [x] Gemini integration (2.5-flash model)
- [x] Multi-format document reading (PDF/images native, Excel/Word via text extraction)
- [x] 3-dimension scoring (Regulatory 40%, Financial 35%, Developer 25%)
- [x] Per-document analysis (type detection, authenticity, relevance)
- [x] Project stage determination (8-stage taxonomy)
- [x] Risk signal identification
- [x] Recommendation generation
- [x] Document integrity gate (all docs unsupported → Concept stage)
- [x] Retry logic with exponential backoff
- [x] Fallback scores on AI failure

### Phase 4: Matching Engine ✅
- [x] Capital matching (6-factor weighted algorithm)
- [x] Technical matching (5-factor weighted algorithm)
- [x] Match results storage with versioning
- [x] Developer "Find Partners" view
- [x] Partner "My Matches" view
- [x] Auto-trigger on profile update / verification

### Phase 5: Engagement & Communication ✅
- [x] Engagement state machine (9 states, role-based transitions)
- [x] Real-time messaging (Supabase Realtime)
- [x] Optimistic UI updates
- [x] 5-minute self-delete window
- [x] Unread message counts
- [x] Project data room (upload, classify, download)
- [x] Engagement data room (NDA, term sheet, contract, supporting)
- [x] Document access logging
- [x] Signed URLs (15-min expiry)
- [x] In-app notifications

### All Profile Dashboards ✅
- [x] Developer dashboard (projects, matches, gap analysis, AI insights, find partners)
- [x] Investor/Capital Partner dashboard (marketplace, matches, portfolio, messages, bookmarks, profile, reports)
- [x] Technical Partner dashboard (marketplace, matches, portfolio, messages, profile)
- [x] Grant Provider dashboard (marketplace, engagements, profile)
- [x] Power Trader dashboard (marketplace, engagements, profile)
- [x] Admin dashboard (overview, verification, projects, companies, engagements, AI overview, audit logs)

---

## 3. WHAT NEEDS TO BE BUILT (Phases 6–10)

### Phase 6: Gap-Based Matching & Consultant Role 🔜

**Priority: CRITICAL — This is the core differentiator**

#### 6.1 Consultant Profile Type
- [ ] Add `consultant` role to the role enum
- [ ] Create `consultants` table (expertise, specializations, references, availability, certifications)
- [ ] Build consultant registration manifest
- [ ] Build consultant dashboard (marketplace, matches, engagements, profile)
- [ ] Add consultant to sidebar navigation
- [ ] Update RBAC permissions for consultant role

#### 6.2 Gap-Based Matching Improvements
- [ ] Enhance AI analysis to produce structured gap list
- [ ] Create gap → partner type mapping table
- [ ] Update matching engine to use gap-based rules (not just stage)
- [ ] Add "Recommended Partners" section to project page
- [ ] Show which gaps each recommended partner can fill
- [ ] Add match explanation ("why this partner?")

#### 6.3 Stage-to-Partner Enforcement
- [ ] Update `project-stages.ts` with meeting discussion rules
- [ ] Concept/Pre-Feasibility → only Consultant + Grant Provider
- [ ] Full Feasibility → Consultant + Financial Advisory
- [ ] Regulatory → Consultant (Legal, Environmental)
- [ ] PPA Ready → Financial Partners
- [ ] Financial Close → EPC + O&M
- [ ] Construction → O&M + EPC
- [ ] Operation → O&M
- [ ] Enforce in "Find Partners" view — only show valid partner types for current stage

#### 6.4 Request for Quote / Meeting Flow
- [ ] Build request form (request type, gaps to fill, message, project summary)
- [ ] Create `partner_requests` table
- [ ] API endpoint for sending requests
- [ ] API endpoint for accepting/declining
- [ ] Notification on request received
- [ ] Notification on request accepted/declined
- [ ] Auto-create engagement on acceptance
- [ ] Request history view for both parties

#### 6.5 Dynamic Form System
- [ ] Define form field schema (TypeScript interface)
- [ ] Build `DynamicFormRenderer` component
- [ ] Create manifest files for: onboarding, project creation, partner profiles
- [ ] Add `helperText` to all fields
- [ ] Add `dependsOn` conditional logic
- [ ] Add `schema: 'jsonb'` support for extra fields
- [ ] Server-side JSONB column handling
- [ ] Migrate existing forms to manifests (or keep as progressive enhancement)

---

### Phase 7: UI Maturity & Polish 🔜

**Priority: HIGH — Makes the difference between MVP and product**

#### 7.1 Responsive Mobile Layout
- [ ] Add hamburger menu for mobile
- [ ] Stack dashboard cards on mobile
- [ ] Responsive sidebar (drawer on mobile)
- [ ] Touch-friendly buttons and inputs
- [ ] Test on iOS Safari and Android Chrome

#### 7.2 Sidebar Redesign
- [ ] Collapsible sections (Main, Workspace, Account)
- [ ] Max 7 top-level items visible
- [ ] Active state indicator (green bar)
- [ ] User avatar + role badge at top
- [ ] System status widget at bottom

#### 7.3 Document Viewer
- [ ] Inline PDF viewer (pdf.js or similar)
- [ ] Image preview (lightbox)
- [ ] Excel/CSV preview (table view)
- [ ] Document metadata panel (type, uploaded by, date, classification)
- [ ] Version history view

#### 7.4 Marketplace Improvements
- [ ] Filter sidebar (stage, sector, country, size range, technology)
- [ ] Sort options (newest, highest score, largest, closest)
- [ ] Grid/list view toggle
- [ ] Project comparison (select 2–3 projects, compare side-by-side)
- [ ] Map view (Zambia provinces)

#### 7.5 Charts & Analytics
- [ ] Install Recharts or Tremor
- [ ] Admin: user growth chart, project funnel, capital pipeline
- [ ] Developer: project views, match trends, engagement funnel
- [ ] Investor: portfolio distribution (pie by sector, bar by stage)
- [ ] Partner: match acceptance rate, engagement success

#### 7.6 Design System
- [ ] Define design tokens (spacing, typography, colors, shadows)
- [ ] Standardize border-radius (pick 2–3 values max)
- [ ] Increase text sizes (minimum 12px for body, 14px for labels)
- [ ] Add focus states for accessibility
- [ ] Consistent empty states with illustrations
- [ ] Consistent loading skeletons for every async section

#### 7.7 Dark Mode
- [ ] Add dark mode CSS variables
- [ ] Toggle in settings
- [ ] Respect system preference
- [ ] Test all components in dark mode

#### 7.8 Accessibility
- [ ] WCAG 2.1 AA audit
- [ ] Keyboard navigation for all interactive elements
- [ ] Focus management for modals/drawers
- [ ] Screen reader labels for icons
- [ ] Color contrast compliance

---

### Phase 8: Performance & Scale 🔜

**Priority: HIGH — Required for 1000+ users**

#### 8.1 Caching
- [ ] Configure Redis (Upstash recommended)
- [ ] Cache hot paths: marketplace listings, match results, user profiles
- [ ] React Query stale times: 5min for marketplace, 30s for messages, 1hr for profiles

#### 8.2 Pagination
- [ ] Server-side pagination on all list endpoints
- [ ] Cursor-based pagination for infinite scroll
- [ ] Page size: 20 items default, configurable
- [ ] Total count in response meta

#### 8.3 Virtual Scrolling
- [ ] Install react-window or react-virtuoso
- [ ] Apply to: marketplace listings, engagement list, message history
- [ ] Skeleton loading during scroll

#### 8.4 Background Jobs
- [ ] Install BullMQ + Redis
- [ ] Move AI analysis to background job queue
- [ ] Job status tracking (pending → processing → complete/failed)
- [ ] Retry failed jobs (3 attempts)
- [ ] Dead letter queue for permanently failed jobs

#### 8.5 Database Optimization
- [ ] Audit all queries for missing indexes
- [ ] Add indexes on: `projects(developer_id, status)`, `engagements(project_id, status)`, `messages(engagement_id, created_at)`
- [ ] Connection pooling (PgBouncer or Supabase pooled)
- [ ] Query plan analysis for slow queries

#### 8.6 CDN & Static Assets
- [ ] Configure CDN for images and static files
- [ ] Lazy load below-fold images
- [ ] Compress images (WebP conversion)
- [ ] Prefetch next-page resources

---

### Phase 9: Production Hardening 🔜

**Priority: MEDIUM — Required before public launch**

#### 9.1 Monitoring & Observability
- [ ] Install Sentry for error tracking
- [ ] Structured logging (Pino)
- [ ] Health check endpoint (`/api/health`)
- [ ] Uptime monitoring (BetterStack or similar)
- [ ] Performance monitoring (Vercel Analytics or Datadog)

#### 9.2 Environment & Configuration
- [ ] Zod schema for environment variables (fail on startup if missing)
- [ ] Separate configs: development, staging, production
- [ ] Secrets management (not in .env files)
- [ ] Feature flags (GrowthBook or database flags)

#### 9.3 CI/CD
- [ ] GitHub Actions pipeline: lint → test → build → deploy
- [ ] Staging environment (auto-deploy from development branch)
- [ ] Production deployment (manual trigger from main branch)
- [ ] Database migration automation
- [ ] Rollback capability

#### 9.4 Security Audit
- [ ] Penetration test (basic)
- [ ] RLS policy review
- [ ] CSP audit (remove unsafe-eval if possible)
- [ ] Input sanitization (DOMPurify for user content)
- [ ] Magic-byte file validation for uploads
- [ ] CSRF protection review
- [ ] Dependency audit (npm audit)

#### 9.5 Testing
- [ ] Unit tests for: state machines, scoring formulas, matching algorithms, RBAC
- [ ] Integration tests for: API endpoints, auth flows, file uploads
- [ ] E2E tests for: signup → project creation → scoring → matching → engagement
- [ ] Load testing: 1000 concurrent users simulation
- [ ] Target: 80% code coverage on business logic

#### 9.6 Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Developer setup guide
- [ ] Deployment guide
- [ ] User guides per role
- [ ] Admin operations manual

---

### Phase 10: Launch & Growth

#### 10.1 Launch Preparation
- [ ] Seed data: 5–10 test projects, 2–3 partners per type
- [ ] Beta testing with 5–10 real users
- [ ] Bug bash (team-wide testing session)
- [ ] Performance benchmarking
- [ ] Security sign-off

#### 10.2 Launch
- [ ] Production deployment
- [ ] Invite first batch of real users
- [ ] Monitor error rates, performance, user feedback
- [ ] Daily standup for first 2 weeks

#### 10.3 Post-Launch Iteration
- [ ] Collect user feedback (in-app form)
- [ ] Weekly release cycle
- [ ] Feature prioritization based on usage data
- [ ] A/B testing for key flows

---

## 4. CRITICAL PATH

The **most important features** to build next (in order):

1. **Consultant role** — without it, the gap-based matching doesn't work end-to-end
2. **Gap-based matching improvements** — this is the core differentiator
3. **Request for Quote/Meeting flow** — this is how deals start
4. **Stage-to-partner enforcement** — ensures recommendations are accurate
5. **Dynamic form system** — makes future form changes easy
6. **Responsive mobile layout** — most users will access via phone
7. **Pagination + caching** — required for performance at scale
8. **Background job queue** — AI analysis blocks the API currently
9. **Document viewer** — users shouldn't have to download to view
10. **Charts/analytics** — makes dashboards useful

---

## 5. ESTIMATED TIMELINE

| Phase | Effort | Duration | Status |
|---|---|---|---|
| Phase 1–5 (Built) | ~60% of total | Done | ✅ |
| Phase 6: Gap Matching + Consultant | ~2 weeks | Week 1–2 | 🔜 |
| Phase 7: UI Polish | ~2 weeks | Week 3–4 | 🔜 |
| Phase 8: Performance | ~1 week | Week 5 | 🔜 |
| Phase 9: Hardening | ~1 week | Week 6 | 🔜 |
| Phase 10: Launch Prep + Launch | ~1 week | Week 7 | 🔜 |
| **Total to Production** | | **~7 weeks** | |

---

## 6. KEY DECISIONS NEEDED

Before proceeding, these decisions should be confirmed:

1. **Consultant role naming** — "Consultant" or "Advisory Partner" or something else?
2. **Dynamic forms** — full migration or progressive enhancement alongside existing forms?
3. **Pagination approach** — cursor-based (infinite scroll) or page-based (traditional)?
4. **Background jobs** — BullMQ + Redis or cloud-native (Vercel Cron, Inngest)?
5. **Charts library** — Recharts, Tremor, or Nivo?
6. **Document viewer** — PDF.js, react-pdf, or embedded Google Docs viewer?
7. **Mobile strategy** — responsive web first, or native app later?
8. **Analytics provider** — Vercel Analytics, Mixpanel, or self-hosted?

---

*This plan reflects the current state of AfriConnect as of August 26, 2026.*

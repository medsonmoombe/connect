# AfriConnect — Developer Profile: World-Class Transformation Plan

## Current State: 4/10

Every tab shows variations of the same data. The developer page is a 1,872-line monolith where each tab is a different arrangement of project cards and match lists. No tab has unique, purposeful intelligence.

---

## Target State: 9/10

Each page is a **distinct tool** with its own purpose, data flow, and intelligence. The developer profile becomes a **project management cockpit** — not a list of cards.

---

## Architecture: Break the Monolith

**Current:** 1 file (1,872 lines) with 9 tabs inline.

**Target:** Each tab is its own file under `components/developer/`:

```
components/developer/
├── OverviewDashboard.tsx      # Command center — alerts, timeline, risk signals
├── ProjectIntelligence.tsx    # Deep project analysis — not just a list
├── FindPartnersEngine.tsx     # Gap-based matching with recommendations
├── GapResolutionTracker.tsx   # Who's fixing what, status, deadlines
├── StageGateControl.tsx       # Stage progression with blockers
├── AiInsightsDashboard.tsx    # Document Checker + Readiness + Risk + Predictions
├── DealRoom.tsx               # Secure document exchange per project
├── MessagesInbox.tsx          # Unified inbox with context
├── PortfolioAnalytics.tsx     # Real analytics with trends and benchmarks
└── DeveloperSettings.tsx      # Company profile, team, notifications
```

---

## Page-by-Page Transformation

### 1. Overview Dashboard (Command Center)

**Current:** Shows "Inbound Interest" list + "Project Stages" list — duplicates other tabs.

**New:** A true command center with **alerts, timeline, and risk signals**.

| Section | Content | Intelligence |
|---------|---------|-------------|
| **Risk Alerts** | Projects with overdue stages, missing documents, expiring approvals | Color-coded severity, one-click to fix |
| **Project Timeline** | Gantt-style view of all projects across stages | Shows where each project sits in the lifecycle |
| **Active Engagements** | Deals in progress with status + next action needed | System tells you what to do next |
| **Capital Pipeline** | Total capital being pursued, committed, closed | Financial overview of your portfolio |
| **Platform Activity** | Recent partner views, interest signals, document downloads | Know who's looking at your projects |
| **Quick Actions** | Context-aware — shows actions based on current project states | Not static links, but dynamic based on what needs attention |

### 2. Project Intelligence (My Projects → Enhanced)

**Current:** Search + filter + sort list of projects with basic cards.

**New:** Each project card is an **intelligence unit** showing:

| Card Element | Data | Why |
|-------------|------|-----|
| **Readiness Score** | Visual gauge (not just number) | Instant visual assessment |
| **Stage Progress** | Mini pipeline showing current + next + blockers | Know what's holding you back |
| **Risk Signals** | Red/amber/green indicators for each dimension | See problems before they become blockers |
| **Document Status** | "5/8 documents uploaded" with missing count | Know what's missing at a glance |
| **Partner Interest** | "3 investors viewed, 1 expressed interest" | Social proof + urgency |
| **Last Activity** | "Analyzed 2 days ago, 1 new match" | Freshness indicator |
| **Capital Gap** | "$12M of $45M secured" | Financial progress |
| **Time in Stage** | "32 days at Pre-Feasibility" | Aging indicator |

**Actions per project:**
- View Full Analysis
- Find Partners (gap-based)
- Upload Documents
- Request Quote from Consultant
- View Engagement History

### 3. Find Partners Engine (Gap-Based Matching)

**Current:** Shows capital + technical match lists with scores.

**New:** An **intelligent matching engine** that:

1. **Identifies gaps** in the project (from AI analysis)
2. **Maps gaps to partner types** (missing EIA → Environmental Consultant)
3. **Recommends specific partners** who can fill those gaps
4. **Shows match quality** with explanation (not just a score)
5. **Provides action buttons** — Request Quote, Request Meeting, View Profile

| Section | Content |
|---------|---------|
| **Gap → Partner Mapping** | Visual: Gap card → Arrow → Recommended partner type → Specific partners |
| **Partner Profiles** | Company name, specializations, regions, MW experience, certifications |
| **Match Explanation** | "This partner matches because: (1) specializes in EIA, (2) operates in Zambia, (3) has completed 12 similar projects" |
| **Request Flow** | Request Quote → Partner receives with project summary → Responds with proposal |
| **Comparison** | Side-by-side comparison of 2-3 partners for the same gap |

### 4. Gap Resolution Tracker

**Current:** GapMatrix component shows gaps as a list.

**New:** A **project management board** for closing gaps:

| Column | Content |
|--------|---------|
| **Identified** | Gaps detected by AI, not yet assigned |
| **In Progress** | Gaps assigned to a partner/consultant, work underway |
| **Under Review** | Documents submitted, awaiting verification |
| **Resolved** | Gaps closed with evidence |

**Per gap card:**
- Gap description (from AI analysis)
- Why it's required (stage gate requirement)
- Recommended partner type
- Assigned partner (if any)
- Deadline (if set)
- Evidence uploaded (documents)
- Readiness impact (+5% when resolved)

### 5. Stage Gate Control

**Current:** ProjectStageFlow shows a visual pipeline.

**New:** A **stage gate enforcement system**:

| Section | Content |
|---------|---------|
| **Current Stage** | Large visual indicator with requirements checklist |
| **Requirements** | What's needed to advance: documents, approvals, financial milestones |
| **Blockers** | Red items blocking progression — each with a "Fix" action |
| **Estimated Time** | Based on similar projects, how long this stage typically takes |
| **Stage History** | When you entered each stage, how long you spent |
| **Peer Benchmark** | "Projects similar to yours typically take 45 days at this stage" |
| **Next Stage Preview** | What will be required at the next stage |

### 6. AI Insights Dashboard

**Current:** AiInsightsPanel shows scores + document analysis.

**New:** A **multi-module intelligence dashboard**:

| Module | Content |
|--------|---------|
| **Document Checker** | Uploaded docs → analysis → what's missing → what's weak |
| **Readiness Engine** | Weighted score by category → breakdown → trend over time |
| **Risk Engine** | Risk signals by dimension → severity → mitigation recommendations |
| **Predictive Analytics** | "Based on your profile, estimated time to financial close: 8-12 months" |
| **Benchmarking** | "Your project scores higher than 73% of similar projects on the platform" |
| **Recommendation Engine** | "To improve your score by 15%, you need: (1) ESIA report, (2) Grid connection study, (3) Updated financial model" |

### 7. Deal Room (Data Room → Enhanced)

**Current:** DataRoomTab shows upload/download per project.

**New:** A **secure deal room** for each project:

| Feature | Description |
|---------|-------------|
| **Folder Structure** | Organized by category (Legal, Financial, Technical, Environmental) |
| **Version Control** | Track document versions, who uploaded what, when |
| **Access Control** | Per-partner access — "Investor X can see Legal + Financial, not Technical" |
| **Document Preview** | In-browser PDF/image preview without download |
| **Audit Trail** | Who viewed, when, what they downloaded |
| **Expiry Management** | Documents with expiration dates (approvals, licenses) |
| **Watermarking** | Downloaded documents get watermarked with viewer info |
| **Bulk Upload** | Drag-and-drop multiple files with auto-classification |

### 8. Messages Inbox

**Current:** MessagesTab shows engagement-based message list.

**New:** A **unified inbox** with context:

| Feature | Description |
|---------|-------------|
| **Conversation List** | All engagements with latest message preview + unread count |
| **Message Thread** | Full conversation history with file attachments |
| **Context Panel** | Shows project details, engagement status, partner profile alongside messages |
| **Quick Actions** | From message: View Project, View Partner Profile, Schedule Meeting |
| **Search** | Full-text search across all messages |
| **Notifications** | Real-time via Supabase Realtime (already enabled) |

### 9. Portfolio Analytics

**Current:** AnalyticsTab shows charts over project list.

**New:** **Business intelligence** dashboard:

| Metric | Visualization |
|--------|--------------|
| **Portfolio Value** | Total capital across all projects |
| **Stage Distribution** | How many projects at each stage |
| **Technology Mix** | Pie chart of solar/wind/hydro/battery |
| **Geographic Heatmap** | Where your projects are located |
| **Readiness Trend** | Line chart showing readiness scores over time |
| **Engagement Funnel** | How many → viewed → interested → engaged → closed |
| **Time Analytics** | Average time per stage, bottleneck identification |
| **Partner Performance** | Which partners are most responsive, fastest to close |

### 10. Developer Settings

**Current:** Basic form with company info + notifications + security.

**Enhanced with:**
- **Team Management** — invite members, assign roles, manage permissions
- **Notification Preferences** — granular control over email/push per event type
- **API Access** — API keys for programmatic access (for enterprise customers)
- **Data Export** — download all your data (GDPR compliance)
- **Account History** — audit log of all actions taken on the account

---

## Server-Side Improvements

| Area | What | Why |
|------|------|-----|
| **API Caching** | Redis cache for project queries (5min TTL) | Performance at scale |
| **Pagination** | Cursor-based pagination on all list endpoints | Handle 1000+ projects |
| **Document Streaming** | Stream large files instead of loading into memory | Handle 100MB+ documents |
| **Webhook System** | Notify external systems on events (engagement created, project scored) | Integration-ready |
| **Audit API** | Queryable audit log endpoint | Compliance + debugging |
| **Rate Limiting** | Per-endpoint rate limits with different tiers | Prevent abuse |
| **Input Validation** | Zod schemas for all API inputs | Type safety + security |

---

## What Makes This World-Class (Not Portfolio)

### 1. Intelligence, Not Just Display
- The system **recommends** actions, not just shows data
- Gap-based matching (not just stage-based)
- Predictive analytics (time-to-close, probability of success)
- Benchmarking against similar projects

### 2. Workflow, Not Just Lists
- Gap Resolution Tracker (Kanban for closing gaps)
- Stage Gate Control (enforcement, not just display)
- Deal Room (secure collaboration, not just upload/download)

### 3. Context, Not Just Content
- Messages show project context alongside conversation
- Dashboard shows alerts based on what needs attention NOW
- Partners are recommended based on specific gaps, not just stage

### 4. Security at Enterprise Level
- Per-partner document access control
- Watermarked downloads
- Audit trail on all actions
- Version control on documents

### 5. Performance at Scale
- Redis caching for frequently accessed data
- Cursor-based pagination
- Document streaming
- Lazy loading on all tabs

---

## Implementation Order

| Phase | What | Effort | Impact |
|-------|------|--------|--------|
| 1 | Break monolith into separate tab components | Medium | Foundation |
| 2 | Rebuild Overview Dashboard as command center | High | High |
| 3 | Enhance Project Intelligence cards | Medium | High |
| 4 | Build Gap Resolution Tracker (Kanban) | High | High |
| 5 | Build Stage Gate Control | Medium | Medium |
| 6 | Enhance AI Insights with benchmarking | Medium | High |
| 7 | Upgrade Deal Room (folders, access control, preview) | High | High |
| 8 | Upgrade Messages (unified inbox, context panel) | Medium | Medium |
| 9 | Build Portfolio Analytics (real charts, trends) | Medium | Medium |
| 10 | Server-side: caching, pagination, webhooks | Medium | High |

**Total estimated effort:** 3-4 weeks for a senior developer

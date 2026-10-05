# Developer Profile — Complete Transformation Plan

## Current State: **7/10** → Target: **10/10**

---

## Phase 1: Foundation — Unified Design System ✅ (DONE)

| Task | Status |
|------|--------|
| Create `dashboard-cards.tsx` with KpiCard, SectionCard, ListItemRow, QuickActionCard, StatusBadge | ✅ |
| Refactor all dashboards to use unified components | ✅ |
| Remove duplicated STATUS_COLORS maps from 5 files | ✅ |

---

## Phase 2: Developer Dashboard Overview (Current → Professional)

### 2.1 Welcome Section Enhancement
**Current:** Generic "Welcome back, {name}" with Export/New Project buttons.
**Target:**
- Welcome message with time-based greeting (Good morning/afternoon/evening)
- Company name and role badge below name
- "Last active" timestamp
- Export button moves to a dropdown (Export PDF / Export CSV / Print)
- New Project button stays prominent with icon

### 2.2 KPI Cards — Add Trend Indicators
**Current:** Static numbers.
**Target:**
- Each KPI shows a sparkline or trend arrow (↑↓) with percentage change from last period
- "Total Projects" → shows change from last month
- "Capital Required" → shows change from last quarter
- "Active Engagements" → shows change from last week
- "Avg. Readiness" → shows change from last analysis

### 2.3 Inbound Interest Section — Add Actions
**Current:** List items with no actions.
**Target:**
- Each item shows a mini-status badge (not just text)
- Add "View" and "Respond" action buttons on hover
- Show engagement age (e.g., "3 days ago")
- Add empty state with CTA: "Share your projects to attract partners"

### 2.4 Project Stages Section — Add Progress Bars
**Current:** Simple list with stage label.
**Target:**
- Each project shows a horizontal progress bar (0-100%) based on stage
- Stage colors: Concept (gray), Pre-Feasibility (blue), Feasibility (indigo), Financial Close (amber), Construction (green)
- Show document count and readiness score inline
- Add "View Stage Flow" link per project

### 2.5 Sidebar Widget — Replace Static Data
**Current:** "Data Room Security" widget with hardcoded document count.
**Target:**
- "Readiness Score" widget showing average readiness with circular progress
- "Quick Stats" mini-widget: Documents uploaded, Gaps identified, Partners matched
- Remove the static "Data Room Security" card (it's not useful)

---

## Phase 3: My Projects Tab (Project Portfolio)

### 3.1 Project List → Project Cards
**Current:** Simple list items with name, capacity, location.
**Target:**
- Rich project cards with:
  - Project name, technology icon, capacity (MW)
  - Location with country flag
  - Stage badge (color-coded)
  - Readiness score with progress bar
  - Capital required
  - Document count
  - Last updated timestamp
  - Quick actions: View, Edit, Find Partners, Run Analysis

### 3.2 Add Filtering & Sorting
**Target:**
- Filter by: Stage, Technology, Country, Readiness Score
- Sort by: Name, Date Created, Readiness Score, Capital Required
- Search bar for project name
- Grid/List view toggle

### 3.3 Add Project Stats Summary
**Target:**
- Total portfolio value
- Average readiness
- Stage distribution (pie chart or bar)
- Technology breakdown

---

## Phase 4: Find Partners Tab

### 4.1 Capital Matches — Upgrade Card Design
**Current:** Basic match card with score and company name.
**Target:**
- Company logo/initials
- Match score with color coding (green 80%+, amber 50-79%, red <50%)
- Investment criteria summary (min/max ticket, preferred stages)
- Geographic focus
- "Request Introduction" button with confirmation modal
- "View Profile" secondary action
- Match explanation (why this partner was matched)

### 4.2 Technical Matches — Upgrade Card Design
**Current:** Basic match card.
**Target:**
- Company logo/initials
- Match score with visual indicator
- Services offered (tags)
- MW delivered, years experience
- Geographic coverage
- "Request Proposal" button with service selection
- "View Profile" secondary action

### 4.3 Add Match Filters
**Target:**
- Filter by match score threshold
- Filter by geographic focus
- Filter by technology type
- Sort by score, company name, experience

### 4.4 Add "Gap-Based Matching" (NEW)
**Target:**
- When AI identifies gaps (missing EIA, feasibility study, etc.)
- Show "Recommended Consultants" section for each gap
- Link to consultant profiles (once Consultant role is built)
- "Request Quote" flow for each gap

---

## Phase 5: Gap Analysis Tab

### 5.1 GapMatrix Upgrade
**Current:** Basic gap matrix with categories.
**Target:**
- Visual gap matrix with:
  - Category cards (Regulatory, Financial, Technical, Environmental, Legal)
  - Each category shows: Items present, Items missing, Items in progress
  - Progress bar per category
  - Total readiness score
- Gap detail view:
  - Missing item name
  - Why it's required
  - Recommended partner type to fill the gap
  - "Find Partners" button for each gap

### 5.2 Add Gap Resolution Tracker
**Target:**
- Track which gaps have been addressed
- Show resolution status: Pending, In Progress, Resolved
- Link to engagement if a partner was engaged to resolve

---

## Phase 6: Project Stages Tab

### 6.1 ProjectStageFlow Upgrade
**Current:** Basic stage visualization.
**Target:**
- Visual stage pipeline with:
  - 8 stages: Concept → Pre-Feasibility → Full Feasibility → Regulatory Approval → Financial Close → Construction → Commissioning → Operational
  - Current stage highlighted
  - Completed stages with checkmarks
  - Future stages grayed out
  - Stage-specific requirements shown below
- Stage transition controls:
  - "Request Stage Upgrade" button
  - "Upload Supporting Documents" per stage
  - Stage approval history

### 6.2 Add Stage Requirements Checklist
**Target:**
- Per-stage document requirements
- Show what's uploaded vs what's missing
- Link to data room for uploading
- AI readiness assessment per stage

---

## Phase 7: AI Insights Tab

### 7.1 AiInsightsPanel Upgrade
**Current:** Basic AI analysis results.
**Target:**
- Dashboard-style layout with:
  - **Document Checker:** List of documents with status (Present/Missing/Partial)
  - **Readiness Engine:** Score breakdown by category with progress bars
  - **Risk Engine:** Risk indicators with severity levels (Low/Medium/High/Critical)
  - **Match Recommendations:** Suggested partners based on gaps
- Re-analyze button with loading state
- Analysis history (when last analyzed, what changed)
- Export analysis as PDF

### 7.2 Add AI Recommendations Panel
**Target:**
- "What to do next" recommendations
- Priority-ordered action items
- Links to relevant tabs (Find Partners, Upload Documents, etc.)

---

## Phase 8: Inbound Interest Tab

### 8.1 Full Inbound Interest View
**Current:** Basic list with status.
**Target:**
- Kanban board view (already exists via KanbanBoard component)
- List view with sorting/filtering
- Each engagement card shows:
  - Partner name and type (Capital/Technical/Consultant)
  - Project name
  - Current status with badge
  - Engagement age
  - Unread message count
  - Quick actions: View, Accept, Decline, Message

### 8.2 Add Engagement Details Preview
**Target:**
- Hover card with engagement summary
- Quick status update without leaving the tab
- Message preview

---

## Phase 9: Data Room Tab

### 9.1 DataRoomTab Upgrade
**Current:** Basic file upload/list.
**Target:**
- Grid/List view toggle
- File type icons (PDF, DOCX, XLSX, etc.)
- File size and upload date
- Document classification (AI-detected type)
- Download with signed URL
- Share with partner (engagement-specific access)
- Folder organization (by category: Financial, Technical, Legal, Environmental)
- Search within documents
- Bulk actions (download all, delete selected)

### 9.2 Add Document Preview
**Target:**
- PDF preview modal
- Image preview
- Document metadata panel
- AI-generated summary of document content

---

## Phase 10: Messages Tab

### 10.1 MessagesTab Upgrade
**Current:** Basic engagement list.
**Target:**
- Full messaging interface with:
  - Conversation list (left panel)
  - Message thread (right panel)
  - Message input with file attachment
  - Read receipts
  - Typing indicators
  - Message search
  - Message filters (by engagement, by date, by type)

### 10.2 Add Notification Preferences
**Target:**
- Email notification settings
- In-app notification settings
- Notification history

---

## Phase 11: Analytics Tab

### 11.1 Analytics Upgrade
**Current:** Basic stat cards with no charts.
**Target:**
- **Charts (using Recharts):**
  - Portfolio value over time (line chart)
  - Readiness score distribution (bar chart)
  - Stage distribution (pie chart)
  - Engagement funnel (bar chart)
  - Technology breakdown (donut chart)
- **Metrics:**
  - Average time to financial close
  - Partner conversion rate
  - Document completeness trend
- **Export:** PDF report generation

---

## Phase 12: Project Creation Wizard (Submit Tab)

### 12.1 Dynamic Form System
**Current:** Hardcoded form fields.
**Target:**
- JSON manifest-driven form rendering
- Each field has: name, type, label, helperText, required, dependsOn
- Radio buttons for yes/no questions
- File upload with drag-and-drop
- Form validation with real-time feedback
- Auto-save draft
- Step progress indicator

### 12.2 Step Enhancements
**Current:** 5-step wizard.
**Target:**
- Step 1: Basic Info (name, technology, location, capacity)
- Step 2: Financial Info (CAPEX, OPEX, funding required)
- Step 3: Documents (upload with classification)
- Step 4: Technical Specs (technology-specific fields)
- Step 5: Review & Submit (summary with AI pre-analysis)

---

## Phase 13: Profile & Settings

### 13.1 Developer Profile Page (NEW)
**Current:** No profile/settings page.
**Target:**
- Company profile editor
- Team members management
- Company verification status
- Notification preferences
- API access (future)
- Billing (future)

### 13.2 Account Settings (NEW)
**Target:**
- Personal info (name, email, phone)
- Password change
- MFA setup
- Session management
- Account deletion

---

## Phase 14: Mobile Responsive

### 14.1 Responsive Layout
**Current:** Desktop-only layout.
**Target:**
- Mobile-first responsive design
- Collapsible sidebar on mobile
- Bottom navigation bar on mobile
- Touch-friendly cards and buttons
- Responsive grid layouts
- Mobile-optimized forms

---

## Phase 15: Performance Optimization

### 15.1 Caching
**Target:**
- React Query for API data caching
- Optimistic updates for mutations
- Background data refresh
- Stale-while-revalidate pattern

### 15.2 Code Splitting
**Target:**
- Lazy load tab content
- Dynamic imports for heavy components
- Route-based code splitting

### 15.3 Bundle Optimization
**Target:**
- Tree shaking verification
- Image optimization (Next.js Image component)
- Font optimization
- CSS extraction

---

## Implementation Order (Priority)

| Priority | Phase | Estimated Effort |
|----------|-------|-----------------|
| 1 | Phase 2: Dashboard Overview Enhancement | 2 hours |
| 2 | Phase 3: My Projects Tab Upgrade | 3 hours |
| 3 | Phase 4: Find Partners Tab Upgrade | 3 hours |
| 4 | Phase 6: Project Stages Tab Upgrade | 2 hours |
| 5 | Phase 7: AI Insights Tab Upgrade | 3 hours |
| 6 | Phase 5: Gap Analysis Tab Upgrade | 2 hours |
| 7 | Phase 10: Messages Tab Upgrade | 4 hours |
| 8 | Phase 9: Data Room Tab Upgrade | 3 hours |
| 9 | Phase 11: Analytics Tab Upgrade | 3 hours |
| 10 | Phase 8: Inbound Interest Tab Upgrade | 2 hours |
| 11 | Phase 12: Project Creation Wizard | 4 hours |
| 12 | Phase 13: Profile & Settings | 3 hours |
| 13 | Phase 14: Mobile Responsive | 4 hours |
| 14 | Phase 15: Performance Optimization | 3 hours |

**Total Estimated Effort: ~41 hours**

---

## Key Design Principles

1. **No Duplication:** Dashboard shows overview, tabs show detail
2. **Consistent Cards:** All cards use `KpiCard`, `SectionCard`, `ListItemRow`, `QuickActionCard`
3. **Real Data:** No hardcoded values, all data from API
4. **Action-Oriented:** Every section has clear CTAs
5. **Mobile-First:** Design for mobile, enhance for desktop
6. **Performance:** Lazy load, cache, optimize

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Dashboard load time | ~3s | <1.5s |
| Time to first meaningful paint | ~2s | <1s |
| Mobile responsiveness | 0% | 100% |
| Unique content per tab | 40% | 100% |
| Hardcoded values | 15+ | 0 |
| Consistent card styles | 60% | 100% |

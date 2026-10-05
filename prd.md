# AfriConnect — Product Requirements Document (PRD)

> **Version:** 3.0 — August 2026
> **Platform Name:** AfriConnect
> **Tagline:** The Intelligence Layer for African Infrastructure
> **Focus Market:** Zambia (MVP), expanding to East & Southern Africa

---

## 1. PRODUCT OVERVIEW

### 1.1. Product Vision

AfriConnect is a B2B platform that connects renewable energy project developers with the right consultants, financiers, EPC contractors, and grant providers to take projects from concept to implementation. The platform diagnoses what a project is missing, identifies the gaps, and connects developers with the partners who can fill those gaps.

**One sentence:** AfriConnect helps renewable energy developers identify what their projects are missing, find the right partners to fill those gaps, assess project readiness, and ultimately move projects from an idea to financing and implementation.

### 1.2. Core Workflow

```
Register → Create Project → Upload Documents → AI Analysis → Under Authority Review
  → Approve (→ Live)  |  Return with comments (→ Draft, developer iterates, resubmits)
  → Match With Partners → Select EPC → Financial Close → Implementation
```

The **Under Authority Review** step is explicit: after the developer submits a
project, it lands in the authority / platform-admin review queue. AI scores are
written but hidden from the developer until the reviewer either approves the
project (→ `live`, scores revealed) or returns it with comments (→ `draft`,
scores revealed so the developer can iterate). There is no auto-activation
timer — the project only goes live when a human reviewer decides.

### 1.3. The Five Systems

AfriConnect is five systems combined into one:

| System | Purpose |
|---|---|
| **Project System** | Create projects, upload docs, track lifecycle |
| **AI / Readiness Engine** | Gap detection, readiness scoring, risk analysis, recommendations |
| **Marketplace** | Browse consultants, financiers, EPCs, grant providers |
| **Matching Engine** | Connect developers with the right partners based on gaps + compatibility |
| **Engagement System** | Deal workflow, messaging, data room, milestones |

### 1.4. Target Users

| Role | Description | Primary Need |
|---|---|---|
| **Project Developer** | Builds and owns energy projects | Find capital, technical partners, consultants |
| **Financier (Capital Partner)** | Investment firms, DFIs, banks, equity investors | Find investable projects |
| **EPC Contractor / Operator** | Construction, engineering, O&M firms | Find construction/operations contracts |
| **Consultant / Advisory** | Technical, financial, environmental, legal advisors | Find projects needing their expertise |
| **Grant Provider** | Organizations offering non-dilutive funding | Find early-stage projects needing grants |
| **Power Trader** | Companies buying electricity via PPAs | Find projects with offtake potential |
| **Admin** | Platform team | Oversee, verify, moderate |

### 1.5. Core Value Proposition

**For Developers:**
- See exactly what your project is missing (gap analysis)
- Get AI-scored readiness assessment
- Find the right partners to fill each gap
- Track deals from introduction to financial close

**For Partners (Financiers, EPCs, Consultants):**
- Browse pre-vetted projects matched to your criteria
- See project readiness scores before engaging
- Structured deal workflow with secure data rooms

**For All:**
- Transparent, standardized, secure environment
- AI-powered intelligence and recommendations

---

## 2. USER ROLES & PROFILE COORDINATION

### 2.1. How Coordination Works Across Profiles

The platform creates a **network** where each profile type connects with others in specific ways:

```
Developer ↔ Consultant    → Complete missing studies/services
Developer ↔ EPC Contractor → Design and construct project
Developer ↔ Grant Provider → Get project preparation funding
Developer ↔ Financier (Debt) → Get construction financing
Developer ↔ Financier (Equity) → Obtain investment capital
Developer ↔ Power Trader   → Secure offtake agreements
Consultant ↔ Developer     → Provide specialist services
EPC ↔ Developer            → Find construction opportunities
Financier ↔ Developer      → Find investment opportunities
```

### 2.2. Role Hierarchy & Organizational Structure

- **Organization-Centric:** Users belong to exactly one Organization. Projects and engagements are owned by the Organization.
- **Role Mutability:** An Organization can have exactly one primary role. Switching requires Admin approval.
- **Org Deletion Rules:** Organizations cannot be deleted if they have active engagements — they must be archived.

### 2.3. Permissions Matrix

| Feature / Module | DEVELOPER | CAPITAL_PARTNER | TECHNICAL_PARTNER | CONSULTANT | GRANT_PROVIDER | POWER_TRADER | ADMIN |
|---|---|---|---|---|---|---|---|
| **Projects** | CRUD (Own) | R (Live) | R (Live) | R (Live) | R (Early Stage) | R (Financial Close+) | CRUD (All) |
| **Project Documents** | CRU (Own) | R (In Engagement) | R (In Engagement) | R (In Engagement) | R (In Engagement) | R (In Engagement) | CRUD (All) |
| **Profiles** | CRUD (Own) | CRUD (Own) | CRUD (Own) | CRUD (Own) | CRUD (Own) | CRUD (Own) | CRUD (All) |
| **Matches** | R (Own) | R (Own) | R (Own) | R (Own) | R (Own) | R (Own) | R (All) |
| **Engagements** | CRU | CRU | CRU | CRU | CRU | CRU | R (All) |
| **Messages** | CRU | CRU | CRU | CRU | CRU | CRU | R (All) |
| **Gap Analysis** | R (Own) | — | — | — | — | — | R (All) |
| **Quotes / RFQ** | Send | Receive | Receive | Receive | Receive | Receive | R (All) |

### 2.4. Dashboard Components Per Role

**Developer Dashboard:**
- My Projects (list, create, edit, stage tracking)
- Gap Analysis per project (what's missing)
- Recommended Partners per project (based on gaps)
- Find Partners (search, filter, request quote/meeting)
- Messages (all engagements)
- Data Room (project-level documents)
- AI Insights (scoring breakdown, risk signals)
- Analytics (project views, match stats)
- Inbound Interest (who expressed interest in my projects)

**Financier / Capital Partner Dashboard:**
- Marketplace (browse live projects, filter by stage/sector/country)
- My Matches (projects scored against investment criteria)
- Portfolio (active engagements)
- Messages
- Bookmarks (saved projects)
- Investment Profile (ticket size, risk, governance, sectors, geography)
- Reports (match stats, portfolio performance)

**EPC / Technical Partner Dashboard:**
- Marketplace (browse projects needing construction/operations)
- My Matches (projects scored against technical capabilities)
- Portfolio (active engagements)
- Messages
- Partner Profile (services, experience, certifications, MW capacity)

**Consultant Dashboard:**
- Marketplace (browse early-stage projects needing advisory)
- My Matches (projects scored against consulting expertise)
- Active Engagements (where I'm providing advisory)
- Messages
- Consultant Profile (expertise, experience, references, certifications)

**Grant Provider Dashboard:**
- Marketplace (browse early-stage projects seeking grant funding)
- Active Engagements
- Messages
- Grant Profile (grant types, size range, focus sectors, geography)

**Power Trader Dashboard:**
- Marketplace (browse projects at PPA-ready / financial close stages)
- Active Engagements (offtake agreements)
- Messages
- Trader Profile (license, capacity, preferred technologies, PPA terms)

**Admin Dashboard:**
- Overview (KPIs: users, projects, capital pipeline, pending reviews)
- Verification Queue (approve/reject organizations)
- User Provisioning (create accounts, send invites)
- All Projects (manage lifecycle, approve/reject)
- Milestone Pipelines (monitor all engagements)
- All Companies (manage organizations)
- AI Portfolio Oversight (review AI scores, override if needed)
- Audit Logs
- System Settings

---

## 3. DYNAMIC FORM SYSTEM

### 3.1. Manifest-Driven Forms

All forms in the application are rendered from a **JSON manifest**. The client reads the manifest and renders a dynamic form. This allows form modifications by editing the manifest without code changes.

### 3.2. Field Schema

Each field in the manifest is an object with:

```typescript
interface FormField {
  name: string;           // Unique field key
  label: string;          // Display label
  type: 'text' | 'number' | 'email' | 'password' | 'select' | 'multiselect'
      | 'textarea' | 'radio' | 'checkbox' | 'date' | 'file' | 'yesno'
      | 'range' | 'currency';
  helperText?: string;    // Brief description of what this input means
  placeholder?: string;
  required?: boolean;
  defaultValue?: any;
  options?: { value: string; label: string }[];  // For select/multiselect/radio
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    message?: string;
  };
  // Conditional visibility — field only shows when dependency is met
  dependsOn?: {
    field: string;        // Name of the field this depends on
    operator: 'equals' | 'notEquals' | 'contains' | 'gt' | 'lt';
    value: any;
  };
  // For file uploads
  accept?: string[];      // Allowed MIME types or extensions
  maxFileSizeMB?: number;
  // For nested/extra data — stored as JSONB
  schema?: 'jsonb';
}
```

### 3.3. Yes/No Questions

All boolean questions use **radio buttons** (not toggle buttons) for clarity:

```json
{
  "name": "has_secured_land",
  "label": "Have you secured land for this project?",
  "type": "radio",
  "helperText": "Indicates whether you have a lease agreement or title deed for the project site.",
  "options": [
    { "value": "true", "label": "Yes" },
    { "value": "false", "label": "No" }
  ],
  "required": true
}
```

### 3.4. Server-Side JSONB Handling

For fields that may come in as extra or dynamic data, the server uses JSONB columns. The manifest defines which fields map to JSONB storage:

```json
{
  "name": "additional_info",
  "label": "Additional Information",
  "type": "textarea",
  "schema": "jsonb",
  "helperText": "Any other details about the project not covered above."
}
```

### 3.5. Example Manifest — Developer Onboarding

```json
{
  "steps": [
    {
      "title": "Your Profile",
      "fields": [
        { "name": "full_name", "label": "Full Name", "type": "text", "required": true, "helperText": "Your legal full name as it appears on official documents." }
      ]
    },
    {
      "title": "Your Organization",
      "fields": [
        { "name": "company_name", "label": "Company Name", "type": "text", "required": true, "helperText": "The registered name of your organization." },
        { "name": "company_type", "label": "Organization Type", "type": "select", "required": true, "options": [
          { "value": "DEVELOPER", "label": "Project Developer" },
          { "value": "CAPITAL", "label": "Financier / Capital Partner" },
          { "value": "TECHNICAL", "label": "EPC Contractor / Operator" },
          { "value": "CONSULTANT", "label": "Consultant / Advisory" },
          { "value": "GRANT_PROVIDER", "label": "Grant Provider" },
          { "value": "POWER_TRADER", "label": "Power Trader" }
        ], "helperText": "Select the primary role your organization will play on the platform." },
        { "name": "country", "label": "Country", "type": "select", "required": true, "options": [
          { "value": "Zambia", "label": "Zambia" }
        ], "helperText": "Country of primary operations." },
        { "name": "years_operating", "label": "Years Operating", "type": "number", "required": true, "validation": { "min": 0 }, "helperText": "How many years has your organization been in operation?" },
        { "name": "team_size", "label": "Team Size", "type": "number", "required": true, "helperText": "Total number of employees across all offices." },
        { "name": "description", "label": "About Your Organization", "type": "textarea", "required": true, "validation": { "minLength": 30 }, "helperText": "A brief description of what your organization does, its mission, and key capabilities." }
      ]
    }
  ]
}
```

### 3.6. Example Manifest — Project Creation (5 Steps)

```json
{
  "steps": [
    {
      "title": "Project Identity",
      "fields": [
        { "name": "name", "label": "Project Name", "type": "text", "required": true, "helperText": "A descriptive name for your energy project." },
        { "name": "technology_type", "label": "Technology Type", "type": "select", "required": true, "options": [
          { "value": "SOLAR_PV", "label": "Solar Photovoltaic" },
          { "value": "SOLAR_CSP", "label": "Concentrated Solar Power" },
          { "value": "WIND_ONSHORE", "label": "Onshore Wind" },
          { "value": "HYDRO", "label": "Hydro (Run of River)" },
          { "value": "BIOMASS", "label": "Biomass" },
          { "value": "GEOTHERMAL", "label": "Geothermal" },
          { "value": "STORAGE", "label": "Battery Storage" },
          { "value": "GRID_INFRA", "label": "Grid Infrastructure" }
        ], "helperText": "The primary technology used in this project." },
        { "name": "location_country", "label": "Country", "type": "select", "required": true, "defaultValue": "Zambia", "helperText": "Country where the project is located." },
        { "name": "location_region", "label": "Province / Region", "type": "select", "required": true, "options": [
          { "value": "Central", "label": "Central" },
          { "value": "Copperbelt", "label": "Copperbelt" },
          { "value": "Eastern", "label": "Eastern" },
          { "value": "Luapula", "label": "Luapula" },
          { "value": "Lusaka", "label": "Lusaka" },
          { "value": "Muchinga", "label": "Muchinga" },
          { "value": "Northern", "label": "Northern" },
          { "value": "North-Western", "label": "North-Western" },
          { "value": "Southern", "label": "Southern" },
          { "value": "Western", "label": "Western" }
        ], "helperText": "Specific province or region within the country." },
        { "name": "has_secured_land", "label": "Have you secured land?", "type": "radio", "options": [{ "value": "true", "label": "Yes" }, { "value": "false", "label": "No" }], "required": true, "helperText": "Whether you have a lease agreement or title deed for the project site." },
        { "name": "land_title_status", "label": "Land Title Status", "type": "select", "options": [
          { "value": "Titled", "label": "Titled (Freehold/Leasehold)" },
          { "value": "Traditional", "label": "Traditional Land" },
          { "value": "Not Applicable", "label": "Not Applicable" }
        ], "helperText": "Type of land tenure. Titled land is preferred by investors.", "dependsOn": { "field": "has_secured_land", "operator": "equals", "value": "true" } },
        { "name": "has_reached_financial_close", "label": "Have you reached financial close?", "type": "radio", "options": [{ "value": "true", "label": "Yes" }, { "value": "false", "label": "No" }], "required": true, "helperText": "Whether financing has been fully committed." },
        { "name": "regulatory_approvals", "label": "Regulatory Approvals Obtained", "type": "multiselect", "options": [
          { "value": "ZEMA", "label": "ZEMA (Environmental)" },
          { "value": "ERB", "label": "ERB (Energy Regulation)" },
          { "value": "ZESCO_GRID", "label": "ZESCO Grid Connection" },
          { "value": "CONSTRUCTION_PERMIT", "label": "Construction Permit" },
          { "value": "LAND_USE", "label": "Land Use Permit" }
        ], "helperText": "Select all regulatory approvals you have obtained." }
      ]
    },
    {
      "title": "Scale & Financials",
      "fields": [
        { "name": "project_size_mw", "label": "Project Size (MW)", "type": "number", "required": true, "validation": { "min": 0.1 }, "helperText": "Total installed capacity in megawatts." },
        { "name": "capital_required", "label": "Capital Required (ZMW)", "type": "currency", "required": true, "helperText": "Total capital needed for the project in Zambian Kwacha." },
        { "name": "capital_structure_type", "label": "Capital Structure", "type": "select", "required": true, "options": [
          { "value": "EQUITY", "label": "Equity" },
          { "value": "DEBT", "label": "Debt" },
          { "value": "PROFIT_SHARING", "label": "Profit Sharing" },
          { "value": "LEASING", "label": "Leasing" },
          { "value": "GRANT", "label": "Grant" }
        ], "helperText": "Primary capital structure for this project." },
        { "name": "capex", "label": "Estimated CAPEX (ZMW)", "type": "currency", "helperText": "Total capital expenditure estimate." },
        { "name": "opex", "label": "Annual OPEX (ZMW)", "type": "currency", "helperText": "Estimated annual operating expenditure." },
        { "name": "funding_required", "label": "Funding Still Required (ZMW)", "type": "currency", "helperText": "Amount of funding not yet committed." },
        { "name": "description", "label": "Project Description", "type": "textarea", "required": true, "validation": { "minLength": 50 }, "helperText": "Describe the project in detail: objectives, technology, capacity, expected impact." }
      ]
    },
    {
      "title": "Timeline & Status",
      "fields": [
        { "name": "project_stage", "label": "Current Project Stage", "type": "select", "required": true, "helperText": "The AI will verify this against your documents. Be honest — inflated stages reduce credibility." },
        { "name": "target_financial_close_date", "label": "Target Financial Close", "type": "date", "helperText": "Expected date for financial close." },
        { "name": "target_cod", "label": "Target Commercial Operation Date", "type": "date", "helperText: "Expected date for project commissioning." },
        { "name": "governance_terms", "label": "Governance Terms", "type": "textarea", "helperText": "Describe any governance requirements for investors (board seat, observer rights, etc.)." },
        { "name": "risk_disclosures", "label": "Risk Disclosures", "type": "textarea", "helperText": "Known risks and mitigation strategies for this project." }
      ]
    },
    {
      "title": "Technical Requirements",
      "fields": [
        { "name": "required_services", "label": "Services Needed", "type": "multiselect", "options": [
          { "value": "FEASIBILITY_STUDY", "label": "Feasibility Study" },
          { "value": "ENVIRONMENTAL_ASSESSMENT", "label": "Environmental Impact Assessment" },
          { "value": "LEGAL_ADVISORY", "label": "Legal Advisory" },
          { "value": "FINANCIAL_ADVISORY", "label": "Financial Advisory" },
          { "value": "EPC_CONSTRUCTION", "label": "EPC / Construction" },
          { "value": "O_AND_M", "label": "Operations & Maintenance" },
          { "value": "GRID_CONNECTION", "label": "Grid Connection" },
          { "value": "LOGISTICS", "label": "Logistics" }
        ], "helperText": "Select all services you need for this project. These drive partner recommendations." },
        { "name": "terrain_complexity", "label": "Terrain Complexity", "type": "select", "options": [
          { "value": "SIMPLE", "label": "Simple (Flat, accessible)" },
          { "value": "MODERATE", "label": "Moderate (Some challenges)" },
          { "value": "COMPLEX", "label": "Complex (Remote, difficult terrain)" }
        ], "helperText": "Affects EPC contractor matching." },
        { "name": "grid_status", "label": "Grid Connection Status", "type": "select", "options": [
          { "value": "CONNECTED", "label": "Connected" },
          { "value": "PENDING", "label": "Pending Connection" },
          { "value": "OFF_GRID", "label": "Off-Grid (Mini-grid / Standalone)" }
        ], "helperText": "Current status of grid connection." },
        { "name": "budget_preference", "label": "Budget Preference", "type": "select", "options": [
          { "value": "FIXED", "label": "Fixed Price" },
          { "value": "MILESTONE", "label": "Milestone-Based" },
          { "value": "NEGOTIABLE", "label": "Negotiable" }
        ], "helperText": "How you prefer to structure payments for services." },
        { "name": "ppa_status", "label": "PPA Status", "type": "select", "options": [
          { "value": "SECURED", "label": "PPA Secured" },
          { "value": "IN_PROGRESS", "label": "PPA In Progress" },
          { "value": "NOT_STARTED", "label": "Not Started" },
          { "value": "NOT_APPLICABLE", "label": "Not Applicable" }
        ], "helperText": "Status of Power Purchase Agreement. Critical for financier matching." }
      ]
    },
    {
      "title": "Documents & Submit",
      "fields": [
        { "name": "documents", "label": "Project Documents", "type": "file", "required": true, "accept": [".pdf", ".docx", ".xlsx", ".pptx", ".csv", ".png", ".jpg"], "maxFileSizeMB": 50, "helperText": "Upload at least one document. Supported: PDF, Word, Excel, PowerPoint, CSV, images. Max 50MB each." },
        { "name": "additional_info", "label": "Additional Information", "type": "textarea", "schema": "jsonb", "helperText": "Any other relevant information about the project." }
      ]
    }
  ]
}
```

---

## 4. PROJECT STAGES & PARTNER MAPPING

### 4.1. The 8-Stage Development Taxonomy

The AI determines which stage a project is at (1–8) based on form data and uploaded documents:

| Stage | Label | Description | Recommended Partner Types | Recommended Services |
|---|---|---|---|---|
| 1 | **Concept** | Early project idea — site identified, viability not yet proven | Consultant | Feasibility Study |
| 2 | **Pre-Feasibility** | Initial studies underway — resource assessment, preliminary design | Consultant | Feasibility Study, Environmental Assessment, Grid Connection |
| 3 | **Full Feasibility** | Bankable feasibility study in progress — technical, financial, economic validation | Financial, EPC | Financial Advisory, EPC Preparation |
| 4 | **Regulatory Approval** | Securing environmental and grid approvals (ZEMA, ERB, ZESCO) | Consultant | Legal Advisory, Environmental Assessment |
| 5 | **PPA Ready** | Offtake secured or well advanced — preparing for financing | Financial | Financial Advisory |
| 6 | **Financial Close** | Financing being finalised — contracting the build team | EPC, O&M | EPC Construction, Operations & Maintenance |
| 7 | **Construction** | Under construction — planning operations handover | O&M, EPC | O&M, Engineering/Procurement |
| 8 | **Operation** | Operational — optimising performance and maintenance | O&M | Operations & Maintenance |

### 4.2. Stage-to-Partner Rules (From Meeting Discussion)

The **critical rule** from the meeting:

> "At concept stage and pre-feasibility stage, it should only link you to consultants and financiers."
> "The gaps that are in the project are the ones that should lead you to where you should go."
> "The consultants who can cover your gaps are who you should be linked to."

**Updated mapping:**

| Stage | Links To | Rationale |
|---|---|---|
| Concept | Consultant, Financier (Grant) | Project needs to be fleshed out, feasibility studies needed |
| Pre-Feasibility | Consultant, Financier (Grant) | Still in study phase, needs advisory support |
| Full Feasibility | EPC, Financial Advisory | Bankable study underway, preparing for construction |
| Regulatory Approval | Consultant (Legal, Environmental) | Securing approvals, legal advisory critical |
| PPA Ready | Financial (Debt, Equity) | Ready for financing discussions |
| Financial Close | EPC, O&M | Financing locked, now need construction team |
| Construction | O&M, EPC | Under build, planning handover |
| Operation | O&M | Operating, optimizing performance |

### 4.3. Gap-Based Matching (Not Just Stage-Based)

The system must match based on **what the project is actually missing**, not just the declared stage:

1. AI analyzes documents → identifies gaps (missing feasibility study, no EIA, no PPA, etc.)
2. Each gap maps to a partner type that can fill it
3. "Find Matching Partners" shows partners who can cover the **specific gaps** in the project
4. When requesting a quote/meeting, the developer sees a summary of the project's gaps

**Gap → Partner Type mapping:**

| Missing Item | Recommended Partner Type | Service |
|---|---|---|
| Feasibility Study | Consultant | Technical Feasibility |
| Financial Model | Consultant | Financial Advisory |
| Environmental Assessment | Consultant | Environmental Impact |
| Grid Study | Consultant | Grid Connection Advisory |
| Licences/Approvals | Consultant | Legal Advisory |
| EIA | Consultant | Environmental Assessment |
| EPC Contractor | Technical Partner | EPC Construction |
| Debt Financing | Capital Partner | Debt |
| Equity | Capital Partner | Equity Investment |
| Grant | Grant Provider | Grant Funding |
| Carbon Credits | Consultant | Carbon Finance |
| Transaction Advisory | Consultant | Investment Advisory |
| O&M Partner | Technical Partner | Operations & Maintenance |

---

## 5. GAP ANALYSIS & READINESS SYSTEM

### 5.1. Document Checker

**Input:** Uploaded documents + project form data.

**Processing:** AI reads each document, determines what it is, checks if it supports project claims.

**Output:** Per-document verdict:
- `detected_type` — what the document actually is
- `content_summary` — what it contains
- `key_facts` — concrete data points
- `relevance` — HIGH / MEDIUM / LOW
- `authenticity_concerns` — red flags, mismatches, blank pages
- `supports_project_claims` — true/false

Plus a gap list:
```
Missing: Feasibility Study → Recommend: Technical Consultant
Missing: Environmental Impact Assessment → Recommend: Environmental Consultant
Missing: Grid Connection Study → Recommend: Engineering Consultant
```

### 5.2. Readiness Engine

Calculates a weighted readiness score (0–100):

```
ReadinessScore = Regulatory(40%) + Financial(35%) + Developer(25%)
```

**Regulatory (40%):**
- Site Rights & Land Security (6%)
- Environmental Approval (5%)
- Grid Readiness (7%)
- Feasibility Study Quality (8%)
- PPA/Offtake Agreement (8%)
- Construction Readiness (3%)
- Licensing Status (2%)
- Corporate Compliance (1%)

**Financial (35%):**
- CAPEX Benchmarking (5%)
- OPEX Sustainability (5%)
- Financial Internal Rate of Return (10%)
- Financial Net Present Value (7%)
- Payback Period (5%)
- Sensitivity Analysis (3%)

**Developer (25%):**
- Legal & Regulatory Compliance (3%)
- Track Record — Development (6%)
- Track Record — Operations (4%)
- EPC/Technical Partnerships (4%)
- Equity Commitment (4%)
- Funding Readiness (3%)
- Company Strength (1%)

### 5.3. Risk Engine

Evaluates project characteristics and produces:

```json
{
  "technical_risk": "Medium",
  "financial_risk": "High",
  "regulatory_risk": "Low",
  "overall_risk": "Medium",
  "risk_signals": [
    { "level": "HIGH", "category": "DATA_INTEGRITY", "text": "No documents support project claims" },
    { "level": "MEDIUM", "category": "FINANCIAL", "text": "Reliance on single off-taker" }
  ]
}
```

---

## 6. REQUEST FOR QUOTE / MEETING FLOW

### 6.1. How It Works

When a developer sees recommended partners (based on gaps), they can:

1. **Request a Meeting** — schedule a call to discuss the project
2. **Request a Quote** — ask for a proposal/cost estimate

### 6.2. Request Flow

```
Developer clicks "Request Quote" or "Request Meeting"
  ↓
System shows: which gaps this partner can fill + project summary
  ↓
Developer writes a brief message describing what they need
  ↓
Request is sent to the partner
  ↓
Partner receives notification with:
  - Project name, stage, size, technology
  - What gaps need filling
  - Developer's message
  - "Accept" / "Decline" buttons
  ↓
If accepted → Engagement is created (INTRO_SENT → INTRO_ACCEPTED)
  ↓
Both parties can now message, share docs, and track progress
```

### 6.3. Request Payload

```json
{
  "project_id": "uuid",
  "partner_company_id": "uuid",
  "request_type": "QUOTE" | "MEETING",
  "gaps_to_fill": ["FEASIBILITY_STUDY", "ENVIRONMENTAL_ASSESSMENT"],
  "message": "We need a feasibility study and EIA for our 50MW solar project in Lusaka.",
  "project_summary": {
    "name": "Lusaka Solar Farm",
    "stage": "Concept",
    "size_mw": 50,
    "technology": "Solar PV",
    "location": "Lusaka, Zambia",
    "missing_items": ["Feasibility Study", "Environmental Impact Assessment"]
  }
}
```

---

## 7. CONSULTANT ROLE (NEW)

### 7.1. Consultant Profile Fields

```typescript
interface ConsultantProfile {
  company_id: string;
  // Expertise
  service_categories: string[];     // ['TECHNICAL_ADVISORY', 'FINANCIAL_ADVISORY', 'ENVIRONMENTAL', 'LEGAL']
  sector_experience: string[];      // ['SOLAR', 'WIND', 'HYDRO']
  specializations: string[];        // ['FEASIBILITY_STUDIES', 'EIA', 'GRID_ASSESSMENT', 'FINANCIAL_MODELLING']
  
  // Experience
  years_of_experience: number;
  total_projects_completed: number;
  largest_project_mw: number;
  regions_operated: string[];
  
  // Credentials
  certifications: string[];
  key_team_members: {
    name: string;
    role: string;
    experience_years: number;
  }[];
  references: {
    client_name: string;
    project_name: string;
    description: string;
  }[];
  
  // Availability
  availability: 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE';
  hourly_rate_range?: string;
  project_rate_range?: string;
  
  // Documents
  company_experience_doc_url?: string;
  portfolio_doc_url?: string;
}
```

### 7.2. Consultant Matching Logic

Consultants are matched to projects based on:
1. **Gap coverage** — does the consultant's expertise cover the project's missing items?
2. **Sector experience** — has the consultant worked on similar technology types?
3. **Geographic coverage** — does the consultant operate in the project's region?
4. **Project size fit** — can the consultant handle the project's scale?
5. **Availability** — is the consultant currently available?

---

## 8. DYNAMIC FORM SYSTEM

### 8.1. Architecture

```
Manifest (JSON) → DynamicFormRenderer (React) → Form State → API → Server (JSONB for extras)
```

### 8.2. Benefits

- **Easy modification:** Change the manifest → form automatically adjusts
- **No code changes:** Add/remove/reorder fields by editing JSON
- **Consistent styling:** One renderer ensures all forms look the same
- **Conditional fields:** `dependsOn` rules show/hide fields based on other field values
- **Server flexibility:** `schema: 'jsonb'` fields stored as JSONB in the database for extra/dynamic data

### 8.3. Server-Side Handling

For fields with `schema: 'jsonb'`, the server stores them in a JSONB column:

```sql
ALTER TABLE projects ADD COLUMN extra_data JSONB DEFAULT '{}';
```

The API accepts the full form payload, separates standard fields from extra fields, and stores extras in the JSONB column.

---

## 9. CONTROLLED TAXONOMY

### 9.1. Enumerations

| Category | Values |
|---|---|
| **Sector** | SOLAR, WIND, HYDRO, BIOMASS, GEOTHERMAL, STORAGE, GRID_INFRA |
| **Technology** | PHOTOVOLTAIC, CONCENTRATED_SOLAR, ONSHORE_WIND, RUN_OF_RIVER, LITHIUM_ION, VANADIUM_FLOW |
| **Service Categories** | EPC, O_M, FEASIBILITY_STUDY, ENVIRONMENTAL_ASSESSMENT, LEGAL_ADVISORY, FINANCIAL_ADVISORY, GRID_CONNECTION, LOGISTICS, CARBON_FINANCE, TRANSACTION_ADVISORY |
| **Consultant Specializations** | FEASIBILITY_STUDIES, EIA, GRID_ASSESSMENT, FINANCIAL_MODELLING, LEGAL_ADVISORY, ENVIRONMENTAL_COMPLIANCE, INVESTMENT_ADVISORY, CARBON_FINANCE |
| **Governance Preferences** | PASSIVE, BOARD_SEAT, ACTIVE_ROLE |
| **Risk Levels** | LOW (Proven tech, signed PPA), MEDIUM (Proven tech, merchant risk), HIGH (Emerging tech or frontier market) |
| **Capital Structures** | EQUITY, DEBT, PROFIT_SHARING, LEASING, GRANT |
| **Project Stages** | CONCEPT, PRE_FEASIBILITY, FULL_FEASIBILITY, REGULATORY_APPROVAL, PPA_READY, FINANCIAL_CLOSE, CONSTRUCTION, OPERATION |
| **Engagement States** | INTRO_SENT, INTRO_ACCEPTED, NDA_SIGNED, DUE_DILIGENCE, TERM_SHEET, CONTRACT_SIGNED, CAPITAL_COMMITTED, CLOSED, DROPPED |
| **Project Status** | draft, scoring, scoring_retry, under_review, pending_live (legacy), live, deactivated, archived |
| **Document Classification** | PUBLIC, RESTRICTED, CONFIDENTIAL |

---

## 10. CORE PRODUCT MODULES

### A. User Onboarding & Verification

**Functional Requirements:**
- Users sign up via admin-provided invite tokens
- During signup, users select their primary role
- After signup, guided to create profile + company profile via dynamic form manifests
- Admin verifies company profiles for full platform access
- **Special Onboarding:** Admins can onboard teams in bulk — each member gets name, NRC, membership type, and proof of payment is attached at the end

**Membership Types:**
- Standard Member (full access)
- Affiliate (limited access, renew annually)

### B. Company Profiles

Each role has a tailored profile stored in role-specific tables:
- `companies` (base: name, type, country, description, team_size, years_operating)
- `capital_partners` (investment preferences, ticket size, risk, governance)
- `technical_partners` (services, experience, MW capacity, certifications)
- `consultants` (expertise, specializations, references, availability) — **NEW**
- `grant_providers` (grant types, size, focus sectors, geography)
- `power_traders` (license, capacity, preferred technologies, PPA terms)

### C. Project Creation & Editing

**5-step wizard** using dynamic form manifests:
1. Project Identity (name, technology, location, readiness checklist)
2. Scale & Financials (MW, capital, structure, CAPEX, OPEX)
3. Timeline & Status (stage, target dates, governance, risks)
4. Technical Requirements (services needed, terrain, grid, budget, PPA)
5. Documents & Submit (upload docs, review, submit)

**Post-submission (no modal/window — direct navigation to project page):**
1. Documents uploaded securely.
2. AI scoring engine is kicked off in the background; the wizard navigates
   immediately to the project page (no overlay / waiting screen).
3. The project transitions `draft → scoring → under_review` automatically as
   the AI analysis runs. The project page polls every 5 s while it is in
   `scoring` and refreshes once the status moves to `under_review`.
4. The project lands in the **Authority / Platform-Admin Review Queue**.
5. A reviewer either:
   - **Approves** → project transitions to `live`, becomes visible to
     investors, AI score is now revealed to the developer, matching engine
     starts.
   - **Returns with comments** → project transitions to `draft`, the
     `rejection_reason` is set, the AI score **is** revealed so the developer
     can iterate, and the project shows a "Returned by reviewer" banner with
     the comments + a one-click "Edit & resubmit" link.

The developer's AI score visibility is **gated on status** — it is hidden
while the project is in `scoring`, `scoring_retry`, or `under_review`, and
revealed once the project is `live` (approved) or `draft` with a
`rejection_reason` (returned for changes).

### D. AI Scoring & Gap Detection

**The core intelligence of the platform:**

1. AI reads every uploaded document
2. Produces per-document analysis (type, content, relevance, authenticity)
3. Identifies gaps (missing items that the project claims to have)
4. Calculates readiness score (0–100)
5. Determines project stage (1–8)
6. Recommends partner types based on gaps
7. Flags risk signals

**Re-scoring:** Triggered when documents change. Developer can also manually re-trigger.

### E. Gap-Based Matching Engine

**Not just stage-based — gap-based:**

1. Project goes through AI analysis → gaps identified
2. Each gap maps to a partner type
3. Matching engine finds partners who can fill those specific gaps
4. Partners are scored by: gap coverage, sector experience, geography, size fit, availability
5. Developer sees recommended partners per project with "Request Quote" / "Request Meeting" buttons

**Matching triggers:**
- Project goes live
- Partner updates profile
- Partner gets verified
- Developer clicks "Find Partners"
- Automatic daily recalculation

### E2. Review History

Every authority / platform-admin review decision is recorded in the
`project_reviews` table (one row per `approve` / `return`). Each row stores
the reviewer, decision, comments, the project's status before and after the
decision, and the timestamp.

- Visible to the project's owning developer (so they can see *what was said*,
  not just the final status), to platform admins, and to authority users.
- Surfaced on the project detail page (developer + authority) as a
  chronological "Review History" section, showing the reviewer's name, the
  decision badge (Approved / Returned), the status transition, the
  timestamp, and the comments (when present).
- Powers the "Returned for changes" banner on the developer's project
  listing — same source of truth, no separate `rejection_reason` field
  needed for new decisions. The existing `rejection_reason` column is kept
  for back-compat with legacy decisions.

### F. Engagement Workflow

**State Machine:**
```
INTRO_SENT → INTRO_ACCEPTED → NDA_SIGNED → DUE_DILIGENCE → TERM_SHEET
→ CONTRACT_SIGNED → CAPITAL_COMMITTED → CLOSED
(At any point: DROPPED)
```

**Per-stage actions:**
| Stage | Developer Can | Partner Can |
|---|---|---|
| Intro Sent | Accept / Decline | Wait |
| Intro Accepted | Move to NDA | Move to NDA |
| NDA Signed | Move to Due Diligence | Move to Due Diligence |
| Due Diligence | Move to Term Sheet | Move to Term Sheet |
| Term Sheet | Move to Contract | Move to Contract |
| Contract Signed | Move to Capital Committed | Move to Capital Committed |
| Capital Committed | Close | Close |
| Any | Drop | Drop |

### G. Data Room

**Project-level data room:**
- Upload documents with classification (Public / Restricted / Confidential)
- Document types: Pitch Deck, Financial Model, Feasibility Study, EIA, Land Title, Approvals, Technical Reports
- Version control (DB schema supports it)
- Download audit logging
- Signed URLs (15-min expiry)

**Engagement-level data room:**
- NDA, Term Sheet, Contract, Supporting documents
- Unlocks at NDA Signed stage
- Max 5 documents per engagement (expandable)
- Real-time updates via Supabase Realtime

### H. Messaging

- Real-time messaging within engagement rooms
- Supabase Realtime for live updates
- Optimistic UI updates
- 5-minute self-delete window
- Unread message counts
- Message read receipts

### I. Notifications

| Event | Who Gets Notified |
|---|---|
| New match found | Developer, Partner |
| Quote/Meeting request sent | Partner |
| Quote/Meeting request accepted | Developer |
| Engagement stage changed | Both parties |
| New message | Engagement participants |
| Project submitted for review | Platform admins / authority reviewers |
| Project approved (live) | Developer (org admins) — score revealed |
| Project returned for changes | Developer (org admins) — comments + score revealed |
| Admin verification complete | The verified user |

### J. Admin Oversight

- User management (CRUD, provision, suspend)
- Organization verification (approve/reject/needs update)
- Project moderation (approve/reject, force state)
- Engagement monitoring (view all, intervene)
- AI portfolio oversight (review scores, override)
- Audit logs (filterable, exportable)
- System settings

---

## 11. SECURITY & DATA GOVERNANCE

### 11.1. Authentication & Authorization
- Supabase Auth with email/password
- MFA (TOTP) required for: platform admins, org owners, org admins
- Session timeout: 24 hours hard cap
- Account lockout: 3 failed attempts → 30-minute lockout
- Rate limiting: 200 req/min API, 5/hr AI analysis

### 11.2. Row Level Security
- RLS enabled on all tables
- Users can only access their own org's data
- Marketplace projects visible to all verified users
- Engagement participants can only see their own engagements
- Platform admins bypass RLS

### 11.3. Data Classification
- **Public:** User names, project titles
- **Private:** Email addresses, phone numbers
- **Restricted:** Match scores, AI notes
- **Confidential:** Financial models, PII, NDA documents

### 11.4. Security Headers
- Content-Security-Policy (restrictive)
- X-Frame-Options: DENY
- HSTS (production only)
- Referrer-Policy: strict-origin-when-cross-origin

### 11.5. Audit Logging
Every state mutation logged with: user, action, entity, before/after state, IP, user agent.

---

## 12. API CONTRACT

### 12.1. Standard Response Envelope

**Success:**
```json
{ "success": true, "data": { ... }, "meta": { "timestamp": "...", "version": "v1" } }
```

**Failure:**
```json
{ "success": false, "error": { "code": "VALIDATION", "message": "...", "trace_id": "req-..." } }
```

### 12.2. HTTP Status Codes
- 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Too Many Requests

### 12.3. Idempotency
POST endpoints support `Idempotency-Key` header for safe retries.

---

## 13. NON-FUNCTIONAL REQUIREMENTS

- **Performance:** API < 200ms (p95), page load < 2.5s (LCP)
- **Scalability:** Designed for 1,000+ concurrent users
- **Uptime:** 99.9% target
- **Monitoring:** Uptime monitoring, error tracking (Sentry), structured logging
- **Backups:** Supabase automated daily backups + manual export capability

---

## 14. PHASED DEVELOPMENT PLAN

### Phase 1: Core Infrastructure (DONE ✅)
- Auth, database, hosting, RLS, middleware
- Rate limiting, MFA, audit logging

### Phase 2: Project Submission (DONE ✅)
- 5-step project creation wizard
- Document upload
- AI scoring (Gemini)
- Project lifecycle state machine (`draft → scoring → under_review → live` or
  `→ draft` with reviewer comments)
- Developer dashboard
- Developer sees the AI score **only** once the project is `live` or has been
  returned to `draft` with a reviewer comment
- Project page polls every 5 s while AI is analysing; on completion the
  page refreshes to show the new `under_review` status
- Wizard navigates straight to the project page on submit — no
  post-creation modal or overlay window

### Phase 3: Matching Engine (DONE ✅)
- Capital matching algorithm
- Technical matching algorithm
- Match results storage
- Developer "Find Partners" view

### Phase 4: Engagement Workflow (DONE ✅)
- Engagement state machine
- Messaging (real-time)
- Data room (project + engagement level)
- Notifications
- **Authority / platform-admin review queue + decision flow** (approve /
  return with comments)
- **`project_reviews` table** — every reviewer decision logged with comments
  and status transition, surfaced on the project page as a Review History
  section visible to developer + reviewer

### Phase 5: ALL Profile Dashboards (DONE ✅)
- Investor/Capital Partner dashboard
- Technical Partner dashboard
- Grant Provider dashboard
- Power Trader dashboard
- Admin dashboard
- Authority / platform-admin project review queue (Awaiting / Approved /
  Returned / All) and detail view with Approve/Return actions

### Phase 6: Gap-Based Matching & Consultant Role (NEXT 🔜)
- **Consultant profile type** — registration, profile, dashboard
- **Gap analysis improvements** — gap → partner type mapping
- **Stage-to-partner rules** — enforce the meeting discussion rules
- **Request for Quote / Meeting flow** — developer requests, partner responds
- **Dynamic form system** — manifest-driven forms with JSONB
- **Consultant matching** — match based on gap coverage

### Phase 7: UI Maturity & Polish (NEXT 🔜)
- **Responsive mobile layout** — hamburger menu, stacked cards
- **Sidebar redesign** — collapsible sections, max 7 top-level items
- **Document viewer** — inline PDF/image preview
- **Marketplace improvements** — filters, sorting, comparison
- **Charts and analytics** — Recharts for dashboards
- **Design system** — consistent tokens, spacing, typography
- **Dark mode**
- **Accessibility** — WCAG 2.1 AA

### Phase 8: Performance & Scale (NEXT 🔜)
- Redis caching (Upstash)
- Pagination on all list endpoints
- Virtual scrolling for large lists
- Background job queue for AI analysis (BullMQ)
- Database indexing audit
- CDN for static assets

### Phase 9: Production Hardening (NEXT 🔜)
- Structured logging (Pino)
- Error tracking (Sentry)
- Environment validation (Zod)
- Health check endpoints
- CI/CD pipeline
- Staging environment
- Security audit
- Load testing

### Phase 10: Launch & Growth
- Public launch in Zambia
- User feedback collection
- Feature iteration
- Geographic expansion (East & Southern Africa)
- Mobile app
- B2B API for partners

---

## 15. MVP VS POST-MVP ROADMAP

### MVP (Launch — Zambia Focus)
- All core modules (Phases 1–5)
- Roles: Developer, Capital Partner, Technical Partner, Consultant, Grant Provider, Power Trader
- AI-powered scoring and gap detection
- Basic matching (stage-based + gap-based)
- Engagement workflow with messaging and data room
- Admin moderation

### v1.1 (Fast Follow)
- Consultant matching improvements
- Request for Quote / Meeting flow
- Dynamic form system
- Notification preferences
- User-facing analytics

### v2.0 (Expansion)
- Geographic expansion (Kenya, Nigeria, Tanzania)
- Multi-currency support
- Advanced analytics and market intelligence
- Third-party data integration
- Carbon finance module

### Long-Term Vision
- Mobile application
- B2B API for partner integrations
- Automated contract generation (template-based)
- Definitive source for energy project intelligence in emerging markets

---

## 16. LEGAL & REGULATORY

- **Non-Broker-Dealer:** AfriConnect is an information facilitator only
- **No Financial Advice:** Readiness scores are for internal reference, not investment recommendations
- **Data Sovereignty:** Zambian project data handled in compliance with local data protection acts
- **Liability:** Platform not responsible for engagement outcomes or user-provided data accuracy

---

*This document reflects the AfriConnect platform requirements as of August 2026.*

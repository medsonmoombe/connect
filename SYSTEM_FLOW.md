# AfriConnect — How the Platform Works

A plain-language guide to everything that happens on the platform, from signing up to closing a deal.

---

## Table of Contents

1. [What is AfriConnect?](#what-is-africonnect)
2. [Who Uses the Platform?](#who-uses-the-platform)
3. [Signing Up & Getting Started](#signing-up--getting-started)
4. [Creating a Project](#creating-a-project)
5. [How AI Scores Projects](#how-ai-scores-projects)
6. [The Marketplace](#the-marketplace)
7. [How Matching Works](#how-matching-works)
8. [Expressing Interest & Starting an Engagement](#expressing-interest--starting-an-engagement)
9. [The Engagement Lifecycle](#the-engagement-lifecycle)
10. [The Data Room](#the-data-room)
11. [Messaging & Communication](#messaging--communication)
12. [Bookmarks](#bookmarks)
13. [Notifications](#notifications)
14. [Milestones & Deal Tracking](#milestones--deal-tracking)
15. [Admin Oversight](#admin-oversight)

---

## What is AfriConnect?

AfriConnect is a B2B marketplace that connects people building energy infrastructure projects (like solar farms and wind parks) with the people who fund them, build them, and buy the electricity they produce.

Think of it as a structured deal room where projects get scored, matched to the right partners, and tracked through every step — from first introduction to a signed deal.

The platform currently focuses on the **Zambian energy market**, with all monetary values in **ZMW**.

---

## Who Uses the Platform?

There are five types of users:

| Role | What They Do |
|---|---|
| **Developer** | Builds and owns energy projects. They list projects, upload documents, and get matched to funding and construction partners. |
| **Capital Partner** | Investment firms that fund projects. They browse the marketplace, express interest, and go through due diligence. |
| **Technical Partner** | Construction and engineering firms (EPC, O&M). They get matched to projects that need their services. |
| **Power Trader** | Companies that buy electricity through PPAs (Power Purchase Agreements). They browse projects to off-take from. |
| **Grant Provider** | Organizations that provide non-dilutive funding (grants) to energy projects. |
| **Admin** | The platform team. They verify organizations, approve projects, and oversee the marketplace. |

---

## Signing Up & Getting Started

### Getting an Invite

You cannot sign up on your own. An admin sends you an **invite link** with a unique token. When you click it, the system verifies the invite and takes you to the account creation page.

If the invite has expired or is invalid, you'll see an error message.

### Creating Your Account

You fill in:
- Your full name
- Your work email (may be pre-filled if the invite was sent to a specific email)
- A password (minimum 8 characters)

Once you submit, your account is created and you're taken to the login page with a success message.

### Login & Security

You log in with your email and password. If you're an admin or have extra security enabled, you'll be asked for a one-time code (MFA) before you can access the dashboard.

If you enter the wrong password too many times, your account gets temporarily locked for a few minutes.

### Setting Up Your Organization

After your first login, you're guided through a setup wizard:

**Step 1 — Your Profile:** Confirm your name.

**Step 2 — Your Organization:**
- Search for an existing company to join, OR
- Create a new company by filling in:
  - Company type (Developer, Capital Partner, Technical Partner, or Power Trader)
  - Company name, description, country, years operating, team size

**Step 3 — Your Preferences** (for Capital Partners, Technical Partners, and Power Traders):
- Investment size ranges, sector focus, geographic focus, risk tolerance, and other preferences that help the matching engine find the right projects for you.

**Step 4 — Done:** You see a confirmation screen telling you that your organization is under review. An admin will verify your profile, and you'll get an email once approved. You can start using the dashboard right away with limited access.

---

## Creating a Project

Only **Developers** can create projects. It's done through a 5-step wizard:

### Step 1 — Project Identity
- Project name
- Technology type (Solar, Wind, Hydro, Biomass, etc.)
- Country and region
- Readiness checklist: Do you have the land? Do you have regulatory approvals? Have you reached financial close?

### Step 2 — Scale & Financials
- Project size in MW (megawatts)
- Capital required in ZMW
- Capital structure type (Equity, Profit Sharing, Leasing, or Grant)

### Step 3 — Timeline & Status
- Current project stage (Concept, Feasibility, Permitting, Financial Close, Construction, or Operations)
- Target dates for financial close and project go-live

### Step 4 — Technical Requirements
- Terrain complexity, grid connection status, budget preference

### Step 5 — Documents & Submission
- Upload at least one document (Pitch Deck, Financial Model, Feasibility Study, Environmental Audit, etc.)
- Accepted formats: PDF, Word, Excel, PowerPoint, images. Max 20MB each.
- Review everything and click **Submit**

### What Happens After Submission

1. Your documents are uploaded securely.
2. Your project moves into the **submitted** state and the review team is notified.
3. An **AI scoring engine** reads your documents and scores your project (see next section).
4. Once scored, your project enters the **review queue** ("Under Regulator Review") and the platform team / regulators make the approval decision.
5. On approval your project goes **live** on the marketplace and the matching engine starts finding partners for you. If it is returned, you get the reviewer's comments on a draft and can resubmit.

Nothing before that final **Submit** click puts your project into review — a draft you are still working on (and any document you upload while filling the form) stays a draft until you submit.

### Saving Drafts

The form auto-saves as you type. If you close the browser and come back later, your draft is still there.

---

## How AI Scores Projects

The platform uses an AI model (Google Gemini) that acts as a "Senior Infrastructure Investor specialized in African energy markets." It reads every document you uploaded and scores your project across three dimensions:

### 1. Regulatory & Project Readiness (40% of total score)
Things like: Do you have the land? Is the environmental approval in place? Is the grid connection ready? Do you have a PPA (power purchase agreement)?

### 2. Financial Viability (35% of total score)
Things like: Are the costs realistic? Is the return on investment attractive? What's the payback period?

### 3. Developer Strength (25% of total score)
Things like: Has your company delivered projects before? Do you have construction partners? Are you financially committed?

### The Output

You get a score from 0 to 100, a detailed breakdown, risk signals (High, Medium, or Low), and specific recommendations for improvement.

The AI also checks whether your documents are actually related to energy projects. If they're not, all scores are set to zero.

### Re-Scoring

If you upload or delete documents, your scores are automatically invalidated and the AI re-analyzes your project. You can also manually trigger a re-score.

---

## The Marketplace

The marketplace is where **Capital Partners**, **Technical Partners**, **Power Traders**, and **Grant Providers** browse available projects.

### What You See

Each project card shows:
- Project name and technology type
- Location and capacity (MW)
- Capital required (ZMW)
- AI readiness score (0-100%)
- Current stage

### Filtering & Sorting

You can filter by technology type, project stage, location, and capital range. Results update in real time as you adjust filters.

### Bookmarking

You can bookmark any project to save it for later. Bookmarked projects appear in your **Bookmarks** tab.

---

## How Matching Works

Behind the scenes, a matching engine constantly compares projects against partner preferences to find the best fits.

### Capital Matching

For each project, the system looks at every Capital Partner and scores compatibility based on:

| Factor | Weight |
|---|---|
| Investment size overlap | 30% |
| Capital structure preference | 20% |
| Risk tolerance alignment | 15% |
| Governance preference | 15% |
| Sector/technology match | 10% |
| Geographic match | 10% |

Bonus points are given if the project stage matches the partner's preferences or if the project already has a construction partner engaged.

### Technical Matching

For each project, the system looks at every Technical Partner and scores based on:

| Factor | Weight |
|---|---|
| Sector/technology expertise | 25% |
| Project size fit | 25% |
| Ticket size fit | 20% |
| Geographic coverage | 15% |
| Years of experience | 15% |

### When Matching Happens

- When a project goes live
- When a partner updates their profile
- When a partner gets verified by an admin
- When a developer clicks "Find Partners"

---

## Expressing Interest & Starting an Engagement

When a Capital Partner, Technical Partner, Power Trader, or Grant Provider finds a project they're interested in, they click **"Express Interest"** on the project page or in the marketplace.

### What Happens

1. The partner clicks the button and optionally writes a short message.
2. An **engagement** is created — this is the private workspace where both sides track the deal.
3. The developer gets notified that someone is interested.
4. The partner sees an "Expressed" badge on the project — they can't express interest twice.

---

## The Engagement Lifecycle

An engagement moves through a series of stages. Each stage has specific actions available:

```
Intro Sent → Intro Accepted → NDA Signed → Due Diligence → Term Sheet → Contract Signed → Capital Committed → Closed
```

Or at any point: **Dropped** (either side can end the engagement).

### Stage-by-Stage Breakdown

| Stage | What Happens |
|---|---|
| **Intro Sent** | The partner has expressed interest. The developer can Accept or Decline. |
| **Intro Accepted** | The developer welcomed the partner. Both sides can now communicate. |
| **NDA Signed** | Both parties have signed a Non-Disclosure Agreement. **Data room access unlocks** for the partner. |
| **Due Diligence** | The partner reviews project documents, asks questions, and evaluates the opportunity. |
| **Term Sheet** | A term sheet is being negotiated. |
| **Contract Signed** | The deal is contracted. |
| **Capital Committed** | Funds are committed. |
| **Closed** | The deal is done. |
| **Dropped** | Either side ended the engagement. |

### Who Can Do What

- **Developers** can accept, decline, or move the engagement forward at each stage.
- **Partners** can also move the engagement forward or drop it.
- **Admins** can intervene at any stage.

### Notifications

Both sides get notified at every stage transition. For example: "NDA Signed — Data room access granted."

---

## The Data Room

The Data Room is where project documents are stored and shared securely.

### For Developers

- Upload documents to any of your projects.
- Classify each document as **Public** (anyone can see), **Restricted** (only matched partners after intro accepted), or **Confidential** (only within a specific engagement).
- Delete documents (this may invalidate AI scores).
- See who accessed your documents and when.

### For Partners

- You can only see documents after your engagement reaches **NDA Signed**.
- You see only the documents the developer has shared with you.
- Documents open via secure, time-limited links (expire after 15 minutes).
- You can download documents but cannot re-share them.

### Document Types

Common document types include:
- Pitch Deck
- Financial Model
- Feasibility Study
- Environmental Impact Assessment
- Land Title / Lease Agreement
- Regulatory Approvals
- Technical Reports

### Security

- All files are stored in encrypted, private cloud storage.
- No public URLs — every access goes through a secure API.
- Every download is logged with the user's ID, timestamp, IP address, and browser info.
- Duplicate files are detected automatically (via SHA-256 hash).

---

## Messaging & Communication

Each engagement has a built-in messaging thread. Both sides can:
- Send text messages
- Share links to Data Room documents
- See when messages were sent and by whom

Messages are scoped to the engagement — you can't message someone outside of an active engagement.

---

## Bookmarks

Any user browsing the marketplace can bookmark projects they're interested in. Bookmarked projects appear in a dedicated **Bookmarks** tab on the dashboard, making it easy to come back to projects later.

---

## Notifications

The platform sends notifications for key events:

| Event | Who Gets Notified |
|---|---|
| New interest expressed | Developer |
| Engagement accepted/declined | Partner |
| Stage transition (NDA signed, etc.) | Both sides |
| New document uploaded | Engagement participants |
| AI scoring complete | Developer |
| Project approved/rejected | Developer |
| Admin verification complete | The verified user |

Notifications appear in-app and some are also sent via email.

---

## Milestones & Deal Tracking

Within each engagement, both sides can set and track milestones:

- Define milestone name, description, target date, and deliverables
- Mark milestones as complete
- Upload supporting documents to milestones
- Track overall progress through the deal pipeline

The developer dashboard also shows a **Deal Pipeline** view — a funnel chart showing how many engagements are at each stage.

---

## Admin Oversight

Admins have full visibility across the platform:

- **User Verification:** Review and approve new organizations.
- **Project Review:** Approve or reject projects before they go live.
- **Engagement Monitoring:** View all active engagements and intervene if needed.
- **AI Overview:** Monitor AI scoring accuracy and override scores if necessary.
- **Analytics:** Platform-wide metrics on projects, matches, engagements, and data room access.

---

## Summary: The End-to-End Journey

Here's what a typical deal looks like from start to finish:

1. **Admin invites a Developer** to the platform.
2. **Developer signs up**, creates their company profile, and sets up their account.
3. **Developer creates a project** — fills in details, uploads documents.
4. **AI scores the project** — gives it a readiness score and recommendations.
5. **Project goes live** on the marketplace after admin approval.
6. **Matching engine finds partners** — Capital Partners and Technical Partners who fit the project.
7. **A Capital Partner browses the marketplace**, finds the project interesting, and **expresses interest**.
8. **Developer accepts** the interest — engagement moves to "Intro Accepted."
9. **Both sides sign an NDA** — Data Room access unlocks for the partner.
10. **Partner reviews documents** in the Data Room, asks questions via messaging.
11. **Term sheet is negotiated** and eventually **contract is signed**.
12. **Capital is committed** and the deal is **closed**.
13. Both sides can track milestones and completion from their dashboards.

---

*This document reflects the current state of the AfriConnect platform as of July 2026.*

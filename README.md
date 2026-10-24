# Pulse360 — 360° Performance Review

> **Pulse360** is a full-stack internal 360° performance review platform built for semi-annual/quarterly/monthly cycles.
> Built by me and the **IBM Bob** team at the Pulse Technologies Hackathon V1 — AI App Build IDE Challenge.
> Testing AI App Build IDE tools like **IBM Bob**, **Codex**, **Cursor**, **Claude Code**.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Team](#team)
5. [Prerequisites](#prerequisites)
6. [Getting Started](#getting-started)
7. [Environment Variables](#environment-variables)
8. [Database](#database)
9. [Running the App](#running-the-app)
10. [Test Accounts](#test-accounts)
11. [Project Structure](#project-structure)
12. [Selected API Endpoints](#selected-api-endpoints)
13. [Review Cycle Lifecycle](#review-cycle-lifecycle)
14. [Features Implemented](#features-implemented)
15. [Human-in-the-Loop Log](#human-in-the-loop-log)
16. [IBM Bob — Agentic AI Platform Notes](#ibm-bob--agentic-ai-platform-notes)
17. [Useful Commands](#useful-commands)
18. [Deployment Status](#deployment-status)

---

## Overview

Pulse360 replaces the original **eWay 360° Review** name with a modern product identity. It allows Pulse Technologies employees to conduct semi-annual peer performance reviews aligned to the **eWay** competency framework — covering 6 criteria (MASTERFUL, EXCELLENCE, EXECUTION, COMMITMENT, CONTRIBUTION, ADDITIONAL) across 28 questions.

**Four roles** — System Administrator, HR Administrator, Line Manager, and Employee — each see a tailored dashboard and workflow through an **8-phase review cycle**: Draft → Nominate → Approve → Review → Calculation → Consultation → Accept → Closed. The System Administrator is a separate platform-operations persona for adoption analytics, audit metadata, AI usage, and operational health monitoring without exposing sensitive review scores or comments.

Pulse360 began as a hackathon prototype built with IBM Bob as an agentic development partner. It has since evolved through iterative, human-directed work across the application, deployment, analytics, and FAQ-assistant experience. IBM Bob contributed to the initial implementation; the current repository reflects the broader ongoing project, not a one-day build.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.12 |
| Language | TypeScript | 5.x |
| Production database | Supabase PostgreSQL | PostgreSQL-compatible |
| Local database | PostgreSQL via Podman | Development only |
| ORM | Prisma | 7.9.1 |
| Auth | NextAuth.js | 4.24.15 |
| UI | Tailwind CSS | 4.x |
| AI Text Generation | OpenAI SDK (GPT-4o and GPT-5.1, by feature) | 7.4.0 |
| Agentic AI Platform | IBM Bob | 2 |
| MCP Tooling | Model Context Protocol SDK | 1.11.4 |
| Runtime | Node.js | 22.x |

> **Production note:** Render hosts the Next.js web service and Supabase is the production PostgreSQL source of truth. Podman is optional and is used only for local development. See [the Render-to-Supabase runbook](docs/operations/RENDER_TO_SUPABASE_MIGRATION.md) for the migration record and recovery procedure.

---

## Architecture

```mermaid
flowchart LR
    U[Users] --> R[Render Web Service]
    R --> N[Next.js + TypeScript]
    N --> AUTH[NextAuth + RBAC]
    N --> P[Prisma]
    P --> DB[(Supabase PostgreSQL)]
    N -. optional .-> AI[OpenAI API]
    N --> B[Browser PDF / CSV downloads]
    N -. optional local tools .-> MCP[pulse360-mcp]
    DB --> EVENTS[Audit and Event Tables]
    EVENTS --> SYS[System Admin Aggregated Analytics]
    EVENTS -. future ETL .-> BQ[(BigQuery)]
```

```text
Browser
  -> Render Web Service
       -> Next.js App Router / API routes
       -> NextAuth + server-side RBAC
       -> Prisma
            -> Supabase PostgreSQL
       -> OpenAI API (optional AI assistance)
       -> Browser downloads (CSV and print-to-PDF)
       -> Optional local MCP filesystem tools
```

Supabase stores the transactional application data and dedicated event projections used by the System Admin dashboard. These projections include authentication, profile, nomination, review, audit, AI usage, and AI human-in-the-loop events. System Admin analytics are operational and aggregated; review comments and scores remain outside that dashboard.

BigQuery is a future analytics-warehouse option, not part of the live transaction path. The application should write to Supabase first, then export selected event data through scheduled ETL after the production database is stable.

Production URL: **https://pulse360-gkt8.onrender.com**

### Public entry point

The deployed root URL is the canonical Pulse360 entry point:

**https://pulse360-gkt8.onrender.com/**

The landing page is rendered from the root route, so users do not need to visit
`/landing.html`. The HTML asset remains an internal implementation detail used
by the Next.js root page and is not the public navigation contract.

The landing-page assistant distinguishes the AI assistant avatar from the
human-assistant avatar. Its composer expands while text is entered, then scrolls
internally; Enter sends and Shift+Enter inserts a newline.

The architecture overview and Mermaid diagram are maintained in this README. See the [documentation index](docs/README.md) for operational runbooks and audit history.

> **Blueprint note:** The live Render service uses Supabase through manually supplied `DATABASE_URL` and `DIRECT_URL` values. The Blueprint no longer sources `DATABASE_URL` from the retired Render Postgres resource or declares that database as a managed production dependency.

## Deployment Status

The root homepage and `/login` are the public entry points. Render deploys from
`main` after CI passes (`autoDeployTrigger: checksPass`); use the Render deploy
history to verify which commit is live instead of relying on a fixed commit hash
in this README. The assistant-avatar change was merged through PR #64. Confirm
its production deployment in Render before describing it as live.

### FAQ Assistant RAG Progress

The Supabase vector foundation is now prepared:

- Supabase `pgvector` extension enabled, version `0.8.2`.
- Private `rag` schema created.
- `rag.collections`, `rag.documents`, and `rag.document_chunks` created.
- Initial `pulse360_faq` collection registered.
- `rag.match_document_chunks` retrieval function created for committed FAQ chunks.

The System Admin has a protected `/system-admin/rag` ingestion workspace with an explicit preview gate, local PDF/TXT/Markdown upload, chunk inspection, category selection, and an approve-and-embed action. The server-side proxy keeps the RAG service URL out of the browser and limits access to `SYSTEM_ADMIN` users. Creating the schema and retrieval function does not mean a source document has been embedded; end-to-end ingestion and `/ask` retrieval still require a successful smoke test against the companion RAG service.

The ingestion page is a control surface, not evidence that production embeddings are already stored in Supabase. The backend gate is to write document/chunk metadata and embeddings to Supabase `rag.documents` and `rag.document_chunks`, persist category metadata, connect the `/ask` endpoint to the pgvector retrieval function, and verify the full flow. Google Drive folder sync is intentionally deferred as a future source connector.

The `rag.match_document_chunks` database function is the current retrieval boundary. It accepts a 384-dimensional question embedding, restricts searches to committed documents in `pulse360_faq`, optionally filters by category, applies a minimum similarity threshold of `0.35`, and returns the six highest-ranked chunks with citation metadata by default. Supabase `pgvector` supplies similarity ranking; it does not provide a semantic reranker. A reranker will remain deferred until baseline retrieval quality has been measured.

---

## Team

| Name            | Role                                  |
| ----------------| --------------------------------------|
| Romeo Ndlovu    | Data and AI Engineer / Platform Engineer |
| IBM Bob         | Agentic AI Developer                  |

### Want to test it out for your companies developers:
- Link to 30 day free trial: https://bob.ibm.com/

- IDC research Link (May 05, 2026): https://www-api.ibm.com/adobe/assets/urn:aaid:aem:f72132ce-a92b-43ea-8b57-f8127b773535/original/as/idc-paper-on-ibm-bob-for-agentic-sdlc-development.pdf

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org/) | v22 | Matches the GitHub Actions CI runtime |
| [Podman](https://podman.io/) | v5+ | Used to run the PostgreSQL container |
| npm | v9+ | Bundled with Node.js |

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Shotza247/Pulse360_Hackathon_Day.git
cd Pulse360_Hackathon_Day
```

For production, use the deployed Render service and Supabase database. The local database instructions below are for development only.

### 2. Start an optional local PostgreSQL database

```powershell
# Start the container (first time — creates and seeds the DB)
podman run -d `
  --name pulse360_db `
  -e POSTGRES_USER=pulse360_user `
  -e POSTGRES_PASSWORD=password123 `
  -e POSTGRES_DB=pulse360 `
  -p 5432:5432 `
  postgres:18-alpine

# Apply all init scripts in order
Get-ChildItem database\init\*.sql | Sort-Object Name | ForEach-Object {
  Write-Host "Applying $($_.Name)..."
  Get-Content $_.FullName | podman exec -i pulse360_db psql -U pulse360_user -d pulse360
}
```

If the container already exists from a previous run:

```powershell
podman start pulse360_db
```

### 3. Install app dependencies

```powershell
cd pulse360
npm install
```

### 4. Configure environment variables

Create `pulse360/.env` with the following (never committed to git):

```env
DATABASE_URL="postgresql://pulse360_user:password123@localhost:5432/pulse360"
DIRECT_URL="postgresql://pulse360_user:password123@localhost:5432/pulse360"
NEXTAUTH_SECRET="pulse360-dev-secret-change-in-production-32chars"
NEXTAUTH_URL="http://localhost:3000"
OPENAI_API_KEY="sk-..."    # Optional — app falls back to stub responses if not set
```

### 5. Generate Prisma client

```powershell
cd pulse360
npx prisma generate
```

### 6. Start the development server

```powershell
cd pulse360
npm run dev
```

App is available at **http://localhost:3000** locally

Production app: **https://pulse360-gkt8.onrender.com**

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase pooled/session PostgreSQL connection for application traffic |
| `DIRECT_URL` | ⚠️ Recommended | Supabase direct or stable session connection for Prisma migrations and administrative tooling |
| `NEXTAUTH_SECRET` | ✅ | Random string for JWT signing (min 32 chars) |
| `NEXTAUTH_URL` | ✅ | Base URL of the app: `http://localhost:3000` locally and `https://pulse360-gkt8.onrender.com` in production |
| `OPENAI_API_KEY` | ⚠️ Optional | Enables live AI Comment Suggestions, Theme Summary, Improvement Plan, and PDF Report narrative. App falls back to realistic stub responses if not set. |
| `RAG_API_URL` | ⚠️ Required for FAQ ingestion | Server-side base URL for the companion RAG API. Use `http://127.0.0.1:8767` locally; use the deployed RAG API URL in Render/Vercel. Never expose this as a browser-side secret. |

---

## Database

### Production database

Supabase is the production database. Render is the application host, not the current database runtime target. Prisma migrations are stored under `pulse360/prisma/migrations` and are applied during deployment with `prisma migrate deploy`.

### Local init scripts (`database/init/`)

Scripts are applied in order on first container start:

| File | Purpose |
|---|---|
| `01_extensions.sql` | Enables `pgcrypto` and `citext` extensions |
| `02_enums.sql` | All PostgreSQL ENUM types |
| `03_schema.sql` | 11 tables, triggers, and constraints |
| `04_indexes.sql` | Performance indexes |
| `05_seed_criteria.sql` | 6 eWay criteria + 28 questions |
| `06_seed_departments.sql` | 10 departments |
| `07_seed_employees.sql` | 57 synthetic employees with manager relationships |
| `08_add_password_hash.sql` | bcrypt password hashes for all 57 employees |

### Data Model (17 tables)

| Table | Purpose |
|---|---|
| `department` | 10 org departments |
| `employee` | All users — System Admin, HR Admin, Line Manager, Employee |
| `review_cycle` | Semi-annual review cycles (8-phase lifecycle) |
| `pulse_criterion` | The 6 eWay competency pillars |
| `pulse_question` | 28 individual sub-questions (RATING / TEXT / BOOLEAN) |
| `cycle_criteria` | Junction: which criteria are active per cycle |
| `nomination` | Peer nominations with manager auto-lock |
| `review` | Submitted reviews per reviewer per subject |
| `review_rating` | Individual question answers (score or text) |
| `review_result` | Computed aggregates written at CALCULATION phase |
| `audit_log` | Append-only raw governance event log |
| `auth_event` | Login success/failure projection for adoption and access monitoring |
| `profile_event` | Profile update projection showing which fields changed without exposing old/new values |
| `ai_usage_event` | AI feature usage, status, model, and token metadata |
| `ai_hitl_decision` | Human-in-the-loop accept/edit/discard decisions for AI-generated content |
| `nomination_event` | Nomination lifecycle events with employee/reviewer and department snapshots |
| `review_event` | Review draft/submission metadata without review comments or scores |

The `employee` table now also carries HR-managed workforce dimensions: job grade, employment type, conversion-hire status, gender, and ethnicity. System Admin analytics read from dedicated event tables and aggregated workforce dimensions. Ethnicity is intentionally kept for HR demographic reporting and is not displayed on the System Admin dashboard.

### Verify the database

```powershell
# Connect with psql
podman exec -it pulse360_db psql -U pulse360_user -d pulse360

# Check all tables
\dt

# Check seeded employees
SELECT first_name, last_name, role FROM employee LIMIT 10;

# Check criteria and questions
SELECT c.name AS criterion, COUNT(q.id) AS questions
FROM pulse_criterion c
JOIN pulse_question q ON q.criterion_id = c.id
GROUP BY c.name, c.sort_order
ORDER BY c.sort_order;
```

---

## Running the App

```powershell
# Development (with hot reload)
cd pulse360
npm run dev

# Production build check
cd pulse360
npx next build

# Production server
cd pulse360
npm start
```

---

## Test Accounts

All passwords are bcrypt-hashed in the database — never stored in plain text.

### Primary Test Accounts (Delivery & Technology)

| Role | Email | Password |
|---|---|---|
| **HR Administrator** | `lerato.mkhize@techcorp.co.za` | `Pulse360!Admin` |
| **Line Manager** | `hlanganani.oosthuiz@techcorp.co.za` | `Pulse360!Manager` |
| **Employee** | `mpho.zulu@techcorp.co.za` | `Pulse360!Employee` |

### Secondary Test Accounts (Marketing — different department)

| Role | Email | Password |
|---|---|---|
| **Line Manager** | `zanele.mohamed@techcorp.co.za` | `Pulse360!Manager` |
| **Employee** | `dikeledi.mkhize@techcorp.co.za` | `Pulse360!Employee` |

> Zanele and Dikeledi are in the **Marketing** department. They can only nominate peers within Marketing (department-scoped peer selection). Zanele, as Dikeledi's line manager, appears as her mandatory auto-locked reviewer.

---

## Project Structure

```
Pulse360_Hackathon_Day/
├── README.md
├── .env.example
├── BUG_AUDIT.md
├── docs/                         # Deployment, migration, and incident guides
├── database/init/                # Optional local PostgreSQL bootstrap scripts
├── render.yaml                   # Render Blueprint for the web service
├── .github/workflows/ci.yml      # Pull request and main-branch CI
└── pulse360/                     # Next.js application
    ├── prisma/                   # Prisma schema and versioned migrations
    ├── public/                   # Landing-page and assistant-avatar assets
    ├── scripts/                  # Database seed and maintenance scripts
    └── src/
        ├── app/                  # Public, authenticated, and API routes
        ├── components/           # Shared UI components
        └── lib/                  # Authentication, database, and domain helpers
```

---

## Selected API Endpoints

This is a high-level list, not a generated OpenAPI contract. The route handlers under `pulse360/src/app/api/` are authoritative.

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/callback/credentials` | NextAuth email + password login |

### Cycles
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/cycles` | HR Admin | List all cycles |
| POST | `/api/cycles` | HR Admin | Create new cycle |
| GET | `/api/cycles/list` | HR Admin | Lightweight list for client refresh |
| POST | `/api/cycles/[id]/advance` | HR Admin | Advance to next phase; auto-calculates scores at REVIEW→CALCULATION |

### Nominations
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/nominations` | All | Get my nominations for current cycle |
| POST | `/api/nominations` | Employee | Add a nomination (dept-scoped validation) |
| DELETE | `/api/nominations/[id]` | Employee | Remove a nomination |
| GET | `/api/nominations/cycle` | All | Returns cycle with `effectiveMinNominees` / `effectiveMaxNominees` |
| POST | `/api/nominations/submit` | Employee | Submit all draft nominations (effective min enforced) |

### Approvals
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/approvals` | Manager / HR | List pending nominations scoped to role |
| POST | `/api/approvals/[id]/approve` | Manager / HR | Approve a nomination |
| POST | `/api/approvals/[id]/reject` | Manager / HR | Reject a nomination |
| POST | `/api/approvals/bulk-approve` | Manager / HR | Approve all pending nominations |

### Reviews
| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/api/reviews` | All | Save draft or submit a review |
| GET | `/api/reviews/draft` | All | Load existing draft review |

### Employees
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/employees` | HR Admin | List all employees (paginated, filterable) |
| POST | `/api/employees` | HR Admin | Create new employee |
| GET | `/api/employees/[id]` | All | Get employee by ID |
| PUT | `/api/employees/[id]` | HR Admin | Update employee |
| GET | `/api/employees/list` | All | Dept-scoped list for nomination peer search |
| GET | `/api/employees/managers` | HR Admin | List employees who are managers |

### Criteria
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/criteria` | All | List active criteria (for review form) |
| POST | `/api/criteria` | HR Admin | Create new criterion |
| GET | `/api/criteria/full` | HR Admin | All criteria + questions (for management page) |
| PUT | `/api/criteria/[id]` | HR Admin | Edit name/description or toggle active |

### Analytics & AI
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/analytics/heatmap?cycleId=` | HR Admin | Dept × criterion scores + `allCycles`, `deptOveralls`, `trends` |
| POST | `/api/analytics/report` | HR Admin | Generate the narrative and analytics data for the report preview (GPT-4o or stub) |
| POST | `/api/ai/suggest-comments` | All | Generate AI draft feedback comments from ratings (GPT-4o) |
| POST | `/api/ai/theme-summary` | All | Generate AI theme summary from all peer comments (GPT-4o) |
| POST | `/api/ai/improvement-plan` | All | Generate AI self-improvement plan with gap analysis (GPT-5.1) |

The improvement-plan endpoint currently uses GPT-5.1; comment suggestions, theme summaries, and the report narrative use GPT-4o.
Other implemented route groups include `/api/profile`, `/api/notifications`, `/api/dashboard/*`, `/api/system-admin/rag/*`, and `/api/health`.

### MCP Tool Proxies

These are legacy server-side filesystem endpoints, not the browser download workflow. Avoid passing a user's local machine path to a hosted endpoint.
| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/api/mcp/write-csv` | All (HITL) | Write approved improvement plan to CSV (called post-approval only) |
| POST | `/api/mcp/generate-report` | HR Admin | Legacy server-side HTML file writer; it writes to a server path and is not the browser's PDF download flow |

---

## Review Cycle Lifecycle

Each review cycle advances linearly through 8 phases. HR Administrator controls all phase transitions.

```
DRAFT → NOMINATE → APPROVE → REVIEW → CALCULATION → CONSULTATION → ACCEPT → CLOSED
```

| Phase | Who Acts | What Happens |
|---|---|---|
| **DRAFT** | HR Admin | Creates cycle with name, dates, criteria |
| **NOMINATE** | Employee | Selects inbound/outbound peers; manager auto-locked; dept-scoped pool |
| **APPROVE** | Manager / HR | Approves or rejects individual nominations; bulk approve available |
| **REVIEW** | Employee | Rates each person on 28 questions (1–5) + 2 comments; AI suggestions available |
| **CALCULATION** | System | Auto-calculates per-criterion and overall averages (2 d.p.) |
| **CONSULTATION** | Manager / HR | Results visible to manager and HR; employee sees locked message |
| **ACCEPT** | Employee | Employee views own results, AI summary, and self-assessment gap analysis |
| **CLOSED** | HR Admin | Results become read-only historical record; visible in analytics history |

---

## Features Implemented

### ✅ MVP 1 — All Complete

| Category                | Features                                                                             |
| -------------------------| --------------------------------------------------------------------------------------|
| **Auth & RBAC**         | Email + bcrypt login, JWT sessions, role-based route guards, 4 roles                 |
| **Employee Management** | Add, edit, deactivate, set manager, 57 seeded employees, 10 departments              |
| **Review Cycles**       | Create, 8-phase advance, phase stepper UI, one active cycle enforced                 |
| **Nominations**         | Inbound/outbound peer selection, manager auto-locked, draft + submit, min/max limits |
| **Approvals**           | Manager approves/rejects per nominee; HR Admin bulk approve; scoped by role          |
| **Reviews**             | 28-question form (25 RATING + 2 TEXT + 1 BOOLEAN), draft save, submit lock           |
| **Score Calculation**   | Auto-triggers at REVIEW→CALCULATION; per-criterion + overall averages to 2 d.p.      |
| **Results**             | Phase-gated: HR+Manager from CONSULTATION, Employee from ACCEPT only                 |
| **Dashboards**          | Role-specific dashboards with progress rings, action banners, team rosters           |

### ✅ MVP 2 — Implemented and planned capabilities

| Feature                                      | Status          | Notes                                                                                                  |
| ----------------------------------------------| -----------------| --------------------------------------------------------------------------------------------------------|
| View / Add / Edit / Deactivate eWay criteria | ✅ Done          | Full CRUD with historical preservation                                                                 |
| **AI Comment Suggestions**                   | ✅ Done          | GPT-4o generates "doing well" + "improve" draft; reviewer Accepts / Edits / Discards → live HITL       |
| **AI Feedback Theme Summary**                | ✅ Done          | GPT-4o surfaces top 3 strengths, top 3 growth areas, overall sentiment                                 |
| **Department Heatmap**                       | ✅ Done          | Colour-coded grid (red→amber→green), org averages, top/bottom panels                                   |
| **PDF Report Generation**                    | ✅ Done          | HR reviews/edits narrative with analytics preview, approves, then opens the browser print dialog to save as PDF |
| **Self-Assessment + Gap Analysis**           | ✅ Done          | Employee self-rates with sliders; AI computes gap vs peer score; labels Overrating/Underrating/Aligned |
| **Historical Trend Comparison**              | ✅ Done          | SVG grouped bar chart across all closed cycles; per-criterion org averages compared                    |
| Bulk employee import (XLSX)                  | ⬜ Not built     | Add Employee UI exists for one-at-a-time entry                                                         |
| **In-App Notification Bell**                 | ✅ Done          | Bell icon in top bar; role-scoped notifications on every phase transition; red unread badge; mark-read per item or bulk; 30 s auto-poll |
| Mobile Responsive UI                         | ✅ Done          | Tested and confirmed — layout adjusts across all screen sizes                                          |
| Calibration View                             | ⬜ Not built     | Department heatmap partially fulfils this requirement                                                  |
| **System Admin Audit Trail & Platform Dashboard** | ✅ Done          | Custom `SYSTEM_ADMIN` role and UI for platform adoption, audit metadata, AI usage, HITL decisions, approval health, and anonymized behavioral analytics |

### ✨ Custom / Beyond-Spec Features

| Feature | Description |
|---|---|
| **AI Self-Improvement Plan** | After gap analysis, AI generates a personalised weekly action / monthly goal / success metric per criterion. The employee reviews and approves before downloading the CSV. |
| **MCP Server (pulse360-mcp)** | Optional local TypeScript tools for filesystem exports. These are separate from the web app's browser-based downloads and should not be used to write to a user's local path from the hosted service. |
| **Department-Scoped Nominations** | Peer selection restricted to same department for non-HR roles — enforced both in the employee list API and nomination POST validation. |
| **Small-Department Adaptive Limits** | `effectiveMinNominees` and `effectiveMaxNominees` auto-calculated from pool size, so teams of 2 can still complete the nomination workflow. |
| **Cycle History Selector** | Analytics dashboard lets HR choose any historical closed cycle to view, compare, and report on. |
| **Pie Chart Visualisation** | Pure SVG (no external charting lib) showing each department's share of the org-wide average score. |
| **Bulk Approve Nominations** | HR Admin can approve all pending nominations with one click (per employee or all at once). |
| **CSV Export** | Approved improvement plan is downloaded by the user's browser as an Excel-compatible CSV; no machine-specific Windows path is used. |
| **System Admin Platform Analytics** | Dedicated System Admin experience for adoption, login activity, nomination/review completion, approval bottlenecks, anonymized behavioral network patterns, AI token metadata, and AI accept/edit/discard decisions. |
| **Audit Trail Events** | Captures key operational events such as logins, profile updates, nomination actions, approval/rejection decisions, review submissions, AI generation calls, and human-in-the-loop AI decisions. |

---

## Human-in-the-Loop Log

The hackathon rules require minimum 3 HITL interventions. We documented **10**:

### Development-Time HITL (Bob as Developer — Human as Reviewer)

| # | Type | Description | Outcome |
|---|---|---|---|
| 1 | **Architecture Decision** | Bob suggested Office 365 SSO (OAuth). Human overrode to email + bcrypt — simpler, no external dependencies, demo-safe | Implemented email + bcrypt auth |
| 2 | **Security Review** | Bob generated fake bcrypt hashes in seed SQL. Human identified they would fail `bcrypt.compare()` at login | Replaced with real hashes generated via script |
| 3 | **Code Review** | Bob used NextAuth v5 beta which broke Next.js 16 route handler types | Downgraded to NextAuth v4.24.15 |
| 4 | **Business Logic** | Bob made manager nomination removable. Spec requires manager to be auto-locked | Added `isMandatory` flag; manager locked in nominations UI |
| 5 | **UX Override** | Bob allowed review submission with partial ratings. Human enforced: all 28 questions + both comments ≥ 20 chars | Full validation before submit enables |
| 6 | **Business Logic** | Dept-scoped peer validation missing — Zanele and Dikeledi could not review within-dept peers due to missing pool-size adaptive limits | Added `effectiveMinNominees` / `effectiveMaxNominees` across three endpoints |

### In-App HITL (User as Reviewer — AI as Assistant)

| # | Feature | HITL Moment | What the Human Decides |
|---|---|---|---|
| 7 | **AI Comment Suggestions** | Reviewer sees AI-generated "doing well" and "improve" text before saving a review | Accept as-is / Edit / Discard — full control retained |
| 8 | **AI Feedback Theme Summary** | Employee or manager clicks Generate to surface top 3 strengths and growth areas | Human reads the output and decides how to act on it |
| 9 | **AI PDF Report Generation** | HR Admin generates a narrative and analytics preview, reviews/edits it, and approves | **Print / Save PDF** opens the browser print dialog; the user selects Save as PDF |
| 10 | **AI Self-Improvement Plan** | Employee reviews weekly actions, monthly goals, and success metrics | The browser downloads CSV only after explicit approval |

---

## IBM Bob — Agentic AI Platform Notes

### What Bob did in this project

IBM Bob was used as the **primary development agent** throughout the hackathon, playing multiple roles:

| Role Bob Played | Examples |
|---|---|
| **Full-Stack Developer** | Scaffolded and implemented all Next.js pages, API routes, Prisma schema, and auth |
| **Data Architect** | Designed 11-table PostgreSQL schema, seeded 57 synthetic employees, modelled 8-phase cycle lifecycle |
| **Security Reviewer** | Identified bcrypt hash issue, enforced RBAC on every API route, added server-side nomination validation |
| **QA / Tester** | Ran `tsc --noEmit` after every change, caught TypeScript errors, validated API contracts |
| **AI Feature Developer** | Built AI endpoints for comments, theme summaries, improvement plans, and reports, with feature-specific models and fallback behavior |
| **MCP Server Builder** | Built optional filesystem tools; the hosted web download experience uses browser downloads instead |
| **Technical Writer** | Generated this README, the executive summary, and inline code documentation |

### Key IBM Bob capabilities demonstrated

- **Multi-turn agentic reasoning** —  Bob maintained context across a full day of iterative feature requests without losing architectural context
- **Human-in-the-Loop orchestration** — Using Bob I built HITL checkpoints into the product itself (AI suggestions require human approval before persistence)
- **MCP tool authoring** — Built optional local filesystem tools; the hosted web UI uses browser-based exports.
- **Text generation integration** — AI features use GPT-4o or GPT-5.1 according to the endpoint, with prompt parsing and fallback behavior where implemented.
- **TypeScript discipline** — Every change validated with `tsc --noEmit` before being considered complete
- **Parallel task execution** — Bob ran independent tasks in parallel (DB clear + API build + MCP build + page rebuild) to compress build time

- **The best part is all this was done with full oversite and guidance from me through prompts and feature tunning.**

### MCP Server (`pulse360-mcp`)

The local `pulse360-mcp` server exposes filesystem tools. They are not the download path used by the hosted web UI:

| Tool | Trigger | Guard |
|---|---|---|
| `write_csv` | Explicit local MCP invocation | Writes to a server/local filesystem path; do not use it for a hosted user's browser download |
| `generate_pdf_report` | Explicit local MCP invocation | Writes HTML to a server/local filesystem path; browser report export instead opens Print / Save PDF |

---

## Useful Commands

```powershell
# ── Database ──────────────────────────────────────────────────────────────────

# Check container is running
podman ps --filter "name=pulse360_db"

# Start if stopped
podman start pulse360_db

# Connect to psql
podman exec -it pulse360_db psql -U pulse360_user -d pulse360

# Run a SQL script manually
Get-Content database\init\03_schema.sql | podman exec -i pulse360_db psql -U pulse360_user -d pulse360

# ── App ───────────────────────────────────────────────────────────────────────

# Install dependencies
cd pulse360; npm install

# Development server (http://localhost:3000)
cd pulse360; npm run dev

# Production build check
cd pulse360; npx next build

# Regenerate Prisma client (after schema changes)
cd pulse360; npx prisma generate

# ── MCP Server ────────────────────────────────────────────────────────────────

# Rebuild MCP server after changes
cd pulse360/mcp-server; npm run build

# ── Git ───────────────────────────────────────────────────────────────────────

# Check status
git status

# Push to GitHub
git add -A
git commit -m "feat: describe your change"
git push origin <branch-name>
```

---

*Built with **IBM Bob** · Pulse360 · Pulse Technologies Hackathon V1 · 2026*

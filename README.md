# Pulse360 — 360° Performance Review

> **Pulse360** is a full-stack internal 360° performance review platform built for semi-annual cycles.
> Built by the **IBM Bob** team at the Ovations Technologies Hackathon V2 — AI App Build IDE Challenge.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Team](#team)
4. [Prerequisites](#prerequisites)
5. [Getting Started](#getting-started)
6. [Environment Variables](#environment-variables)
7. [Database](#database)
8. [Running the App](#running-the-app)
9. [Test Accounts](#test-accounts)
10. [Project Structure](#project-structure)
11. [API Reference](#api-reference)
12. [Review Cycle Lifecycle](#review-cycle-lifecycle)
13. [Features Implemented](#features-implemented)
14. [Human-in-the-Loop Log](#human-in-the-loop-log)
15. [IBM Bob — Agentic AI Platform Notes](#ibm-bob--agentic-ai-platform-notes)
16. [Useful Commands](#useful-commands)

---

## Overview

Pulse360 replaces the original **eWay 360° Review** name with a modern product identity. It allows Ovations Technologies employees to conduct semi-annual peer performance reviews aligned to the **eWay** competency framework — covering 6 criteria (MASTERFUL, EXCELLENCE, EXECUTION, COMMITMENT, CONTRIBUTION, ADDITIONAL) across 28 questions.

**Three roles** — HR Administrator, Line Manager, and Employee — each see a tailored dashboard and workflow through an **8-phase review cycle**: Draft → Nominate → Approve → Review → Calculation → Consultation → Accept → Closed.

All features were built using **IBM Bob**, an enterprise agentic AI platform, in a single hackathon day. Bob acted as Developer, Architect, QA Reviewer, Data Engineer, and Security Reviewer throughout the build.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.12 |
| Language | TypeScript | 5.x |
| Database | PostgreSQL | 16 |
| Container | Podman | 5.7.1 |
| ORM | Prisma | 7.9.1 |
| Auth | NextAuth.js | 4.24.15 |
| UI | Tailwind CSS | 4.x |
| AI Text Generation | OpenAI SDK (GPT-4o) | 7.4.0 |
| Agentic AI Platform | IBM Bob | — |
| MCP Tooling | Model Context Protocol SDK | 1.11.4 |
| Runtime | Node.js | 22.x |

> **Note:** This project uses **Podman** (not Docker). The `docker-compose.yml` in the root is kept for reference only. The database is started with `podman run` — see [Database](#database).

---

## Team

| Name            | Role                                  |
| ----------------| --------------------------------------|
| Romeo Ndlovu    | Data Architect / Engineer / Scientist |
| IBM Bob         | Agentic AI Developer                  |

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org/) | v20+ | Required to run the Next.js app |
| [Podman](https://podman.io/) | v5+ | Used to run the PostgreSQL container |
| npm | v9+ | Bundled with Node.js |

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://bitbucket.org/ovmobile/hackathon-v2-ibm.git
cd hackathon-v2-ibm
```

### 2. Start the PostgreSQL database

```powershell
# Start the container (first time — creates and seeds the DB)
podman run -d `
  --name pulse360_db `
  -e POSTGRES_USER=pulse360_user `
  -e POSTGRES_PASSWORD=password123 `
  -e POSTGRES_DB=pulse360 `
  -p 5432:5432 `
  postgres:16-alpine

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

App is available at **http://localhost:3000**

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | ✅ | Random string for JWT signing (min 32 chars) |
| `NEXTAUTH_URL` | ✅ | Base URL of the app (`http://localhost:3000` locally) |
| `OPENAI_API_KEY` | ⚠️ Optional | Enables live AI Comment Suggestions, Theme Summary, Improvement Plan, and PDF Report narrative. App falls back to realistic stub responses if not set. |

---

## Database

### Init scripts (`database/init/`)

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

### Data Model (11 tables)

| Table | Purpose |
|---|---|
| `department` | 10 org departments |
| `employee` | All users — HR Admin, Line Manager, Employee |
| `review_cycle` | Semi-annual review cycles (8-phase lifecycle) |
| `pulse_criterion` | The 6 eWay competency pillars |
| `pulse_question` | 28 individual sub-questions (RATING / TEXT / BOOLEAN) |
| `cycle_criteria` | Junction: which criteria are active per cycle |
| `nomination` | Peer nominations with manager auto-lock |
| `review` | Submitted reviews per reviewer per subject |
| `review_rating` | Individual question answers (score or text) |
| `review_result` | Computed aggregates written at CALCULATION phase |
| `audit_log` | Append-only event log |

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
hackathon-v2-ibm/
├── README.md
├── .env.example
├── docker-compose.yml              # Reference only — use Podman
├── .bob/
│   └── mcp.json                    # MCP server registration (pulse360-mcp)
├── database/
│   └── init/                       # 8 SQL init scripts (applied in order)
│       ├── 01_extensions.sql
│       ├── 02_enums.sql
│       ├── 03_schema.sql
│       ├── 04_indexes.sql
│       ├── 05_seed_criteria.sql
│       ├── 06_seed_departments.sql
│       ├── 07_seed_employees.sql
│       └── 08_add_password_hash.sql
└── pulse360/                        # Next.js application
    ├── .env                         # Local env (not committed)
    ├── next.config.ts
    ├── prisma.config.ts             # Prisma v7 datasource config
    ├── prisma/
    │   └── schema.prisma            # 11 models, 7 enums
    ├── mcp-server/                  # ✨ Custom MCP server (TypeScript)
    │   ├── src/index.ts             # Two tools: write_csv, generate_pdf_report
    │   ├── build/index.js           # Compiled output (registered in .bob/mcp.json)
    │   └── package.json
    └── src/
        ├── proxy.ts                 # Next.js 16 middleware (RBAC route guards)
        ├── components/
        │   ├── Sidebar.tsx          # Role-aware navigation
        │   ├── CycleList.tsx        # Cycle phase stepper (client component)
        │   ├── AISummaryPanel.tsx   # AI Feedback Theme Summary panel
        │   └── SelfAssessmentPanel.tsx  # ✨ Self-assessment + gap analysis + improvement plan
        ├── lib/
        │   ├── auth.ts              # NextAuth v4 credentials provider
        │   ├── auth.types.ts        # Session type augmentation
        │   └── prisma.ts            # PrismaClient singleton with pg adapter
        └── app/
            ├── layout.tsx
            ├── page.tsx             # Root redirect → /dashboard or /login
            ├── globals.css
            ├── login/
            ├── api/
            │   ├── auth/[...nextauth]/
            │   ├── ai/
            │   │   ├── suggest-comments/     # POST — AI comment suggestions (GPT-4o)
            │   │   ├── theme-summary/        # POST — AI feedback theme analysis (GPT-4o)
            │   │   └── improvement-plan/     # ✨ POST — AI self-improvement plan + gap analysis
            │   ├── analytics/
            │   │   ├── heatmap/              # GET — dept × criterion heatmap + trends + pie data
            │   │   └── report/               # ✨ POST — AI-generated PDF report HTML
            │   ├── mcp/
            │   │   ├── write-csv/            # ✨ POST — MCP tool proxy: write improvement plan CSV
            │   │   └── generate-report/      # ✨ POST — MCP tool proxy: write approved report HTML
            │   ├── approvals/[id]/approve/   # POST
            │   ├── approvals/[id]/reject/    # POST
            │   ├── approvals/bulk-approve/   # POST
            │   ├── criteria/                 # GET (active), POST (create new)
            │   ├── criteria/full/            # GET (all + questions)
            │   ├── criteria/[id]/            # PUT (edit / toggle active)
            │   ├── cycles/                   # GET, POST
            │   ├── cycles/list/              # GET (lightweight list)
            │   ├── cycles/[id]/advance/      # POST (advance phase + auto-calculate scores)
            │   ├── departments/              # GET
            │   ├── employees/                # GET, POST
            │   ├── employees/list/           # GET (dept-scoped for non-HR roles) ✨ Updated
            │   ├── employees/managers/       # GET
            │   ├── employees/[id]/           # GET, PUT
            │   ├── nominations/              # GET, POST (dept-scoped validation) ✨ Updated
            │   ├── nominations/cycle/        # GET (effective min/max per pool size) ✨ Updated
            │   ├── nominations/submit/       # POST (effective min per pool size) ✨ Updated
            │   ├── nominations/[id]/         # DELETE
            │   ├── reviews/                  # POST (save/submit)
            │   └── reviews/draft/            # GET (load draft)
            └── (app)/                        # Authenticated app shell
                ├── layout.tsx               # Sidebar + session wrapper
                ├── analytics/               # ✨ Rebuilt: cycle selector, pie chart, trend bars, heatmap, AI report
                ├── approvals/               # HR Admin + Manager — nomination approvals + bulk approve
                ├── criteria/                # HR Admin — view/edit/add/deactivate criteria
                ├── cycles/                  # HR Admin — list cycles + advance phases
                ├── cycles/new/              # HR Admin — create new cycle
                ├── dashboard/               # All roles — role-specific dashboards
                ├── employees/               # HR Admin — employee list
                ├── employees/[id]/          # HR Admin — add/edit employee
                ├── manager/results/         # Manager — team results + AI summary
                ├── my-results/              # ✨ Employee — own results + AI summary + self-assessment
                ├── nominations/             # Employee + Manager — nominate peers (dept-scoped)
                ├── results/                 # HR Admin — all employee results
                ├── reviews/                 # All roles — pending review list
                └── reviews/[employeeId]/    # All roles — 28-question form + AI suggestions
```

---

## API Reference

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
| POST | `/api/analytics/report` | HR Admin | Generate AI narrative HTML report (GPT-4o or stub) |
| POST | `/api/ai/suggest-comments` | All | Generate AI draft feedback comments from ratings (GPT-4o) |
| POST | `/api/ai/theme-summary` | All | Generate AI theme summary from all peer comments (GPT-4o) |
| POST | `/api/ai/improvement-plan` | All | Generate AI self-improvement plan with gap analysis (GPT-4o) |

### MCP Tool Proxies
| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/api/mcp/write-csv` | All (HITL) | Write approved improvement plan to CSV (called post-approval only) |
| POST | `/api/mcp/generate-report` | HR Admin (HITL) | Write approved HTML report to disk (called post-approval only) |

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
| **Auth & RBAC**         | Email + bcrypt login, JWT sessions, role-based route guards, 3 roles                 |
| **Employee Management** | Add, edit, deactivate, set manager, 57 seeded employees, 10 departments              |
| **Review Cycles**       | Create, 8-phase advance, phase stepper UI, one active cycle enforced                 |
| **Nominations**         | Inbound/outbound peer selection, manager auto-locked, draft + submit, min/max limits |
| **Approvals**           | Manager approves/rejects per nominee; HR Admin bulk approve; scoped by role          |
| **Reviews**             | 28-question form (25 RATING + 2 TEXT + 1 BOOLEAN), draft save, submit lock           |
| **Score Calculation**   | Auto-triggers at REVIEW→CALCULATION; per-criterion + overall averages to 2 d.p.      |
| **Results**             | Phase-gated: HR+Manager from CONSULTATION, Employee from ACCEPT only                 |
| **Dashboards**          | Role-specific dashboards with progress rings, action banners, team rosters           |

### ✅ MVP 2 — Completed (10 of 15 features)

| Feature                                      | Status          | Notes                                                                                                  |
| ----------------------------------------------| -----------------| --------------------------------------------------------------------------------------------------------|
| View / Add / Edit / Deactivate eWay criteria | ✅ Done          | Full CRUD with historical preservation                                                                 |
| **AI Comment Suggestions**                   | ✅ Done          | GPT-4o generates "doing well" + "improve" draft; reviewer Accepts / Edits / Discards → live HITL       |
| **AI Feedback Theme Summary**                | ✅ Done          | GPT-4o surfaces top 3 strengths, top 3 growth areas, overall sentiment                                 |
| **Department Heatmap**                       | ✅ Done          | Colour-coded grid (red→amber→green), org averages, top/bottom panels                                   |
| **PDF Report Generation**                    | ✅ Done          | AI generates narrative HTML report; human reviews + edits; MCP tool writes to disk post-approval       |
| **Self-Assessment + Gap Analysis**           | ✅ Done          | Employee self-rates with sliders; AI computes gap vs peer score; labels Overrating/Underrating/Aligned |
| **Historical Trend Comparison**              | ✅ Done          | SVG grouped bar chart across all closed cycles; per-criterion org averages compared                    |
| Bulk employee import (XLSX)                  | ⬜ Not built     | Add Employee UI exists for one-at-a-time entry                                                         |
| **In-App Notification Bell**                 | ✅ Done          | Bell icon in top bar; role-scoped notifications on every phase transition; red unread badge; mark-read per item or bulk; 30 s auto-poll |
| Mobile Responsive UI                         | ✅ Done          | Tested and confirmed — layout adjusts across all screen sizes                                          |
| Calibration View                             | ⬜ Not built     | Department heatmap partially fulfils this requirement                                                  |
| Audit Trail UI                               | ⬜ Schema exists | `audit_log` table in use (stores notifications + reads); dedicated UI not built                        |

### ✨ Custom / Beyond-Spec Features

| Feature | Description |
|---|---|
| **AI Self-Improvement Plan** | After gap analysis, AI generates a personalised weekly action / monthly goal / success metric per criterion. Human must approve before export. |
| **MCP Server (pulse360-mcp)** | Custom TypeScript MCP server with `write_csv` and `generate_pdf_report` tools, registered in Bob's MCP panel. Invoked only post human approval. |
| **Department-Scoped Nominations** | Peer selection restricted to same department for non-HR roles — enforced both in the employee list API and nomination POST validation. |
| **Small-Department Adaptive Limits** | `effectiveMinNominees` and `effectiveMaxNominees` auto-calculated from pool size, so teams of 2 can still complete the nomination workflow. |
| **Cycle History Selector** | Analytics dashboard lets HR choose any historical closed cycle to view, compare, and report on. |
| **Pie Chart Visualisation** | Pure SVG (no external charting lib) showing each department's share of the org-wide average score. |
| **Bulk Approve Nominations** | HR Admin can approve all pending nominations with one click (per employee or all at once). |
| **CSV Export via MCP** | Approved improvement plan written as Excel-compatible CSV via the `write_csv` MCP tool — human must click Approve first. |

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
| 9 | **AI PDF Report Generation** | HR Admin generates AI narrative report → reviews it in a preview pane → optionally edits raw HTML | Must click **Approve & Save** before MCP tool writes the file |
| 10 | **AI Self-Improvement Plan** | Employee reviews weekly actions, monthly goals, success metrics → must click **I've reviewed this — Approve** | MCP `write_csv` tool only fires after explicit human approval |

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
| **AI Feature Developer** | Built all 4 AI endpoints (suggest-comments, theme-summary, improvement-plan, report) with GPT-4o + stub fallback |
| **MCP Server Builder** | Scaffolded, implemented, and registered the `pulse360-mcp` server with `write_csv` and `generate_pdf_report` tools |
| **Technical Writer** | Generated this README, the executive summary, and inline code documentation |

### Key IBM Bob capabilities demonstrated

- **Multi-turn agentic reasoning** — Bob maintained context across a full day of iterative feature requests without losing architectural context
- **Human-in-the-Loop orchestration** — Bob built HITL checkpoints into the product itself (AI suggestions require human approval before persistence)
- **MCP tool authoring** — Bob created a custom MCP server from scratch, registered it, and wired it into the app's approval flow
- **Text generation integration** — All four AI features use GPT-4o for text generation, with Bob writing the prompts, parsing the responses, and building the stub fallback chain
- **TypeScript discipline** — Every change validated with `tsc --noEmit` before being considered complete
- **Parallel task execution** — Bob ran independent tasks in parallel (DB clear + API build + MCP build + page rebuild) to compress build time

### MCP Server (`pulse360-mcp`)

Registered at `.bob/mcp.json`. Two tools:

| Tool | Trigger | Guard |
|---|---|---|
| `write_csv` | User approves improvement plan → clicks Download | Post-approval only; description states "invoke ONLY after user review" |
| `generate_pdf_report` | HR Admin approves report → clicks Save to Downloads | Post-approval only; description states "invoke ONLY after human review" |

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

# Push to Bitbucket
git add -A
git commit -m "feat: describe your change"
git push origin main
```

---

*Built with **IBM Bob** · Pulse360 · Technologies Hackathon V2 · 2025*

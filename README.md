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
15. [Useful Commands](#useful-commands)

---

## Overview

Pulse360 replaces the original **eWay 360° Review** name with a modern product identity. It allows Ovations Technologies employees to conduct semi-annual peer performance reviews aligned to the **eWay** competency framework — covering 6 criteria (MASTERFUL, EXCELLENCE, EXECUTION, COMMITMENT, CONTRIBUTION, ADDITIONAL) across 28 questions.

**Three roles** — HR Administrator, Line Manager, and Employee — each see a tailored dashboard and workflow through an **8-phase review cycle**: Draft → Nominate → Approve → Review → Calculation → Consultation → Accept → Closed.

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
| AI | OpenAI SDK | latest |
| Runtime | Node.js | 20+ |

> **Note:** This project uses **Podman** (not Docker). The `docker-compose.yml` in the root is kept for reference only. The database is started with `podman run` — see [Database](#database).

---

## Team

| Name            | Role                                  |
| -----------------| ---------------------------------------|
| Jabulani Ndlovu | Data Architect / Engineer / Scientist |
| Jabulani Ndlovu | Agentic AI BOB Developer              |
| IBM BOB         | Developer                             |

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
OPENAI_API_KEY="sk-..."
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
| `OPENAI_API_KEY` | ⚠️ Optional | Enables live AI Comment Suggestions & Theme Summary. App falls back to stub responses if not set. |

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

| Role | Email | Password |
|---|---|---|
| **HR Administrator** | `lerato.mkhize@techcorp.co.za` | `Pulse360!Admin` |
| **Line Manager** | `hlanganani.oosthuiz@techcorp.co.za` | `Pulse360!Manager` |
| **Employee** | `mpho.zulu@techcorp.co.za` | `Pulse360!Employee` |

---

## Project Structure

```
hackathon-v2-ibm/
├── README.md
├── .env.example
├── docker-compose.yml              # Reference only — use Podman
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
└── pulse360/                       # Next.js application
    ├── .env                        # Local env (not committed)
    ├── next.config.ts
    ├── prisma.config.ts            # Prisma v7 datasource config
    ├── prisma/
    │   └── schema.prisma           # 11 models, 7 enums
    └── src/
        ├── proxy.ts                # Next.js 16 middleware (RBAC route guards)
        ├── components/
        │   ├── Sidebar.tsx         # Role-aware navigation
        │   ├── CycleList.tsx       # Cycle phase stepper (client component)
        │   └── AISummaryPanel.tsx  # AI Feedback Theme Summary panel
        ├── lib/
        │   ├── auth.ts             # NextAuth v4 credentials provider
        │   ├── auth.types.ts       # Session type augmentation
        │   └── prisma.ts           # PrismaClient singleton with pg adapter
        └── app/
            ├── layout.tsx
            ├── page.tsx            # Root redirect → /dashboard or /login
            ├── globals.css
            ├── login/
            ├── api/
            │   ├── auth/[...nextauth]/
            │   ├── ai/
            │   │   ├── suggest-comments/   # POST — AI comment suggestions (GPT-4o)
            │   │   └── theme-summary/      # POST — AI feedback theme analysis (GPT-4o)
            │   ├── analytics/
            │   │   └── heatmap/            # GET — dept × criterion heatmap data
            │   ├── approvals/[id]/approve/ # POST
            │   ├── approvals/[id]/reject/  # POST
            │   ├── criteria/               # GET (active), POST (create new)
            │   ├── criteria/full/          # GET (all + questions)
            │   ├── criteria/[id]/          # PUT (edit / toggle active)
            │   ├── cycles/                 # GET, POST
            │   ├── cycles/list/            # GET (lightweight list)
            │   ├── cycles/[id]/advance/    # POST (advance phase + auto-calculate scores)
            │   ├── departments/            # GET
            │   ├── employees/              # GET, POST
            │   ├── employees/list/         # GET (lightweight list)
            │   ├── employees/managers/     # GET
            │   ├── employees/[id]/         # GET, PUT
            │   ├── nominations/            # GET, POST
            │   ├── nominations/cycle/      # GET (by cycle)
            │   ├── nominations/submit/     # POST (submit all draft nominations)
            │   ├── nominations/[id]/       # DELETE
            │   ├── reviews/                # POST (save/submit)
            │   └── reviews/draft/          # GET (load draft)
            └── (app)/                      # Authenticated app shell
                ├── layout.tsx              # Sidebar + session wrapper
                ├── analytics/              # HR Admin — department heatmap ✨ MVP 2
                ├── approvals/              # HR Admin + Manager — nomination approvals
                ├── criteria/               # HR Admin — view/edit/add/deactivate criteria
                ├── cycles/                 # HR Admin — list cycles + advance phases
                ├── cycles/new/             # HR Admin — create new cycle
                ├── dashboard/              # All roles — role-specific dashboards
                ├── employees/              # HR Admin — employee list
                ├── employees/[id]/         # HR Admin — add/edit employee
                ├── employees/[id]/edit/    # Redirect alias
                ├── manager/results/        # Manager — team results + AI summary ✨ MVP 2
                ├── my-results/             # Employee — own results + AI summary ✨ MVP 2
                ├── nominations/            # Employee + Manager — nominate peers
                ├── results/                # HR Admin — all employee results
                ├── reviews/                # All roles — pending review list
                └── reviews/[employeeId]/   # All roles — 28-question form + AI suggestions ✨ MVP 2
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
| GET | `/api/nominations` | All | Get nominations for current user |
| POST | `/api/nominations` | Employee | Add a nomination |
| DELETE | `/api/nominations/[id]` | Employee | Remove a nomination |
| GET | `/api/nominations/cycle` | All | Get all nominations for active cycle |
| POST | `/api/nominations/submit` | Employee | Submit all draft nominations |

### Approvals
| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/api/approvals/[id]/approve` | Manager / HR Admin | Approve a nomination |
| POST | `/api/approvals/[id]/reject` | Manager / HR Admin | Reject a nomination |

### Reviews
| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/api/reviews` | All | Save draft or submit a review |
| GET | `/api/reviews/draft` | All | Load existing draft review |

### Employees
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/employees` | HR Admin | List all employees |
| POST | `/api/employees` | HR Admin | Create new employee |
| GET | `/api/employees/[id]` | All | Get employee by ID |
| PUT | `/api/employees/[id]` | HR Admin | Update employee |
| GET | `/api/employees/list` | All | Lightweight employee list |
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
| GET | `/api/analytics/heatmap` | HR Admin | Avg scores per department × criterion |
| POST | `/api/ai/suggest-comments` | All | Generate AI draft feedback comments from ratings (GPT-4o) |
| POST | `/api/ai/theme-summary` | All | Generate AI theme summary from all peer comments (GPT-4o) |

---

## Review Cycle Lifecycle

Each review cycle advances linearly through 8 phases. HR Administrator controls all phase transitions.

```
DRAFT → NOMINATE → APPROVE → REVIEW → CALCULATION → CONSULTATION → ACCEPT → CLOSED
```

| Phase | Who Acts | What Happens |
|---|---|---|
| **DRAFT** | HR Admin | Creates cycle with name, dates, criteria |
| **NOMINATE** | Employee | Selects inbound/outbound peers; manager auto-locked |
| **APPROVE** | Manager / HR | Approves or rejects individual nominations |
| **REVIEW** | Employee | Rates each person on 28 questions (1–5) + 2 comments |
| **CALCULATION** | System | Auto-calculates per-criterion and overall averages (2 d.p.) |
| **CONSULTATION** | Manager / HR | Results visible to manager and HR; employee sees locked message |
| **ACCEPT** | Employee | Employee can now view own results and anonymised comments |
| **CLOSED** | HR Admin | Results become read-only historical record |

---

## Features Implemented

### ✅ MVP 1 — All Complete

| Category | Features |
|---|---|
| **Auth & RBAC** | Email + bcrypt login, JWT sessions, role-based route guards, 3 roles |
| **Employee Management** | Add, edit, deactivate, set manager, 57 seeded employees |
| **Review Cycles** | Create, 8-phase advance, phase stepper UI, one active cycle enforced |
| **Nominations** | Inbound/outbound peer selection, manager auto-locked, draft + submit, min/max limits |
| **Approvals** | Manager approves/rejects per nominee; HR Admin sees all nominations |
| **Reviews** | 28-question form (25 RATING + 2 TEXT + 1 BOOLEAN), draft save, submit lock |
| **Score Calculation** | Auto-triggers at REVIEW→CALCULATION; per-criterion + overall averages to 2 d.p. |
| **Results** | Phase-gated: HR+Manager from CONSULTATION, Employee from ACCEPT only |
| **Dashboards** | Role-specific dashboards with progress rings, action banners, team rosters |

### ✅ MVP 2 — Partial (7 of 15 features)

| Feature | Status |
|---|---|
| View eWay criteria list | ✅ Done |
| Add new eWay criterion | ✅ Done — modal with name + description |
| Edit existing criterion | ✅ Done — inline edit |
| Deactivate criterion | ✅ Done — toggle with historical preservation |
| **AI Comment Suggestions** | ✅ Done — `✨ AI Suggest Comments` button on review form; GPT-4o generates "doing well" + "improve" draft; reviewer Accepts / Edits / Discards → HITL decision logged |
| **AI Feedback Theme Summary** | ✅ Done — `✨ Generate AI Summary` on My Results + Team Results pages; GPT-4o surfaces top 3 strengths, top 3 growth areas, overall sentiment |
| **Department Heatmap** | ✅ Done — `/analytics` page; colour-coded grid (red→amber→green), org averages, top/bottom department panels |
| Bulk employee import (XLSX) | ⬜ Not built |
| PDF Report Generation | ⬜ Not built |
| Self-Assessment + Gap Analysis | ⬜ Not built |
| Historical Trend Comparison | ⬜ Not built |
| Email / In-App Notifications | ⬜ Not built |
| Mobile Responsive UI | ⬜ Not explicitly tested |
| Calibration View | ⬜ Not built |
| Audit Trail | ⬜ Schema exists (`audit_log` table); UI not built |

---

## Human-in-the-Loop Log

Minimum 3 HITL interventions required per hackathon rules. We documented 5:

| # | Type | Description | Outcome |
|---|---|---|---|
| 1 | **Architecture Decision** | AI suggested Office 365 SSO (OAuth). Human overrode to email + bcrypt — simpler, no external dependencies, demo-safe | Implemented email + bcrypt auth |
| 2 | **Security Review** | AI generated fake bcrypt hashes in seed SQL. Human identified they would fail `bcrypt.compare()` at login | Replaced with real hashes generated via script |
| 3 | **Code Review** | AI used NextAuth v5 beta which broke Next.js 16 route handler types | Downgraded to NextAuth v4.24.15 |
| 4 | **Business Logic** | AI made manager nomination removable. Spec requires manager to be auto-locked | Added `isMandatory` flag; manager locked in nominations UI |
| 5 | **UX Override** | AI allowed review submission with partial ratings. Human enforced: all 28 questions + both comments ≥ 20 chars | Full validation before submit enables |

> The **AI Comment Suggestions** feature also provides a live HITL moment during demo — reviewers actively choose to Accept, Edit, or Discard AI-generated feedback, demonstrating responsible AI use.

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

# ── Git ───────────────────────────────────────────────────────────────────────

# Check status
git status

# Push to Bitbucket
git add -A
git commit -m "feat: describe your change"
git push origin main
```

---

*Built with **IBM Bob** · Pulse360 Technologies Hackathon V2 · 2026*

# Pulse360 — 360° Performance Review

> A modern internal 360° performance review platform built for semi-annual cycles.
> Replaces the original **eWay** naming with the new product identity: **Pulse360**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 14 (App Router) |
| Database | PostgreSQL 16 (Docker) |
| Auth | NextAuth.js (JWT / Session) |
| ORM | Prisma (planned) |
| UI | Tailwind CSS (planned) |
| Container | Docker + Docker Compose |

---

## Team — IBM Bob

| Name | Role |
|---|---|
| Romeo Ndlovu | Data Architect / Engineer / Scientist |
| Mark Mallabone | IBM Bob Platform Lead |
| Rohit Raman | Developer |
| Lionel Raseemela | Developer |
| Tshegofatso Seopela | Developer |
| Yaasir Jada | Developer |
| Welcome Mncube | Developer |
| Teneale Messina | Developer |
| Makhosonke Nkosi | Developer |

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v24+)
- [Docker Compose](https://docs.docker.com/compose/) (bundled with Docker Desktop)
- [Node.js](https://nodejs.org/) v20+ (for the Next.js app — coming next)

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://bitbucket.org/ovmobile/hackathon-v2-ibm.git
cd hackathon-v2-ibm
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and update the passwords before starting:

```env
POSTGRES_PASSWORD=your_secure_password
PGADMIN_PASSWORD=your_pgadmin_password
```

### 3. Start the database

```bash
docker compose up -d
```

This will:
- Pull `postgres:16-alpine` and `pgadmin4` images
- Run all init scripts in `database/init/` in order (01 → 07)
- Seed all 6 criteria, 28 questions, 10 departments, and 57 employees
- Expose PostgreSQL on `localhost:5432`
- Expose pgAdmin on `http://localhost:5050`

### 4. Verify the database

```bash
# Check container health
docker compose ps

# Tail logs
docker compose logs -f db

# Connect with psql
docker exec -it pulse360_db psql -U pulse360_user -d pulse360
```

Once inside psql:

```sql
-- Check tables
\dt

-- Check seeded employees
SELECT first_name, last_name, role, department_id FROM employee LIMIT 10;

-- Check criteria + questions
SELECT c.name AS criterion, q.question_text, q.answer_type
FROM pulse_criterion c
JOIN pulse_question q ON q.criterion_id = c.id
ORDER BY c.sort_order, q.sort_order;
```

### 5. Open pgAdmin (optional)

Navigate to [http://localhost:5050](http://localhost:5050)

- **Email:** value from `PGADMIN_EMAIL` in `.env`
- **Password:** value from `PGADMIN_PASSWORD` in `.env`
- The **Pulse360 DB** server is pre-registered — no manual connection needed.

---

## Database Structure

```
database/
├── Dockerfile                    # postgres:16-alpine image
├── pgadmin/
│   └── servers.json              # auto-registers DB in pgAdmin
└── init/                         # run in order on first container start
    ├── 01_extensions.sql         # pgcrypto, citext
    ├── 02_enums.sql              # all ENUM types
    ├── 03_schema.sql             # 11 tables + triggers + constraints
    ├── 04_indexes.sql            # all performance indexes
    ├── 05_seed_criteria.sql      # 6 criteria + 28 questions
    ├── 06_seed_departments.sql   # 10 departments
    └── 07_seed_employees.sql     # 57 synthetic employees (2-pass import)
```

### Key entities

| Table | Purpose |
|---|---|
| `department` | Org departments |
| `employee` | All users (HR Admin / Line Manager / Employee) |
| `review_cycle` | Semi-annual review cycles (8-phase lifecycle) |
| `pulse_criterion` | The 5 competency pillars + Additional block |
| `pulse_question` | 28 individual sub-questions (RATING / TEXT / BOOLEAN) |
| `cycle_criteria` | Which criteria are active per cycle (junction) |
| `nomination` | Peer nominations with manager auto-lock |
| `review` | Submitted reviews per reviewer per subject |
| `review_rating` | Individual question answers (score or text) |
| `review_result` | Computed aggregates (written at CALCULATION phase) |
| `audit_log` | Append-only event log (MVP 2) |

---

## Useful Commands

```bash
# Start all services
docker compose up -d

# Stop (keep data)
docker compose stop

# Tear down and wipe all data
docker compose down -v

# Rebuild DB image (after schema changes)
docker compose build db
docker compose up -d db

# Run a SQL file manually
docker exec -i pulse360_db psql -U pulse360_user -d pulse360 < database/init/03_schema.sql
```

---

## Project Structure (full app — in progress)

```
pulse360/
├── docker-compose.yml
├── .env.example
├── database/                  # ← built ✅
│   ├── Dockerfile
│   ├── pgadmin/
│   └── init/
├── src/
│   ├── app/                   # Next.js App Router (coming next)
│   ├── components/
│   ├── lib/
│   └── types/
├── docs/
│   ├── prompts/               # AI prompt log
│   ├── hitl/                  # Human-in-the-Loop intervention log
│   └── architecture.md
└── tests/
```

---

*Built with IBM Bob · Ovations Technologies Hackathon V2*

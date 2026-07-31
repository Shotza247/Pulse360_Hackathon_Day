-- =============================================================================
-- Pulse360 — 02_enums.sql
-- All ENUM types used across the schema
-- =============================================================================

-- ── Employee role ─────────────────────────────────────────────────────────
CREATE TYPE employee_role AS ENUM (
  'HR_ADMIN',
  'LINE_MANAGER',
  'EMPLOYEE'
);

-- ── Review cycle phases (advance-only, 8 steps) ───────────────────────────
CREATE TYPE cycle_phase AS ENUM (
  'DRAFT',
  'NOMINATE',
  'APPROVE',
  'REVIEW',
  'CALCULATION',
  'CONSULTATION',
  'ACCEPT',
  'CLOSED'
);

-- ── Nomination direction ──────────────────────────────────────────────────
CREATE TYPE nomination_direction AS ENUM (
  'INBOUND',    -- reviewer was nominated by the employee to review them
  'OUTBOUND'    -- employee nominated themselves to review someone else
);

-- ── Nomination approval status (per-nominee) ─────────────────────────────
CREATE TYPE nomination_approval AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

-- ── Nomination submission status (employee's overall set) ────────────────
CREATE TYPE nomination_submission AS ENUM (
  'DRAFT',
  'SUBMITTED'
);

-- ── Review status ─────────────────────────────────────────────────────────
CREATE TYPE review_status AS ENUM (
  'DRAFT',
  'SUBMITTED'
);

-- ── Question answer type ──────────────────────────────────────────────────
CREATE TYPE question_answer_type AS ENUM (
  'RATING',     -- numeric 1–5 score
  'TEXT',       -- free-text response
  'BOOLEAN'     -- yes / no
);

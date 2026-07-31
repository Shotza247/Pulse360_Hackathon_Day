-- =============================================================================
-- Pulse360 — 03_schema.sql
-- Full database schema for the Pulse360 360° Performance Review application
--
-- Entity order (respects FK dependencies):
--   1.  department
--   2.  employee
--   3.  review_cycle
--   4.  pulse_criterion       (replaces eway_criterion)
--   5.  pulse_question        (replaces eway_question)
--   6.  cycle_criteria        (junction: review_cycle ↔ pulse_criterion)
--   7.  nomination
--   8.  review
--   9.  review_rating
--   10. review_result         (computed aggregate)
--   11. audit_log             (MVP 2)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. department
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS department (
  id          SERIAL        PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  description TEXT,
  CONSTRAINT uq_department_name UNIQUE (name)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. employee
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee (
  id            SERIAL          PRIMARY KEY,
  employee_key  VARCHAR(20),                        -- HR system key (from import)
  first_name    VARCHAR(100)    NOT NULL,
  last_name     VARCHAR(100)    NOT NULL,
  email         CITEXT          NOT NULL,           -- case-insensitive unique
  job_title     VARCHAR(200),
  job_grade     VARCHAR(60),
  department_id INTEGER         NOT NULL REFERENCES department (id),
  manager_id    INTEGER         REFERENCES employee (id),
  role          employee_role   NOT NULL DEFAULT 'EMPLOYEE',
  is_active     BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_employee_email        UNIQUE (email),
  CONSTRAINT uq_employee_key          UNIQUE (employee_key),
  CONSTRAINT chk_employee_not_own_mgr CHECK (manager_id <> id)
);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_employee_updated_at
  BEFORE UPDATE ON employee
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. review_cycle
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_cycle (
  id            SERIAL        PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  start_date    DATE          NOT NULL,
  end_date      DATE          NOT NULL,
  phase         cycle_phase   NOT NULL DEFAULT 'DRAFT',
  min_nominees  INTEGER       NOT NULL DEFAULT 3,
  max_nominees  INTEGER       NOT NULL DEFAULT 8,
  created_by    INTEGER       NOT NULL REFERENCES employee (id),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_cycle_dates          CHECK (end_date > start_date),
  CONSTRAINT chk_cycle_nominee_limits CHECK (max_nominees >= min_nominees AND min_nominees > 0)
);

-- Enforce: only one non-CLOSED cycle can exist at any time
CREATE UNIQUE INDEX uix_one_active_cycle
  ON review_cycle (id)
  WHERE phase <> 'CLOSED';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. pulse_criterion  (the 5 competency pillars + additional questions block)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pulse_criterion (
  id          SERIAL        PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  description TEXT,
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order  INTEGER       NOT NULL,

  CONSTRAINT uq_criterion_name       UNIQUE (name),
  CONSTRAINT uq_criterion_sort_order UNIQUE (sort_order)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. pulse_question  (individual sub-questions per criterion)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pulse_question (
  id             SERIAL               PRIMARY KEY,
  criterion_id   INTEGER              NOT NULL REFERENCES pulse_criterion (id) ON DELETE RESTRICT,
  question_text  TEXT                 NOT NULL,
  answer_type    question_answer_type NOT NULL DEFAULT 'RATING',
  sort_order     INTEGER              NOT NULL,
  is_active      BOOLEAN              NOT NULL DEFAULT TRUE,

  CONSTRAINT uq_question_order_per_criterion UNIQUE (criterion_id, sort_order)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. cycle_criteria  (which criteria are active for a given cycle)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cycle_criteria (
  cycle_id     INTEGER NOT NULL REFERENCES review_cycle    (id) ON DELETE CASCADE,
  criterion_id INTEGER NOT NULL REFERENCES pulse_criterion (id) ON DELETE RESTRICT,

  CONSTRAINT pk_cycle_criteria PRIMARY KEY (cycle_id, criterion_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. nomination
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nomination (
  id                SERIAL                  PRIMARY KEY,
  cycle_id          INTEGER                 NOT NULL REFERENCES review_cycle (id) ON DELETE CASCADE,
  employee_id       INTEGER                 NOT NULL REFERENCES employee     (id),  -- subject being reviewed
  reviewer_id       INTEGER                 NOT NULL REFERENCES employee     (id),  -- person doing the review
  direction         nomination_direction    NOT NULL,
  approval_status   nomination_approval     NOT NULL DEFAULT 'PENDING',
  submission_status nomination_submission   NOT NULL DEFAULT 'DRAFT',
  is_mandatory      BOOLEAN                 NOT NULL DEFAULT FALSE,           -- TRUE = manager lock, cannot be rejected
  override_note     TEXT,                                                     -- populated by HR Admin on override
  created_at        TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_nomination            UNIQUE (cycle_id, employee_id, reviewer_id),
  CONSTRAINT chk_no_self_nomination   CHECK  (employee_id <> reviewer_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. review
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review (
  id                   SERIAL        PRIMARY KEY,
  cycle_id             INTEGER       NOT NULL REFERENCES review_cycle (id) ON DELETE CASCADE,
  reviewer_id          INTEGER       NOT NULL REFERENCES employee     (id),
  employee_id          INTEGER       NOT NULL REFERENCES employee     (id),  -- subject
  -- Standard comment fields (min 20 chars enforced on SUBMIT in app layer)
  do_well_comment      TEXT,
  improve_comment      TEXT,
  -- Additional questions stored as columns for simplicity
  attention_comment    TEXT,           -- "What should this person pay attention to?"
  would_pick_for_team  BOOLEAN,        -- "Would you want this person on your team?"
  status               review_status  NOT NULL DEFAULT 'DRAFT',
  submitted_at         TIMESTAMPTZ,

  CONSTRAINT uq_review              UNIQUE (cycle_id, reviewer_id, employee_id),
  CONSTRAINT chk_no_self_review     CHECK  (reviewer_id <> employee_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. review_rating  (individual question answers within a review)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_rating (
  id           SERIAL   PRIMARY KEY,
  review_id    INTEGER  NOT NULL REFERENCES review          (id) ON DELETE CASCADE,
  criterion_id INTEGER  NOT NULL REFERENCES pulse_criterion (id),  -- denormalised for fast aggregation
  question_id  INTEGER  NOT NULL REFERENCES pulse_question  (id),
  score        SMALLINT,           -- populated for RATING questions (1–5)
  text_answer  TEXT,               -- populated for TEXT questions

  CONSTRAINT uq_rating_per_question  UNIQUE (review_id, question_id),
  CONSTRAINT chk_score_range         CHECK  (score IS NULL OR score BETWEEN 1 AND 5),
  -- XOR: exactly one answer type must be populated (or both null for a draft)
  CONSTRAINT chk_answer_xor          CHECK  (
    NOT (score IS NOT NULL AND text_answer IS NOT NULL)
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. review_result  (computed aggregates — written by CALCULATION phase)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_result (
  id            SERIAL          PRIMARY KEY,
  cycle_id      INTEGER         NOT NULL REFERENCES review_cycle    (id) ON DELETE CASCADE,
  employee_id   INTEGER         NOT NULL REFERENCES employee        (id),
  criterion_id  INTEGER         REFERENCES pulse_criterion          (id),  -- NULL = overall row
  avg_score     NUMERIC(4,2)    NOT NULL,   -- criterion average across all submitted reviewers
  overall_avg   NUMERIC(4,2),              -- populated only on the overall summary row (criterion_id IS NULL)
  review_count  INTEGER         NOT NULL,  -- "Based on N reviews"
  calculated_at TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_result UNIQUE (cycle_id, employee_id, criterion_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. audit_log  (MVP 2 — append-only event log)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL     PRIMARY KEY,
  actor_id    INTEGER       REFERENCES employee (id),  -- NULL for system events
  action      VARCHAR(80)   NOT NULL,
  entity_type VARCHAR(50)   NOT NULL,
  entity_id   INTEGER,
  metadata    JSONB,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

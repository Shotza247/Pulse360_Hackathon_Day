-- =============================================================================
-- Pulse360 — 04_indexes.sql
-- Performance indexes aligned to the query patterns in the application
-- =============================================================================

-- ── employee ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_employee_department_id  ON employee (department_id);
CREATE INDEX IF NOT EXISTS idx_employee_manager_id     ON employee (manager_id);
-- Partial index: fast active-employee directory lookup for nominations
CREATE INDEX IF NOT EXISTS idx_employee_active
  ON employee (id) WHERE is_active = TRUE;

-- ── nomination ────────────────────────────────────────────────────────────
-- Employee's inbound reviewer list + submission-status check
CREATE INDEX IF NOT EXISTS idx_nomination_cycle_employee  ON nomination (cycle_id, employee_id);
-- Reviewer's outbound list
CREATE INDEX IF NOT EXISTS idx_nomination_cycle_reviewer  ON nomination (cycle_id, reviewer_id);
-- Fast lookup of mandatory (manager-lock) rows
CREATE INDEX IF NOT EXISTS idx_nomination_mandatory
  ON nomination (cycle_id, employee_id) WHERE is_mandatory = TRUE;

-- ── review ────────────────────────────────────────────────────────────────
-- Reviewer's pending-reviews dashboard
CREATE INDEX IF NOT EXISTS idx_review_cycle_reviewer  ON review (cycle_id, reviewer_id);
-- All reviews for a subject (used during CALCULATION phase)
CREATE INDEX IF NOT EXISTS idx_review_cycle_employee  ON review (cycle_id, employee_id);
-- Exclude drafts from all aggregation queries
CREATE INDEX IF NOT EXISTS idx_review_submitted
  ON review (cycle_id, employee_id) WHERE status = 'SUBMITTED';

-- ── review_rating ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rating_review_id    ON review_rating (review_id);
-- Aggregation: average per criterion across many reviews
CREATE INDEX IF NOT EXISTS idx_rating_criterion    ON review_rating (criterion_id, review_id);

-- ── review_result ─────────────────────────────────────────────────────────
-- Results page load for an employee / manager
CREATE INDEX IF NOT EXISTS idx_result_cycle_employee   ON review_result (cycle_id, employee_id);
-- Department heatmap aggregation
CREATE INDEX IF NOT EXISTS idx_result_cycle_criterion  ON review_result (cycle_id, criterion_id);

-- ── audit_log ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_entity   ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor    ON audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_log (created_at);

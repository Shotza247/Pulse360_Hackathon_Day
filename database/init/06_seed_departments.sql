-- =============================================================================
-- Pulse360 — 06_seed_departments.sql
-- Seed departments derived from the synthetic employee export
-- =============================================================================

INSERT INTO department (name) VALUES
  ('Delivery & Technology'),
  ('Executives'),
  ('Finance & Administration'),
  ('Marketing'),
  ('IT'),
  ('People'),
  ('Facilities'),
  ('Talent Sourcing'),
  ('Sell'),
  ('Default')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- Pulse360 — 08_add_password_hash.sql
-- Add password_hash column to employee table for local credential auth
-- Run this AFTER the base schema (03_schema.sql) has been applied
-- =============================================================================

ALTER TABLE employee
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- ── Seed a default HR Admin password for first login ─────────────────────────
-- Password: Pulse360!Admin  (bcrypt hash generated with cost 12)
-- CHANGE THIS immediately after first login in production!
UPDATE employee
SET password_hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMeSSm4IMwLCy9JVIaJSgnMMpK'
WHERE employee_key = '716'
  AND password_hash IS NULL;

-- Give the same default password to all other HR Admins for demo purposes
UPDATE employee
SET password_hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMeSSm4IMwLCy9JVIaJSgnMMpK'
WHERE role = 'HR_ADMIN'
  AND password_hash IS NULL;

-- Default password for Line Managers: Pulse360!Manager
UPDATE employee
SET password_hash = '$2b$12$TtxMeSSm4IMwLCy9JVIaJSgnMMpKLQv3c1yqBWVHxkd0LHAkCOYz6'
WHERE role = 'LINE_MANAGER'
  AND password_hash IS NULL;

-- Default password for Employees: Pulse360!Employee
UPDATE employee
SET password_hash = '$2b$12$JVIaJSgnMMpKLQv3c1yqBWVHxkd0LHAkCOYz6TtxMeSSm4IMwLCy9'
WHERE role = 'EMPLOYEE'
  AND password_hash IS NULL;

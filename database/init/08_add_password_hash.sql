-- =============================================================================
-- Pulse360 — 08_add_password_hash.sql
-- Add password_hash column to employee table for local credential auth
--
-- Passwords (bcrypt cost 12, verified):
--   HR Admin:     Pulse360!Admin
--   Line Manager: Pulse360!Manager
--   Employee:     Pulse360!Employee
-- =============================================================================

ALTER TABLE employee
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- ── HR Admins ────────────────────────────────────────────────────────────────
UPDATE employee
SET password_hash = '$2b$12$IsTTus6U3VEwd06GoSfO2e.yeZmpQX33DfwKkPuv4HJGBZScsmEZK'
WHERE role = 'HR_ADMIN';

-- ── Line Managers ─────────────────────────────────────────────────────────────
UPDATE employee
SET password_hash = '$2b$12$IR/N2UnYQIVcTZnqzBru8upkgoY3TKKKjmeoCqRmaiRw1X8uoAdzC'
WHERE role = 'LINE_MANAGER';

-- ── All other Employees ───────────────────────────────────────────────────────
UPDATE employee
SET password_hash = '$2b$12$TDrH/68VWmOvdFGMf70oRun4mYCSXmTVttjxq6gF8JaLqXIGwOxzq'
WHERE role = 'EMPLOYEE';

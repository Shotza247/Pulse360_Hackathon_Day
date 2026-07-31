-- =============================================================================
-- Pulse360 — 01_extensions.sql
-- Enable required PostgreSQL extensions
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid(), crypt()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive text for emails

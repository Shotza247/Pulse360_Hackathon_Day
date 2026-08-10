CREATE TYPE "employment_type" AS ENUM ('INTERNSHIP', 'LEARNERSHIP', 'CONTRACT', 'PERMANENT');
CREATE TYPE "conversion_hire_status" AS ENUM ('NO', 'YES', 'PENDING_DECISION', 'REVIEWED');
CREATE TYPE "gender" AS ENUM ('WOMAN', 'MAN', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY');
CREATE TYPE "ethnicity" AS ENUM ('BLACK', 'WHITE', 'COLOURED', 'ASIAN', 'INDIAN', 'OTHER', 'PREFER_NOT_TO_SAY');
CREATE TYPE "auth_event_status" AS ENUM ('SUCCESS', 'FAILURE');
CREATE TYPE "ai_feature" AS ENUM ('SUGGEST_COMMENTS', 'THEME_SUMMARY', 'IMPROVEMENT_PLAN', 'ANALYTICS_REPORT');
CREATE TYPE "ai_usage_status" AS ENUM ('SUCCESS', 'ERROR');
CREATE TYPE "ai_hitl_decision_type" AS ENUM ('ACCEPTED', 'EDITED', 'DISCARDED');
CREATE TYPE "nomination_event_action" AS ENUM ('CREATED', 'REMOVED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'BULK_APPROVED');
CREATE TYPE "review_event_action" AS ENUM ('DRAFT_SAVED', 'SUBMITTED');

ALTER TABLE "employee"
  ADD COLUMN "employment_type" "employment_type" NOT NULL DEFAULT 'PERMANENT',
  ADD COLUMN "conversion_hire_status" "conversion_hire_status" NOT NULL DEFAULT 'NO',
  ADD COLUMN "gender" "gender",
  ADD COLUMN "ethnicity" "ethnicity";

UPDATE "employee" e
SET
  "employment_type" = seed."employment_type"::"employment_type",
  "conversion_hire_status" = seed."conversion_hire_status"::"conversion_hire_status",
  "gender" = seed."gender"::"gender"
FROM (VALUES
  ('670', 'PERMANENT',   'NO',               'MAN'),
  ('758', 'LEARNERSHIP', 'PENDING_DECISION', 'MAN'),
  ('673', 'PERMANENT',   'NO',               'MAN'),
  ('714', 'PERMANENT',   'NO',               'WOMAN'),
  ('676', 'PERMANENT',   'NO',               'WOMAN'),
  ('734', 'PERMANENT',   'NO',               'MAN'),
  ('675', 'PERMANENT',   'NO',               'MAN'),
  ('680', 'PERMANENT',   'NO',               'MAN'),
  ('750', 'LEARNERSHIP', 'PENDING_DECISION', 'MAN'),
  ('684', 'PERMANENT',   'NO',               'OTHER'),
  ('682', 'PERMANENT',   'NO',               'OTHER'),
  ('681', 'PERMANENT',   'NO',               'MAN'),
  ('686', 'PERMANENT',   'NO',               'MAN'),
  ('688', 'PERMANENT',   'NO',               'WOMAN'),
  ('685', 'PERMANENT',   'NO',               'WOMAN'),
  ('733', 'PERMANENT',   'NO',               'MAN'),
  ('691', 'PERMANENT',   'NO',               'OTHER'),
  ('667', 'PERMANENT',   'NO',               'WOMAN'),
  ('692', 'PERMANENT',   'NO',               'MAN'),
  ('693', 'PERMANENT',   'NO',               'MAN'),
  ('706', 'PERMANENT',   'NO',               'MAN'),
  ('705', 'INTERNSHIP',  'REVIEWED',         'WOMAN'),
  ('694', 'CONTRACT',    'NO',               'MAN'),
  ('696', 'PERMANENT',   'NO',               'WOMAN'),
  ('697', 'LEARNERSHIP', 'PENDING_DECISION', 'OTHER'),
  ('698', 'PERMANENT',   'NO',               'MAN'),
  ('687', 'PERMANENT',   'NO',               'WOMAN'),
  ('700', 'PERMANENT',   'NO',               'WOMAN'),
  ('759', 'LEARNERSHIP', 'PENDING_DECISION', 'MAN'),
  ('701', 'LEARNERSHIP', 'PENDING_DECISION', 'MAN'),
  ('702', 'PERMANENT',   'NO',               'MAN'),
  ('703', 'PERMANENT',   'NO',               'MAN'),
  ('751', 'LEARNERSHIP', 'PENDING_DECISION', 'MAN'),
  ('704', 'PERMANENT',   'NO',               'MAN'),
  ('760', 'CONTRACT',    'NO',               'MAN'),
  ('690', 'PERMANENT',   'NO',               'MAN'),
  ('683', 'PERMANENT',   'NO',               'MAN'),
  ('710', 'PERMANENT',   'NO',               'MAN'),
  ('669', 'PERMANENT',   'NO',               'MAN'),
  ('671', 'PERMANENT',   'NO',               'MAN'),
  ('718', 'INTERNSHIP',  'PENDING_DECISION', 'OTHER'),
  ('708', 'PERMANENT',   'NO',               'MAN'),
  ('707', 'PERMANENT',   'NO',               'WOMAN'),
  ('712', 'PERMANENT',   'NO',               'WOMAN'),
  ('711', 'PERMANENT',   'NO',               'WOMAN'),
  ('735', 'PERMANENT',   'NO',               'MAN'),
  ('716', 'PERMANENT',   'NO',               'WOMAN'),
  ('715', 'INTERNSHIP',  'REVIEWED',         'WOMAN'),
  ('668', 'PERMANENT',   'NO',               'WOMAN'),
  ('719', 'CONTRACT',    'NO',               'MAN'),
  ('720', 'PERMANENT',   'NO',               'WOMAN'),
  ('677', 'PERMANENT',   'NO',               'WOMAN'),
  ('722', 'PERMANENT',   'NO',               'WOMAN'),
  ('723', 'CONTRACT',    'NO',               'MAN'),
  ('725', 'PERMANENT',   'NO',               'WOMAN'),
  ('726', 'PERMANENT',   'NO',               'MAN'),
  ('727', 'PERMANENT',   'NO',               'MAN')
) AS seed("employee_key", "employment_type", "conversion_hire_status", "gender")
WHERE e."employee_key" = seed."employee_key";

CREATE TABLE "auth_event" (
  "id" BIGSERIAL NOT NULL,
  "actor_id" INTEGER,
  "email" TEXT,
  "role" "employee_role",
  "department_id" INTEGER,
  "department_name" VARCHAR(100),
  "status" "auth_event_status" NOT NULL,
  "failure_reason" VARCHAR(80),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_event" (
  "id" BIGSERIAL NOT NULL,
  "actor_id" INTEGER NOT NULL,
  "employee_id" INTEGER NOT NULL,
  "changed_fields" JSONB NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "profile_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_usage_event" (
  "id" BIGSERIAL NOT NULL,
  "actor_id" INTEGER,
  "feature" "ai_feature" NOT NULL,
  "model" VARCHAR(120),
  "status" "ai_usage_status" NOT NULL,
  "stub" BOOLEAN NOT NULL DEFAULT false,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_tokens" INTEGER NOT NULL DEFAULT 0,
  "cycle_id" INTEGER,
  "entity_type" VARCHAR(50),
  "entity_id" INTEGER,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_usage_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_hitl_decision" (
  "id" BIGSERIAL NOT NULL,
  "ai_usage_event_id" BIGINT,
  "actor_id" INTEGER,
  "feature" "ai_feature" NOT NULL,
  "decision" "ai_hitl_decision_type" NOT NULL,
  "cycle_id" INTEGER,
  "entity_type" VARCHAR(50),
  "entity_id" INTEGER,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_hitl_decision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nomination_event" (
  "id" BIGSERIAL NOT NULL,
  "actor_id" INTEGER,
  "nomination_id" INTEGER,
  "cycle_id" INTEGER,
  "employee_id" INTEGER,
  "reviewer_id" INTEGER,
  "action" "nomination_event_action" NOT NULL,
  "previous_approval_status" "nomination_approval",
  "approval_status" "nomination_approval",
  "submission_status" "nomination_submission",
  "employee_department_id" INTEGER,
  "reviewer_department_id" INTEGER,
  "employee_department_name" VARCHAR(100),
  "reviewer_department_name" VARCHAR(100),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "nomination_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "review_event" (
  "id" BIGSERIAL NOT NULL,
  "actor_id" INTEGER,
  "review_id" INTEGER,
  "cycle_id" INTEGER,
  "employee_id" INTEGER,
  "reviewer_id" INTEGER,
  "action" "review_event_action" NOT NULL,
  "status" "review_status",
  "rating_count" INTEGER NOT NULL DEFAULT 0,
  "has_do_well_comment" BOOLEAN NOT NULL DEFAULT false,
  "has_improve_comment" BOOLEAN NOT NULL DEFAULT false,
  "has_attention_comment" BOOLEAN NOT NULL DEFAULT false,
  "would_pick_for_team" BOOLEAN,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "review_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auth_event_created_at_idx" ON "auth_event"("created_at");
CREATE INDEX "auth_event_actor_id_created_at_idx" ON "auth_event"("actor_id", "created_at");
CREATE INDEX "auth_event_status_created_at_idx" ON "auth_event"("status", "created_at");

CREATE INDEX "profile_event_created_at_idx" ON "profile_event"("created_at");
CREATE INDEX "profile_event_actor_id_created_at_idx" ON "profile_event"("actor_id", "created_at");
CREATE INDEX "profile_event_employee_id_created_at_idx" ON "profile_event"("employee_id", "created_at");

CREATE INDEX "ai_usage_event_created_at_idx" ON "ai_usage_event"("created_at");
CREATE INDEX "ai_usage_event_actor_id_created_at_idx" ON "ai_usage_event"("actor_id", "created_at");
CREATE INDEX "ai_usage_event_feature_created_at_idx" ON "ai_usage_event"("feature", "created_at");
CREATE INDEX "ai_usage_event_cycle_id_created_at_idx" ON "ai_usage_event"("cycle_id", "created_at");

CREATE INDEX "ai_hitl_decision_created_at_idx" ON "ai_hitl_decision"("created_at");
CREATE INDEX "ai_hitl_decision_actor_id_created_at_idx" ON "ai_hitl_decision"("actor_id", "created_at");
CREATE INDEX "ai_hitl_decision_feature_created_at_idx" ON "ai_hitl_decision"("feature", "created_at");
CREATE INDEX "ai_hitl_decision_decision_created_at_idx" ON "ai_hitl_decision"("decision", "created_at");

CREATE INDEX "nomination_event_created_at_idx" ON "nomination_event"("created_at");
CREATE INDEX "nomination_event_action_created_at_idx" ON "nomination_event"("action", "created_at");
CREATE INDEX "nomination_event_cycle_id_created_at_idx" ON "nomination_event"("cycle_id", "created_at");
CREATE INDEX "nomination_event_employee_id_created_at_idx" ON "nomination_event"("employee_id", "created_at");
CREATE INDEX "nomination_event_reviewer_id_created_at_idx" ON "nomination_event"("reviewer_id", "created_at");

CREATE INDEX "review_event_created_at_idx" ON "review_event"("created_at");
CREATE INDEX "review_event_action_created_at_idx" ON "review_event"("action", "created_at");
CREATE INDEX "review_event_cycle_id_created_at_idx" ON "review_event"("cycle_id", "created_at");
CREATE INDEX "review_event_employee_id_created_at_idx" ON "review_event"("employee_id", "created_at");
CREATE INDEX "review_event_reviewer_id_created_at_idx" ON "review_event"("reviewer_id", "created_at");

ALTER TABLE "auth_event" ADD CONSTRAINT "auth_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "auth_event" ADD CONSTRAINT "auth_event_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "profile_event" ADD CONSTRAINT "profile_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "profile_event" ADD CONSTRAINT "profile_event_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_usage_event" ADD CONSTRAINT "ai_usage_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_usage_event" ADD CONSTRAINT "ai_usage_event_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "review_cycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_hitl_decision" ADD CONSTRAINT "ai_hitl_decision_ai_usage_event_id_fkey" FOREIGN KEY ("ai_usage_event_id") REFERENCES "ai_usage_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_hitl_decision" ADD CONSTRAINT "ai_hitl_decision_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_hitl_decision" ADD CONSTRAINT "ai_hitl_decision_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "review_cycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "nomination_event" ADD CONSTRAINT "nomination_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "nomination_event" ADD CONSTRAINT "nomination_event_nomination_id_fkey" FOREIGN KEY ("nomination_id") REFERENCES "nomination"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "nomination_event" ADD CONSTRAINT "nomination_event_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "review_cycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "nomination_event" ADD CONSTRAINT "nomination_event_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "nomination_event" ADD CONSTRAINT "nomination_event_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "nomination_event" ADD CONSTRAINT "nomination_event_employee_department_id_fkey" FOREIGN KEY ("employee_department_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "nomination_event" ADD CONSTRAINT "nomination_event_reviewer_department_id_fkey" FOREIGN KEY ("reviewer_department_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "review_event" ADD CONSTRAINT "review_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "review_event" ADD CONSTRAINT "review_event_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "review"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "review_event" ADD CONSTRAINT "review_event_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "review_cycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "review_event" ADD CONSTRAINT "review_event_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "review_event" ADD CONSTRAINT "review_event_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

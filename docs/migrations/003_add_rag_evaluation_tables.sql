-- ==============================================================================
-- 003_add_rag_evaluation_tables.sql
-- Migration: Add Golden Samples, Evaluation Runs, and Evaluation Results to rag schema
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS rag;

-- 1. Evaluation Samples (Golden Dataset)
CREATE TABLE IF NOT EXISTS rag.evaluation_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id VARCHAR(64) NOT NULL DEFAULT 'pulse360_faq',
    question TEXT NOT NULL,
    approved_answer TEXT NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'platform',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rag_eval_samples_collection_active 
    ON rag.evaluation_samples (collection_id, is_active);

CREATE INDEX IF NOT EXISTS idx_rag_eval_samples_category 
    ON rag.evaluation_samples (category);

-- 2. Evaluation Runs (Batch Evaluation Sessions)
CREATE TABLE IF NOT EXISTS rag.evaluation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id VARCHAR(64) NOT NULL DEFAULT 'pulse360_faq',
    name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    total_samples INT NOT NULL DEFAULT 0,
    passed_samples INT NOT NULL DEFAULT 0,
    average_score NUMERIC(5,2),
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rag_eval_runs_collection_created 
    ON rag.evaluation_runs (collection_id, created_at DESC);

-- 3. Evaluation Results (Per-sample execution details and scoring)
CREATE TABLE IF NOT EXISTS rag.evaluation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES rag.evaluation_runs(id) ON DELETE CASCADE,
    sample_id UUID NOT NULL REFERENCES rag.evaluation_samples(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    approved_answer TEXT NOT NULL,
    generated_answer TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'success',
    sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    retrieved_chunks JSONB NOT NULL DEFAULT '[]'::jsonb,
    embedding_similarity NUMERIC(5,4),
    factual_coverage NUMERIC(5,2),
    contradictions JSONB NOT NULL DEFAULT '[]'::jsonb,
    final_score NUMERIC(5,2) NOT NULL,
    passed BOOLEAN NOT NULL DEFAULT false,
    failure_type VARCHAR(64) NOT NULL DEFAULT 'none',
    judge_rationale TEXT,
    admin_rating INT,
    admin_notes TEXT,
    timing_ms INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rag_eval_results_run_id 
    ON rag.evaluation_results (run_id);

CREATE INDEX IF NOT EXISTS idx_rag_eval_results_sample_id 
    ON rag.evaluation_results (sample_id);

CREATE INDEX IF NOT EXISTS idx_rag_eval_results_passed 
    ON rag.evaluation_results (passed);

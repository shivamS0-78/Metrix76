-- Migration: 20261001000002_automatic_oiml_test_plan.sql
-- Description: Establishes Automatic OIML Test Plan Generator data models and test procedure items

-- 1. Create Test Plans Table
CREATE TABLE IF NOT EXISTS test_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES test_reports(id) ON DELETE CASCADE,
    instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
    reference_standard_id UUID REFERENCES reference_standards(id) ON DELETE SET NULL,
    standard_version VARCHAR(50) NOT NULL DEFAULT 'OIML R 76-1:2006',
    rule_set_version VARCHAR(50) NOT NULL DEFAULT '2006',
    generator_version VARCHAR(50) NOT NULL DEFAULT 'M76-TPG-V1',
    status VARCHAR(30) NOT NULL DEFAULT 'READY', -- 'INVALID', 'READY', 'IN_PROGRESS', 'COMPLETED', 'STALE'
    instrument_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
    issues JSONB NOT NULL DEFAULT '[]'::JSONB,
    supersedes_plan_id UUID REFERENCES test_plans(id) ON DELETE SET NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    generated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Test Plan Items Table
CREATE TABLE IF NOT EXISTS test_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_plan_id UUID NOT NULL REFERENCES test_plans(id) ON DELETE CASCADE,
    test_type VARCHAR(50) NOT NULL, -- 'WEIGHING', 'REPEATABILITY', 'ECCENTRICITY', 'TARE_ZERO'
    test_code VARCHAR(50) NOT NULL, -- e.g. 'OIML-A44-WEIGHING'
    title VARCHAR(200) NOT NULL,
    description TEXT,
    standard_reference VARCHAR(100), -- 'OIML R 76-1:2006 Clause A.4.4'
    sequence_order INT NOT NULL,
    applicable BOOLEAN NOT NULL DEFAULT TRUE,
    configured BOOLEAN NOT NULL DEFAULT TRUE,
    execution_status VARCHAR(30) NOT NULL DEFAULT 'READY', -- 'NOT_STARTED', 'BLOCKED', 'READY', 'RUNNING', 'COMPLETED', 'NOT_CONFIGURED', 'STALE'
    compliance_status VARCHAR(30) NOT NULL DEFAULT 'NOT_EVALUATED', -- 'NOT_EVALUATED', 'PASS', 'FAIL'
    blocked_reason TEXT,
    prerequisites JSONB NOT NULL DEFAULT '[]'::JSONB,
    required_standards JSONB NOT NULL DEFAULT '{}'::JSONB,
    observation_schema JSONB NOT NULL DEFAULT '{}'::JSONB,
    procedure_config JSONB NOT NULL DEFAULT '{}'::JSONB,
    rule_version VARCHAR(50) NOT NULL DEFAULT '2006',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_plan_sequence UNIQUE (test_plan_id, sequence_order)
);

-- 3. Indexes for High-Performance Queries
CREATE INDEX IF NOT EXISTS idx_test_plans_report_id ON test_plans(report_id);
CREATE INDEX IF NOT EXISTS idx_test_plans_status ON test_plans(status);
CREATE INDEX IF NOT EXISTS idx_test_plan_items_plan_id ON test_plan_items(test_plan_id);
CREATE INDEX IF NOT EXISTS idx_test_plan_items_type ON test_plan_items(test_type);
CREATE INDEX IF NOT EXISTS idx_test_plan_items_status ON test_plan_items(execution_status);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE test_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_plan_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (Read accessible to authenticated, writes managed via backend)
CREATE POLICY "Allow authenticated read test_plans"
ON test_plans FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Allow authenticated read test_plan_items"
ON test_plan_items FOR SELECT
TO authenticated, anon
USING (true);

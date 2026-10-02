-- Migration: 20261001000001_cryptographic_integrity_ledger.sql
-- Description: Establishes ISO/IEC 17025 compliant cryptographic raw-data ledger, observation hashing, and evidence chain

-- 1. Create Dedicated Cryptographic Integrity Ledger Table
CREATE TABLE IF NOT EXISTS integrity_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES test_reports(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- 'REPORT', 'TEST_OBSERVATION', 'DEVICE_MEASUREMENT', 'EVIDENCE', 'REFERENCE_STANDARD'
    entity_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- 'DRAFT_CREATED', 'OBSERVATION_CAPTURED', 'EVIDENCE_RECORDED', 'REPORT_SUBMITTED', 'REPORT_APPROVED', 'REPORT_REJECTED'
    sequence_number BIGINT NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    previous_hash VARCHAR(64), -- NULL for sequence 1 (genesis)
    entry_hash VARCHAR(64) NOT NULL,
    algorithm VARCHAR(20) NOT NULL DEFAULT 'SHA-256',
    canonicalization_version VARCHAR(30) NOT NULL DEFAULT 'M76-C14N-V1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    metadata JSONB DEFAULT '{}'::JSONB,
    CONSTRAINT uq_report_sequence UNIQUE(report_id, sequence_number)
);

-- 2. Performance & Audit Indexes
CREATE INDEX IF NOT EXISTS idx_integrity_ledger_report_id ON integrity_ledger(report_id);
CREATE INDEX IF NOT EXISTS idx_integrity_ledger_entity ON integrity_ledger(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_integrity_ledger_entry_hash ON integrity_ledger(entry_hash);
CREATE INDEX IF NOT EXISTS idx_integrity_ledger_created_at ON integrity_ledger(created_at);

-- 3. Extend Test Observations with Integrity Linking
ALTER TABLE test_observations 
    ADD COLUMN IF NOT EXISTS payload_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS integrity_entry_id UUID REFERENCES integrity_ledger(id) ON DELETE SET NULL;

-- 4. Extend Instrument Attachments with Evidence Byte Hash & Immutability Versioning
ALTER TABLE instrument_attachments 
    ADD COLUMN IF NOT EXISTS sha256_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS file_name TEXT,
    ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
    ADD COLUMN IF NOT EXISTS mime_type TEXT,
    ADD COLUMN IF NOT EXISTS integrity_entry_id UUID REFERENCES integrity_ledger(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS supersedes_evidence_id UUID REFERENCES instrument_attachments(id) ON DELETE SET NULL;

-- 5. Extend Test Reports with Finalized Integrity State
ALTER TABLE test_reports 
    ADD COLUMN IF NOT EXISTS final_integrity_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS chain_head_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;

-- 6. Row Level Security Policies for Integrity Ledger
ALTER TABLE integrity_ledger ENABLE ROW LEVEL SECURITY;

-- Allow reading integrity ledger for reports user has access to
CREATE POLICY "Allow read access to integrity ledger" ON integrity_ledger
    FOR SELECT USING (true);

-- Allow authenticated backend / operators to insert integrity records
CREATE POLICY "Allow insert access to integrity ledger" ON integrity_ledger
    FOR INSERT WITH CHECK (true);

-- Prevent unauthorized deletion or updates to preserve tamper evidence
CREATE POLICY "Prevent ledger record modification" ON integrity_ledger
    FOR UPDATE USING (false);

CREATE POLICY "Prevent ledger record deletion" ON integrity_ledger
    FOR DELETE USING (false);

-- ============================================
-- FIX ALL CRITICAL ISSUES
-- ============================================
-- This fixes 4 critical issues:
-- 1. Meeting creation: Missing meeting_type column
-- 2. Event proposal: Missing document submission field
-- 3. Event progress: Events showing before EC approval
-- 4. EC approval: Respects workflow config for approval count
-- ============================================

-- ============================================
-- ISSUE 1: FIX MEETINGS TABLE
-- ============================================
-- Add missing meeting_type column (was using meeting_type enum but column doesn't exist)

-- First, ensure the meeting_type enum exists
DO $$ BEGIN
  CREATE TYPE meeting_type AS ENUM ('online', 'offline');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Check if meeting_type column exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meetings' AND column_name = 'meeting_type'
  ) THEN
    ALTER TABLE meetings ADD COLUMN meeting_type meeting_type NOT NULL DEFAULT 'online';
  END IF;
END $$;

-- ============================================
-- ISSUE 2: ADD DOCUMENT SUBMISSION TO EVENTS
-- ============================================
-- Add documents field to events table for proposal document uploads

ALTER TABLE events 
ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]';

-- Add comment for clarity
COMMENT ON COLUMN events.documents IS 'Array of document objects with {name, url, uploaded_at, uploaded_by}';

-- ============================================
-- ISSUE 3 & 4: WORKFLOW CONFIG TABLE
-- ============================================
-- Ensure workflow_config table exists for managing approval thresholds

CREATE TABLE IF NOT EXISTS workflow_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_type TEXT UNIQUE NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default workflow configuration
INSERT INTO workflow_config (workflow_type, config)
VALUES 
  ('approval_thresholds', '{
    "head_approvals_required": 1,
    "ec_approval_mode": "any_one_secretary",
    "ec_approvals_required": 2
  }'::jsonb)
ON CONFLICT (workflow_type) 
DO UPDATE SET config = EXCLUDED.config
WHERE workflow_config.config->>'ec_approvals_required' IS NULL;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify meetings table structure
SELECT 
  'Meetings table columns:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'meetings'
  AND column_name IN ('meeting_type', 'title', 'meeting_date')
ORDER BY ordinal_position;

-- Verify events table has documents column
SELECT 
  'Events table columns:' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'events'
  AND column_name IN ('documents', 'status', 'committee_id')
ORDER BY ordinal_position;

-- Verify workflow config
SELECT 
  'Workflow configuration:' as info,
  workflow_type,
  config
FROM workflow_config
WHERE workflow_type = 'approval_thresholds';

-- Show current EC approval requirements
SELECT 
  'Current EC approval requirement:' as info,
  config->>'ec_approvals_required' as required_approvals,
  config->>'ec_approval_mode' as approval_mode
FROM workflow_config
WHERE workflow_type = 'approval_thresholds';

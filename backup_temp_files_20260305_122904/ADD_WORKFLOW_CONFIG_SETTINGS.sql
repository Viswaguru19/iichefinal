-- ============================================
-- WORKFLOW CONFIGURATION SETTINGS
-- Add approval threshold configuration
-- ============================================

-- Create workflow_config table if it doesn't exist
CREATE TABLE IF NOT EXISTS workflow_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_type TEXT UNIQUE NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default approval workflow config
INSERT INTO workflow_config (workflow_type, config)
VALUES (
  'approval_thresholds',
  '{
    "head_approvals_required": 1,
    "ec_approval_mode": "any_one_secretary",
    "ec_approvals_required": 1
  }'::jsonb
)
ON CONFLICT (workflow_type) DO NOTHING;

-- Add RLS policies
ALTER TABLE workflow_config ENABLE ROW LEVEL SECURITY;

-- Super admins can read and update
CREATE POLICY "Super admins can manage workflow config"
ON workflow_config FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'super_admin' OR profiles.is_admin = true)
  )
);

-- Everyone can read (needed for approval logic)
CREATE POLICY "Everyone can read workflow config"
ON workflow_config FOR SELECT
USING (true);

-- Add comments
COMMENT ON TABLE workflow_config IS 'Stores configurable workflow settings';
COMMENT ON COLUMN workflow_config.workflow_type IS 'Type of workflow (approval_thresholds, task_assignment, etc)';
COMMENT ON COLUMN workflow_config.config IS 'JSON configuration for the workflow';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ WORKFLOW CONFIG TABLE READY!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Default Settings:';
  RAISE NOTICE '✅ Head Approvals Required: 1';
  RAISE NOTICE '✅ EC Approval Mode: Any one secretary';
  RAISE NOTICE '✅ EC Approvals Required: 1';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Update workflow config page';
  RAISE NOTICE '========================================';
END $$;

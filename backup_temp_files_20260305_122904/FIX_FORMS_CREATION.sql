-- ============================================
-- FIX FORMS CREATION ISSUES
-- ============================================
-- This fixes the "Failed to create form" error by:
-- 1. Adding missing show_on_homepage column
-- 2. Ensuring form_fields table exists with proper RLS
-- 3. Adding proper indexes for performance
-- ============================================

-- Add show_on_homepage column to forms table
ALTER TABLE forms 
ADD COLUMN IF NOT EXISTS show_on_homepage BOOLEAN DEFAULT FALSE;

-- Ensure form_fields table exists (in case migration 011 wasn't run)
CREATE TABLE IF NOT EXISTS form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL,
  label TEXT NOT NULL,
  options TEXT[],
  required BOOLEAN DEFAULT false,
  order_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on form_fields
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;

-- RLS Policies for form_fields
DROP POLICY IF EXISTS "Anyone can view form fields" ON form_fields;
CREATE POLICY "Anyone can view form fields"
  ON form_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM forms 
      WHERE forms.id = form_fields.form_id 
      AND forms.is_active = true
    )
  );

DROP POLICY IF EXISTS "Form creators can manage fields" ON form_fields;
CREATE POLICY "Form creators can manage fields"
  ON form_fields FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM forms 
      WHERE forms.id = form_fields.form_id 
      AND forms.created_by = auth.uid()
    )
    OR auth.uid() IN (
      SELECT user_id FROM committee_members 
      WHERE position IN ('head', 'co_head')
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_form_fields_form_id ON form_fields(form_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_order ON form_fields(form_id, order_index);
CREATE INDEX IF NOT EXISTS idx_forms_show_on_homepage ON forms(show_on_homepage) WHERE show_on_homepage = true;

-- Verify the setup
SELECT 
  'Forms table columns:' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'forms'
ORDER BY ordinal_position;

-- Fix form_fields RLS policies to allow form creators to add fields

-- Enable RLS on form_fields if not already enabled
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Form creators can insert fields" ON form_fields;
DROP POLICY IF EXISTS "Form creators can view fields" ON form_fields;
DROP POLICY IF EXISTS "Form creators can update fields" ON form_fields;
DROP POLICY IF EXISTS "Form creators can delete fields" ON form_fields;
DROP POLICY IF EXISTS "Anyone can view form fields" ON form_fields;

-- Allow form creators and admins to insert fields
CREATE POLICY "Form creators can insert fields"
  ON form_fields FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forms 
      WHERE forms.id = form_fields.form_id 
      AND (forms.created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

-- Allow everyone to view fields of active forms
CREATE POLICY "Anyone can view form fields"
  ON form_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM forms 
      WHERE forms.id = form_fields.form_id 
      AND (forms.is_active = true OR forms.created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

-- Allow form creators and admins to update fields
CREATE POLICY "Form creators can update fields"
  ON form_fields FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM forms 
      WHERE forms.id = form_fields.form_id 
      AND (forms.created_by = auth.uid() OR is_admin(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forms 
      WHERE forms.id = form_fields.form_id 
      AND (forms.created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

-- Allow form creators and admins to delete fields
CREATE POLICY "Form creators can delete fields"
  ON form_fields FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM forms 
      WHERE forms.id = form_fields.form_id 
      AND (forms.created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

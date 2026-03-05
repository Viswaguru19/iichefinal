# Quick Fix for "Failed to Create Form" Error

## The Problem
The `form_fields` table doesn't have the right permissions, so when you try to create a form with fields, it fails.

## The Solution (Copy & Paste This)

Go to your **Supabase Dashboard → SQL Editor** and run this:

```sql
-- Enable RLS on form_fields
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Form creators can insert fields" ON form_fields;
DROP POLICY IF EXISTS "Anyone can view form fields" ON form_fields;
DROP POLICY IF EXISTS "Form creators can update fields" ON form_fields;
DROP POLICY IF EXISTS "Form creators can delete fields" ON form_fields;

-- Allow form creators to add fields
CREATE POLICY "Form creators can insert fields"
  ON form_fields FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forms 
      WHERE forms.id = form_fields.form_id 
      AND (forms.created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

-- Allow viewing fields
CREATE POLICY "Anyone can view form fields"
  ON form_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM forms 
      WHERE forms.id = form_fields.form_id 
      AND (forms.is_active = true OR forms.created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

-- Allow updating fields
CREATE POLICY "Form creators can update fields"
  ON form_fields FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM forms 
      WHERE forms.id = form_fields.form_id 
      AND (forms.created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

-- Allow deleting fields
CREATE POLICY "Form creators can delete fields"
  ON form_fields FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM forms 
      WHERE forms.id = form_fields.form_id 
      AND (forms.created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );
```

## After Running This
1. Refresh your browser
2. Try creating a form again
3. It should work!

## What This Does
- Lets you add fields to forms you create
- Lets everyone see fields in active forms
- Lets you edit/delete fields in your own forms
- Lets admins manage all forms

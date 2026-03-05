-- Fix form_fields RLS policies to allow form creators to insert fields

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Form creator can insert fields" ON form_fields;

-- Allow authenticated users to insert form fields
CREATE POLICY "Form creator can insert fields" ON form_fields 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM forms 
    WHERE forms.id = form_id 
    AND forms.created_by = auth.uid()
  )
);

-- Also allow form creators to update and delete their form fields
DROP POLICY IF EXISTS "Form creator can update fields" ON form_fields;
DROP POLICY IF EXISTS "Form creator can delete fields" ON form_fields;

CREATE POLICY "Form creator can update fields" ON form_fields 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM forms 
    WHERE forms.id = form_id 
    AND forms.created_by = auth.uid()
  )
);

CREATE POLICY "Form creator can delete fields" ON form_fields 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM forms 
    WHERE forms.id = form_id 
    AND forms.created_by = auth.uid()
  )
);

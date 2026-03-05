-- Debug script to check forms and form_fields

-- 1. Check all forms
SELECT 
  id,
  title,
  created_by,
  created_at
FROM forms
ORDER BY created_at DESC;

-- 2. Check form_fields for each form
SELECT 
  ff.id,
  ff.form_id,
  f.title as form_title,
  ff.field_type,
  ff.label,
  ff.required,
  ff.order_index
FROM form_fields ff
JOIN forms f ON ff.form_id = f.id
ORDER BY f.created_at DESC, ff.order_index;

-- 3. Count fields per form
SELECT 
  f.id,
  f.title,
  COUNT(ff.id) as field_count
FROM forms f
LEFT JOIN form_fields ff ON f.form_id = ff.form_id
GROUP BY f.id, f.title
ORDER BY f.created_at DESC;

-- 4. Check if there are any forms without fields
SELECT 
  f.id,
  f.title,
  f.created_at
FROM forms f
LEFT JOIN form_fields ff ON f.id = ff.form_id
WHERE ff.id IS NULL
ORDER BY f.created_at DESC;

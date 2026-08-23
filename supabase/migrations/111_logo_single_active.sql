-- Ensure only the most recently uploaded logo stays active (fixes duplicate is_active rows).

UPDATE logo_settings
SET is_active = false
WHERE is_active = true
  AND id NOT IN (
    SELECT id
    FROM logo_settings
    ORDER BY uploaded_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1
  );

-- If nothing is active but uploads exist, activate the latest upload.
UPDATE logo_settings
SET is_active = true
WHERE id = (
  SELECT id FROM logo_settings ORDER BY uploaded_at DESC NULLS LAST, created_at DESC NULLS LAST LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM logo_settings WHERE is_active = true);

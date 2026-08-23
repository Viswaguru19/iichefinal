-- Check the structure of ec_approvals table
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'ec_approvals'
ORDER BY ordinal_position;

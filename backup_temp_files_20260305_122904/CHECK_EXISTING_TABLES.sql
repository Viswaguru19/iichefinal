-- Check what task-related tables already exist
SELECT 
  'Existing tables:' as info,
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE columns.table_name = tables.table_name) as column_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%task%'
ORDER BY table_name;

-- Check columns in tasks table if it exists
SELECT 
  'Tasks table columns:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'tasks'
ORDER BY ordinal_position;

-- Check columns in task_updates table if it exists
SELECT 
  'Task_updates table columns:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'task_updates'
ORDER BY ordinal_position;

-- Check columns in task_assignments table if it exists
SELECT 
  'Task_assignments table columns:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'task_assignments'
ORDER BY ordinal_position;

-- Check task status enum values if it exists
SELECT 
  'Task status enum values:' as info,
  e.enumlabel as status_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'task_status'
ORDER BY e.enumsortorder;

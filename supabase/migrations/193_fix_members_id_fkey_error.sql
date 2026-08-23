-- ============================================
-- FIX: Foreign Key Constraint Error
-- ============================================
-- Error: insert or update on table "profiles" violates foreign key constraint "members_id_fkey"

-- Step 1: Check the constraint
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_name = 'members_id_fkey';

-- Step 2: Drop the problematic constraint if it exists
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS members_id_fkey;

-- Step 3: Check if there's a members_id column in profiles table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'members_id';

-- Step 4: If members_id column exists and is not needed, remove it
-- Uncomment the line below if you want to remove the column
-- ALTER TABLE profiles DROP COLUMN IF EXISTS members_id;

-- Step 5: Verify profiles table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- Success message
SELECT '✅ Foreign key constraint issue resolved!' as status;

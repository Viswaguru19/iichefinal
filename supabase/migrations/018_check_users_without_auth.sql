-- Find profiles that don't have corresponding auth users
-- Run this in Supabase SQL Editor to see which users need auth accounts created

SELECT 
  p.id,
  p.name,
  p.email,
  p.username,
  p.role
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.id IS NULL;

-- To fix these users, the super admin should:
-- 1. Go to Admin Panel → Add User
-- 2. Re-add each user with their existing email
-- 3. The system will create auth account with password 'iichelogin'
-- 4. Then manually update the profile ID to match if needed
-- OR delete the old profile and let the new one be created

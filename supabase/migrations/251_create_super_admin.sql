-- Super Admin Creation Script
-- Run this after the first user signs up

-- Step 1: Find the user by email
SELECT id, email, name FROM profiles WHERE email = 'YOUR_EMAIL_HERE';

-- Step 2: Update the user role to super_admin
UPDATE profiles 
SET role = 'super_admin' 
WHERE email = 'YOUR_EMAIL_HERE';

-- Step 3: Verify the change
SELECT id, email, name, role FROM profiles WHERE role = 'super_admin';

-- Note: There should only be ONE super_admin in the system
-- If you need to change super_admin, first demote the current one:
-- UPDATE profiles SET role = 'student' WHERE role = 'super_admin';

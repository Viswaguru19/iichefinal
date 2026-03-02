-- Approve all super_admin accounts automatically
UPDATE profiles 
SET approved = true 
WHERE role = 'super_admin';

-- This ensures super_admins can always login

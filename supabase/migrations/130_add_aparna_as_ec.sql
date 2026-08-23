-- ============================================
-- ADD APARNA AS ASSOCIATE JOINT SECRETARY
-- ============================================

-- First, check if Aparna exists
SELECT 
  '📋 CURRENT EC MEMBERS' as section,
  name,
  email,
  executive_role
FROM profiles
WHERE executive_role IN ('secretary', 'associate_secretary', 'joint_secretary', 'associate_joint_secretary')
ORDER BY 
  CASE executive_role
    WHEN 'secretary' THEN 1
    WHEN 'associate_secretary' THEN 2
    WHEN 'joint_secretary' THEN 3
    WHEN 'associate_joint_secretary' THEN 4
  END;

-- Add or update Aparna's role
-- Replace 'aparna@example.com' with Aparna's actual email
UPDATE profiles
SET executive_role = 'associate_joint_secretary'
WHERE name ILIKE '%aparna%'
  AND (executive_role IS NULL OR executive_role != 'associate_joint_secretary');

-- Verify the update
SELECT 
  '✅ UPDATED EC MEMBERS' as section,
  name,
  email,
  executive_role
FROM profiles
WHERE executive_role IN ('secretary', 'associate_secretary', 'joint_secretary', 'associate_joint_secretary')
ORDER BY 
  CASE executive_role
    WHEN 'secretary' THEN 1
    WHEN 'associate_secretary' THEN 2
    WHEN 'joint_secretary' THEN 3
    WHEN 'associate_joint_secretary' THEN 4
  END;

-- Show who can approve events now
SELECT 
  '👥 EC MEMBERS WHO CAN APPROVE EVENTS' as section,
  name,
  executive_role,
  'Can approve events' as permission
FROM profiles
WHERE executive_role IN ('secretary', 'associate_secretary', 'joint_secretary', 'associate_joint_secretary')
ORDER BY 
  CASE executive_role
    WHEN 'secretary' THEN 1
    WHEN 'associate_secretary' THEN 2
    WHEN 'joint_secretary' THEN 3
    WHEN 'associate_joint_secretary' THEN 4
  END;

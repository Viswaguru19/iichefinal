-- Add approval field to profiles
ALTER TABLE profiles ADD COLUMN approved BOOLEAN DEFAULT FALSE;

-- Update role enum to include executive positions
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'secretary';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'associate_secretary';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'joint_secretary';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'associate_joint_secretary';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'treasurer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'associate_treasurer';

-- Update RLS policies to check approval
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Only approved users can access protected resources
CREATE POLICY "Only approved users can update events" ON events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true)
);

CREATE POLICY "Only approved users can update teams" ON kickoff_teams FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true)
);

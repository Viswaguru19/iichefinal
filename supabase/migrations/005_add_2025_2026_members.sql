-- IIChE AVVU Executive Committee 2025-2026
-- Run this in Supabase SQL Editor after creating user accounts

-- First, delete all existing committee members except super_admin
DELETE FROM committee_members 
WHERE user_id IN (
  SELECT id FROM profiles WHERE role != 'super_admin'
);

-- Update all non-super_admin users to student role
UPDATE profiles SET role = 'student', executive_role = NULL 
WHERE role != 'super_admin';

-- Note: You need to create user accounts first with these emails
-- Then run the INSERT statements below

-- Executive Committee Members
-- Secretary
UPDATE profiles SET executive_role = 'secretary', role = 'committee_member' 
WHERE email = 'swarnakamatchi@example.com';

-- Secretary Associate
UPDATE profiles SET executive_role = 'associate_secretary', role = 'committee_member' 
WHERE email = 'niranjana@example.com';

-- Joint Secretary
UPDATE profiles SET executive_role = 'joint_secretary', role = 'committee_member' 
WHERE email = 'mahima@example.com';

-- Joint Secretary Associate
UPDATE profiles SET executive_role = 'associate_joint_secretary', role = 'committee_member' 
WHERE email = 'aparna@example.com';

-- Treasurer
UPDATE profiles SET executive_role = 'treasurer', role = 'committee_member' 
WHERE email = 'bhavithira@example.com';

-- Treasurer Associate
UPDATE profiles SET executive_role = 'associate_treasurer', role = 'committee_member' 
WHERE email = 'gobika@example.com';

-- Committee Assignments
-- Get committee IDs first
-- Alumni Industry Connect: Head - K Gobika, Co-Heads - PG Krdvi Sree, Viswaguru R, Anusri B
-- Editorial: Head - Aparna Shanker, Co-Heads - Rithan K A, Peta Ujwala Raaga, Amrit Swaroop K J
-- Graphics and Design: Heads - S Krishnaendu Nair, Visram Anand R V, Co-Heads - Vansh Saxena, Bhavatharani M
-- Program: Heads - R Haritha, C. Tracy Cordelia, Co-Heads - Pranavika Shakhith, R Abhinav
-- Publicity: Heads - Anjali A S, Bhavithira M, Co-Heads - Naga Sree Varanasi, Sriram Sureshkumar
-- Public Relations: Heads - M. Nishiga, Poobithasri V S, Co-Heads - Sayuj Jayakrishna, Shivaanee P
-- Social and Environmental: Heads - M Namrithasre, Santhosh A, Co-Heads - Praanesh S, Samiksha S
-- Technical: Heads - Mahima Shivagurunathan, Dharshan B, Co-Heads - Hansini Anand, Sahana S D

-- Instructions:
-- 1. Create all user accounts through the portal signup
-- 2. Approve all accounts in admin panel
-- 3. Use the Edit User modal to assign committees and positions
-- 4. Or manually insert into committee_members table with proper committee_id values

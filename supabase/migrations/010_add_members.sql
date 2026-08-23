-- First, create auth users and profiles for all members
-- Note: Run this in Supabase SQL Editor

-- Executive Committee Members
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES 
('swarnakamatchi@iicheavvu.com', crypt('iichelogin', gen_salt('bf')), NOW()),
('niranjana@iicheavvu.com', crypt('iichelogin', gen_salt('bf')), NOW()),
('mahima@iicheavvu.com', crypt('iichelogin', gen_salt('bf')), NOW()),
('aparna@iicheavvu.com', crypt('iichelogin', gen_salt('bf')), NOW()),
('bhavithira@iicheavvu.com', crypt('iichelogin', gen_salt('bf')), NOW()),
('gobika@iicheavvu.com', crypt('iichelogin', gen_salt('bf')), NOW());

-- Insert profiles for executive members
INSERT INTO profiles (id, name, email, username, role, executive_role, approved)
SELECT id, 'Swarnakamatchi R', 'swarnakamatchi@iicheavvu.com', 'swarnakamatchi', 'secretary', 'secretary', true FROM auth.users WHERE email = 'swarnakamatchi@iicheavvu.com'
UNION ALL
SELECT id, 'A Niranjana Anur Aruna Sasti', 'niranjana@iicheavvu.com', 'niranjana', 'associate_secretary', 'associate_secretary', true FROM auth.users WHERE email = 'niranjana@iicheavvu.com'
UNION ALL
SELECT id, 'Mahima Shivagurunathan', 'mahima@iicheavvu.com', 'mahima', 'joint_secretary', 'joint_secretary', true FROM auth.users WHERE email = 'mahima@iicheavvu.com'
UNION ALL
SELECT id, 'Aparna Shankar', 'aparna@iicheavvu.com', 'aparna', 'associate_joint_secretary', 'associate_joint_secretary', true FROM auth.users WHERE email = 'aparna@iicheavvu.com'
UNION ALL
SELECT id, 'Bhavithira M', 'bhavithira@iicheavvu.com', 'bhavithira', 'treasurer', 'treasurer', true FROM auth.users WHERE email = 'bhavithira@iicheavvu.com'
UNION ALL
SELECT id, 'K Gobika', 'gobika@iicheavvu.com', 'gobika', 'associate_treasurer', 'associate_treasurer', true FROM auth.users WHERE email = 'gobika@iicheavvu.com';

-- Committee Heads (Alumni Industry Connect)
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at) VALUES 
('krdvisree@iicheavvu.com', crypt('iichelogin', gen_salt('bf')), NOW()),
('viswaguru@iicheavvu.com', crypt('iichelogin', gen_salt('bf')), NOW()),
('anusri@iicheavvu.com', crypt('iichelogin', gen_salt('bf')), NOW());

INSERT INTO profiles (id, name, email, username, role, approved)
SELECT id, 'PG Krdvi Sree', 'krdvisree@iicheavvu.com', 'krdvisree', 'committee_head', true FROM auth.users WHERE email = 'krdvisree@iicheavvu.com'
UNION ALL
SELECT id, 'Viswaguru R', 'viswaguru@iicheavvu.com', 'viswaguru', 'committee_head', true FROM auth.users WHERE email = 'viswaguru@iicheavvu.com'
UNION ALL
SELECT id, 'Anusri B', 'anusri@iicheavvu.com', 'anusri', 'committee_head', true FROM auth.users WHERE email = 'anusri@iicheavvu.com';

-- Add to Alumni Industry Connect Committee
INSERT INTO committee_members (user_id, committee_id, position)
SELECT id, '00000000-0000-0000-0000-000000000002', 'head' FROM profiles WHERE username = 'gobika'
UNION ALL
SELECT id, '00000000-0000-0000-0000-000000000002', 'head' FROM profiles WHERE username = 'krdvisree'
UNION ALL
SELECT id, '00000000-0000-0000-0000-000000000002', 'head' FROM profiles WHERE username = 'viswaguru'
UNION ALL
SELECT id, '00000000-0000-0000-0000-000000000002', 'head' FROM profiles WHERE username = 'anusri';

-- Editorial Committee
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at) VALUES 
('rithan@iicheavvu.com', crypt('iichelogin', gen_salt('bf')), NOW()),
('ujwala@iicheavvu.com', crypt('iichelogin', gen_salt('bf')), NOW()),
('amrit@iicheavvu.com', crypt('iichelogin', gen_salt('bf')), NOW());

INSERT INTO profiles (id, name, email, username, role, approved)
SELECT id, 'Rithan K A', 'rithan@iicheavvu.com', 'rithan', 'committee_head', true FROM auth.users WHERE email = 'rithan@iicheavvu.com'
UNION ALL
SELECT id, 'Peta Ujwala Raaga', 'ujwala@iicheavvu.com', 'ujwala', 'committee_head', true FROM auth.users WHERE email = 'ujwala@iicheavvu.com'
UNION ALL
SELECT id, 'Amrit Swaroop K J', 'amrit@iicheavvu.com', 'amrit', 'committee_head', true FROM auth.users WHERE email = 'amrit@iicheavvu.com';

INSERT INTO committee_members (user_id, committee_id, position)
SELECT id, '00000000-0000-0000-0000-000000000003', 'head' FROM profiles WHERE username = 'aparna'
UNION ALL
SELECT id, '00000000-0000-0000-0000-000000000003', 'head' FROM profiles WHERE username = 'rithan'
UNION ALL
SELECT id, '00000000-0000-0000-0000-000000000003', 'head' FROM profiles WHERE username = 'ujwala'
UNION ALL
SELECT id, '00000000-0000-0000-0000-000000000003', 'head' FROM profiles WHERE username = 'amrit';

-- Continue for all other committees...
-- (This is a template - add remaining members similarly)

-- Add all executive members to Executive Committee
INSERT INTO committee_members (user_id, committee_id, position)
SELECT id, '00000000-0000-0000-0000-000000000001', 'member' FROM profiles WHERE executive_role IS NOT NULL;

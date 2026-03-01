-- Insert Executive Committee
INSERT INTO committees (id, name, description, type) VALUES
('00000000-0000-0000-0000-000000000001', 'Executive Committee', 'The governing body of IIChE AVVU', 'executive');

-- Insert Regular Committees
INSERT INTO committees (id, name, description, type) VALUES
('00000000-0000-0000-0000-000000000002', 'Program Committee', 'Organizes technical and academic programs', 'regular'),
('00000000-0000-0000-0000-000000000003', 'Publicity Committee', 'Handles marketing and outreach activities', 'regular'),
('00000000-0000-0000-0000-000000000004', 'Sponsorship Committee', 'Manages sponsorships and partnerships', 'regular'),
('00000000-0000-0000-0000-000000000005', 'Design Committee', 'Creates visual content and designs', 'regular'),
('00000000-0000-0000-0000-000000000006', 'Editorial Committee', 'Manages content creation and publications', 'regular'),
('00000000-0000-0000-0000-000000000007', 'Web Development Committee', 'Develops and maintains digital platforms', 'regular'),
('00000000-0000-0000-0000-000000000008', 'HR Committee', 'Manages human resources and team coordination', 'regular'),
('00000000-0000-0000-0000-000000000009', 'Finance Committee', 'Handles financial planning and budgeting', 'regular');

-- Note: Actual member data should be inserted after user registration
-- This is a template for super admin creation

-- To create super admin, run this after first user signs up:
-- UPDATE profiles SET role = 'super_admin' WHERE email = 'admin@iicheavvu.com';

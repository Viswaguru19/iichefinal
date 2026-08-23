-- Clear existing committees and add new ones
DELETE FROM committees;

-- Insert new committees
INSERT INTO committees (id, name, description, type) VALUES
('00000000-0000-0000-0000-000000000001', 'Executive Committee', 'The governing body of IIChE AVVU', 'executive'),
('00000000-0000-0000-0000-000000000002', 'Alumni and Industry Connect Committee', 'Builds connections with alumni and industry partners', 'regular'),
('00000000-0000-0000-0000-000000000003', 'Editorial Committee', 'Manages content creation and publications', 'regular'),
('00000000-0000-0000-0000-000000000004', 'Graphics and Design Committee', 'Creates visual content and designs', 'regular'),
('00000000-0000-0000-0000-000000000005', 'Program Committee', 'Organizes technical and academic programs', 'regular'),
('00000000-0000-0000-0000-000000000006', 'Publicity Committee', 'Handles marketing and outreach activities', 'regular'),
('00000000-0000-0000-0000-000000000007', 'Public Relations Committee', 'Manages external communications and partnerships', 'regular'),
('00000000-0000-0000-0000-000000000008', 'Social and Environmental Committee', 'Focuses on sustainability and social impact', 'regular'),
('00000000-0000-0000-0000-000000000009', 'Technical Committee', 'Drives technical initiatives and hands-on learning', 'regular');

-- Note: Old co-heads are now promoted to heads
-- Add new co-heads later through admin panel

-- Add poster_status column to events for faculty approval workflow
-- Values: null (no poster), 'pending_faculty_approval', 'approved', 'rejected'
ALTER TABLE events ADD COLUMN IF NOT EXISTS poster_status TEXT;

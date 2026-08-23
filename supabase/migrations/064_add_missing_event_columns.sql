-- Add missing columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS faculty_approved_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS faculty_approved_by UUID REFERENCES profiles(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS head_approved_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS head_approved_by UUID REFERENCES profiles(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS head_rejection_reason TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS head_rejected_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS review_sent_by UUID REFERENCES profiles(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS review_sent_at TIMESTAMPTZ;

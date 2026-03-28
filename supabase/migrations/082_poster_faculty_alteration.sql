-- Poster faculty workflow: notes, review audit, alteration status
-- poster_status: null | pending_faculty_approval | approved | rejected | needs_alteration
-- (poster_status is also defined in 046_poster_approval.sql — add here if that migration was never applied)

ALTER TABLE events ADD COLUMN IF NOT EXISTS poster_status TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS poster_faculty_notes TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS poster_faculty_reviewed_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS poster_faculty_reviewed_by UUID REFERENCES profiles(id);

COMMENT ON COLUMN events.poster_faculty_notes IS 'Faculty feedback: rejection reason or alteration request';
COMMENT ON COLUMN events.poster_status IS 'null=no poster workflow; pending_faculty_approval; approved (public); rejected; needs_alteration';

-- Existing rows with a poster but no status: treat as already published
UPDATE events
SET poster_status = 'approved'
WHERE poster_url IS NOT NULL
  AND (poster_status IS NULL OR poster_status = '');

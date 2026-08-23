-- Second committee head approval (two distinct heads before EC)
ALTER TABLE events ADD COLUMN IF NOT EXISTS second_head_approved_by UUID REFERENCES profiles(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS second_head_approved_at TIMESTAMPTZ;

COMMENT ON COLUMN events.second_head_approved_by IS 'When workflow requires two head approvals, records the second head (different user from head_approved_by).';

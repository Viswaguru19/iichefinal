-- Fix: Could not find the 'audience_type' column of 'meetings' in the schema cache
-- Safe to re-run. Does not drop tables or existing meeting rows.

ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS audience_type TEXT DEFAULT 'all_members';
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS access_type TEXT DEFAULT 'invite_only';
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS require_approval BOOLEAN DEFAULT false;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';

CREATE INDEX IF NOT EXISTS idx_meetings_audience_type ON public.meetings(audience_type);

COMMENT ON COLUMN public.meetings.audience_type IS 'Who was invited: all_members, executive_committee, heads_only, coheads_only, specific_committee, general';

NOTIFY pgrst, 'reload schema';

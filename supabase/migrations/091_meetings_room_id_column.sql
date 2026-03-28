-- Migration: 091_meetings_room_id_column
-- Fixes PostgREST: "Could not find the 'room_id' column of 'meetings' in the schema cache"
-- when migration 043 was skipped or the DB was created from an older snapshot.
-- Idempotent; does not add a second UNIQUE if 043 already defined one on room_id.

ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS room_id TEXT;

CREATE INDEX IF NOT EXISTS idx_meetings_room_id ON public.meetings (room_id);

-- Enforce one slug per meeting when not already enforced by 043 (ignore if duplicate).
DO $body$
BEGIN
  ALTER TABLE public.meetings ADD CONSTRAINT meetings_room_id_key UNIQUE (room_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $body$;

COMMENT ON COLUMN public.meetings.room_id IS 'Portal /meet/{room_id} slug.';

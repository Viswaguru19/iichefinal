# Fix "event_date violates not-null constraint" Error

## Problem
Getting error: `null value in column "event_date" of relation "events" violates not-null constraint`

## Root Cause
The `events` table has an old `event_date` column with a NOT NULL constraint, but the code is trying to insert into a new `date` column instead.

## Solution

### Step 1: Run This SQL in Supabase

This will remove the NOT NULL constraint and add all missing columns:

```sql
-- Remove NOT NULL constraint from event_date
ALTER TABLE events 
  ALTER COLUMN event_date DROP NOT NULL;

-- Set a default value for event_date
ALTER TABLE events 
  ALTER COLUMN event_date SET DEFAULT NOW();

-- Create event_status enum if needed
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
    CREATE TYPE event_status AS ENUM (
      'draft', 'pending_head_approval', 'pending_executive', 
      'pending_faculty_approval', 'faculty_approved', 'approved',
      'in_progress', 'completed', 'cancelled', 'rejected'
    );
  END IF;
END $$;

-- Add all missing columns
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS budget DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS supporting_documents JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS status event_status DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS proposed_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS committee_id UUID REFERENCES committees(id),
  ADD COLUMN IF NOT EXISTS head_approved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS head_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS faculty_approved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS faculty_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finance_approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS finance_approved_by UUID REFERENCES profiles(id);

-- Copy event_date to date for existing records
UPDATE events SET date = event_date WHERE date IS NULL AND event_date IS NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_events_committee ON events(committee_id);
CREATE INDEX IF NOT EXISTS idx_events_proposed_by ON events(proposed_by);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
```

### Step 2: Code Already Fixed
The code has been updated to insert into both `event_date` (old column) and `date` (new column) to ensure compatibility.

## What This Does

1. **Removes NOT NULL constraint** from `event_date` so it can be null
2. **Sets default value** for `event_date` to NOW() 
3. **Adds all missing columns** (budget, proposed_by, status, etc.)
4. **Copies data** from event_date to date column
5. **Creates indexes** for better performance

## After Running SQL

1. Go to `/dashboard/propose-event`
2. Fill in event details
3. Submit
4. ✅ Should work without errors!

## Verify It Worked

Run this to check:

```sql
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'events'
  AND column_name IN ('event_date', 'date', 'budget', 'proposed_by', 'status')
ORDER BY column_name;
```

You should see:
- `event_date` with `is_nullable = YES`
- `date` column exists
- `budget` column exists
- `proposed_by` column exists
- `status` column exists

## Files

- `FIX_EVENT_DATE_CONSTRAINT.sql` - The SQL script
- `FIX_EVENT_DATE_ERROR.md` - This file
- `app/dashboard/propose-event/page.tsx` - Updated code

## Status

✅ Code updated to use both event_date and date
✅ SQL script created
⏳ Run the SQL in Supabase

Once you run the SQL, event proposals will work perfectly!

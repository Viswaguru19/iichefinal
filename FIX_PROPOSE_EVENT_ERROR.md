# Fix "Could not find 'proposed_by' column" Error

## Problem
When proposing an event, you're getting errors about missing columns:
- `Could not find the 'budget' column of 'events' in the schema cache`
- `Could not find the 'proposed_by' column of 'events' in the schema cache`

## Root Cause
The `events` table is missing multiple columns that the propose event page expects. These columns should have been added by migration 023, but they're missing in your database.

## Solution - Run This SQL

### Copy and paste this ENTIRE script into Supabase SQL Editor:

```sql
-- Create enum if needed
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

-- Add all columns at once
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

-- Copy old event_date to new date column if needed
UPDATE events SET date = event_date WHERE date IS NULL AND event_date IS NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_events_committee ON events(committee_id);
CREATE INDEX IF NOT EXISTS idx_events_proposed_by ON events(proposed_by);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
```

### Steps:
1. Go to Supabase Dashboard
2. Click "SQL Editor" in left sidebar
3. Click "New Query"
4. Copy the ENTIRE SQL above
5. Paste it
6. Click "Run" (or press Ctrl+Enter)
7. Wait for success message

## What This Adds

The script adds these columns to your `events` table:

| Column | Type | Purpose |
|--------|------|---------|
| date | TIMESTAMPTZ | Event date and time |
| budget | DECIMAL(10,2) | Estimated budget in rupees |
| supporting_documents | JSONB | Array of uploaded document URLs |
| status | event_status | Approval workflow status |
| proposed_by | UUID | User who proposed the event |
| committee_id | UUID | Committee proposing the event |
| head_approved_by | UUID | Committee head who approved |
| head_approved_at | TIMESTAMPTZ | When head approved |
| faculty_approved_by | UUID | Faculty who approved |
| faculty_approved_at | TIMESTAMPTZ | When faculty approved |
| finance_approved | BOOLEAN | Finance approval status |
| finance_approved_by | UUID | Who approved finances |

## After Running SQL

1. Go to `/dashboard/propose-event`
2. Fill in event details
3. Submit
4. ✅ Should work without errors!

## Verify It Worked

Run this query to check:

```sql
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'events'
  AND column_name IN ('budget', 'proposed_by', 'supporting_documents', 'date', 'status')
ORDER BY column_name;
```

You should see all 5 columns listed.

## Files Created

- `QUICK_FIX_EVENTS.sql` - Simple version (use this one!)
- `FIX_ALL_EVENTS_COLUMNS.sql` - Detailed version with verification
- `FIX_PROPOSE_EVENT_ERROR.md` - This instruction file

## Status

✅ Code is ready
✅ SQL script created
⏳ Run the SQL in Supabase

Once you run the SQL, event proposals will work perfectly!

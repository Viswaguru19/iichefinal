# 🚨 RUN THIS SQL NOW - Fix All Event Errors

## The Problem
You're getting multiple errors when proposing events:
- ❌ `null value in column "event_date" violates not-null constraint`
- ❌ `Could not find the 'budget' column`
- ❌ `Could not find the 'proposed_by' column`
- ❌ `Could not find the 'supporting_documents' column`

## The Solution
Run this ONE SQL script to fix everything at once.

---

## 📋 COPY THIS ENTIRE SQL SCRIPT:

```sql
-- Fix event_date NOT NULL constraint
ALTER TABLE events 
  ALTER COLUMN event_date DROP NOT NULL;

ALTER TABLE events 
  ALTER COLUMN event_date SET DEFAULT NOW();

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

-- Copy old event_date to new date column
UPDATE events SET date = event_date WHERE date IS NULL AND event_date IS NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_events_committee ON events(committee_id);
CREATE INDEX IF NOT EXISTS idx_events_proposed_by ON events(proposed_by);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
```

---

## 🎯 How to Run It:

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New Query"** button

### Step 2: Paste and Run
1. Copy the ENTIRE SQL script above (from `DO $$` to the last `;`)
2. Paste it into the SQL Editor
3. Click **"Run"** button (or press `Ctrl+Enter`)
4. Wait for the green success message

### Step 3: Verify
You should see a message like:
```
Success. No rows returned
```

This means all columns were added successfully!

---

## ✅ What This Fixes

After running this SQL, you'll be able to:
- ✅ Propose events without errors
- ✅ Add budget information
- ✅ Upload supporting documents
- ✅ Track approval workflow
- ✅ See event progress

---

## 🧪 Test It

1. Go to `/dashboard/propose-event`
2. Fill in:
   - Event Title
   - Description
   - Date
   - Location
   - Budget (optional)
   - Supporting Document (optional)
3. Click "Submit Proposal"
4. ✅ Should work without any errors!

---

## 📊 Verify Columns Were Added

Run this query to double-check:

```sql
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'events'
  AND column_name IN ('budget', 'proposed_by', 'supporting_documents', 'date', 'status')
ORDER BY column_name;
```

You should see all 5 columns listed.

---

## ❓ Still Having Issues?

If you still get errors after running the SQL:

1. **Check if the SQL ran successfully** - Look for green success message
2. **Refresh your browser** - Clear cache and reload the page
3. **Check Supabase logs** - Go to Logs section in Supabase dashboard
4. **Verify columns exist** - Run the verification query above

---

## 📁 Related Files

- `QUICK_FIX_EVENTS.sql` - The SQL script (same as above)
- `FIX_ALL_EVENTS_COLUMNS.sql` - Detailed version with more checks
- `FIX_PROPOSE_EVENT_ERROR.md` - Full documentation

---

## 🎉 That's It!

Once you run the SQL, everything will work. The propose event feature will be fully functional with all the approval workflow features.

# Events Table Fix - Summary

## 🔴 Problem
Missing columns in `events` table causing errors when proposing events.

## 🟢 Solution
Run ONE SQL script to add all missing columns.

---

## 📝 Quick Instructions

### 1️⃣ Open Supabase SQL Editor
- Go to: https://supabase.com/dashboard
- Click: **SQL Editor** → **New Query**

### 2️⃣ Copy & Paste This SQL
```sql
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

UPDATE events SET date = event_date WHERE date IS NULL AND event_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_committee ON events(committee_id);
CREATE INDEX IF NOT EXISTS idx_events_proposed_by ON events(proposed_by);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
```

### 3️⃣ Click Run
- Press **Run** button or `Ctrl+Enter`
- Wait for success message

### 4️⃣ Test
- Go to `/dashboard/propose-event`
- Fill form and submit
- ✅ Should work!

---

## 📊 Columns Added

| Column | Type | Purpose |
|--------|------|---------|
| date | TIMESTAMPTZ | Event date/time |
| budget | DECIMAL | Budget amount |
| supporting_documents | JSONB | Document URLs |
| status | ENUM | Approval status |
| proposed_by | UUID | Proposer ID |
| committee_id | UUID | Committee ID |
| head_approved_by | UUID | Head approver |
| head_approved_at | TIMESTAMPTZ | Head approval time |
| faculty_approved_by | UUID | Faculty approver |
| faculty_approved_at | TIMESTAMPTZ | Faculty approval time |
| finance_approved | BOOLEAN | Finance status |
| finance_approved_by | UUID | Finance approver |

---

## 📁 Files Available

1. **RUN_THIS_SQL_NOW.md** ⭐ - Start here! Detailed instructions
2. **QUICK_FIX_EVENTS.sql** - Just the SQL script
3. **FIX_ALL_EVENTS_COLUMNS.sql** - SQL with verification
4. **FIX_PROPOSE_EVENT_ERROR.md** - Full documentation
5. **EVENTS_TABLE_FIX_SUMMARY.md** - This file

---

## ✅ Status

- Code: ✅ Ready
- Build: ✅ Successful
- SQL: ⏳ **Run the SQL above**

Once you run the SQL, everything works!

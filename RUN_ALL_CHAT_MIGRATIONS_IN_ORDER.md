# 🚀 Complete Chat System Migration Guide

## ⚠️ IMPORTANT: Missing Base Tables Detected!

Your database is missing the base chat tables. You need to run **9 migrations total** (not 8).

## 📋 Current Database State

You have:
- ✅ profiles
- ✅ committees
- ✅ committee_members

You're missing:
- ❌ chat_groups
- ❌ chat_messages
- ❌ chat_participants
- ❌ message_read_status
- ❌ typing_indicators

## 🎯 Complete Migration Plan

### Step 1: Create Base Chat Tables (NEW!)
**File**: `020_create_base_chat_tables.sql`

This creates the foundation:
- chat_groups
- chat_participants
- chat_messages
- message_read_status
- typing_indicators

### Step 2: Run Enhancement Migrations
**Files**: `026-033` (8 migrations)

These add WhatsApp-like features on top of the base tables.

## 📝 Complete Migration Order

Run these **9 migrations** in this exact order:

```
1. 020_create_base_chat_tables.sql          ← NEW! Run this FIRST
2. 026_enhance_chat_messages.sql
3. 027_create_message_reactions.sql
4. 028_enhance_message_read_status.sql
5. 029_create_message_forwards.sql
6. 030_enhance_chat_groups.sql
7. 031_create_system_chat_groups.sql
8. 032_create_committee_chat_groups.sql
9. 033_comprehensive_chat_rls_policies.sql
```

## 🔧 How to Run (Choose One Method)

### Method 1: Supabase Dashboard (Recommended for First Time)

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy the content from `supabase/migrations/020_create_base_chat_tables.sql`
5. Click **Run**
6. Wait for success message
7. Repeat for migrations 026-033 in order

### Method 2: Run All at Once (Advanced)

Copy this complete SQL and run it all at once in Supabase SQL Editor:

```sql
-- ============================================
-- MIGRATION 1: Base Chat Tables (020)
-- ============================================
-- [Copy entire content of 020_create_base_chat_tables.sql here]

-- ============================================
-- MIGRATION 2: Enhance Chat Messages (026)
-- ============================================
-- [Copy entire content of 026_enhance_chat_messages.sql here]

-- ... and so on for all 9 migrations
```

### Method 3: Supabase CLI (If you have it installed)

```bash
# Run all migrations in order
supabase db push

# Or run individually
supabase db execute -f supabase/migrations/020_create_base_chat_tables.sql
supabase db execute -f supabase/migrations/026_enhance_chat_messages.sql
supabase db execute -f supabase/migrations/027_create_message_reactions.sql
supabase db execute -f supabase/migrations/028_enhance_message_read_status.sql
supabase db execute -f supabase/migrations/029_create_message_forwards.sql
supabase db execute -f supabase/migrations/030_enhance_chat_groups.sql
supabase db execute -f supabase/migrations/031_create_system_chat_groups.sql
supabase db execute -f supabase/migrations/032_create_committee_chat_groups.sql
supabase db execute -f supabase/migrations/033_comprehensive_chat_rls_policies.sql
```

## ✅ Verification After Each Migration

### After Migration 020 (Base Tables):
```sql
-- Should return 5 tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('chat_groups', 'chat_messages', 'chat_participants', 'message_read_status', 'typing_indicators');
```

### After Migration 026 (Enhanced Messages):
```sql
-- Should return 7 new columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'chat_messages' 
AND column_name IN ('file_name', 'file_size', 'is_edited', 'edited_at', 'is_pinned', 'pinned_by', 'pinned_at');
```

### After Migration 027 (Reactions):
```sql
-- Should return 1 table
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'message_reactions';
```

### After Migration 028 (Read Status):
```sql
-- Should return 1 column
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'message_read_status' 
AND column_name = 'delivered_at';
```

### After Migration 029 (Forwards):
```sql
-- Should return 1 table
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'message_forwards';
```

### After Migration 030 (Enhanced Groups):
```sql
-- Should return 2 columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'chat_groups' 
AND column_name IN ('is_muted', 'muted_until');
```

### After Migration 031 (System Groups):
```sql
-- Should return 4 groups
SELECT id, name, chat_type 
FROM chat_groups 
WHERE chat_type IN ('organization', 'executive', 'heads', 'coheads');
```

### After Migration 032 (Committee Groups):
```sql
-- Should return one group per committee
SELECT cg.name, c.name as committee_name 
FROM chat_groups cg
JOIN committees c ON c.id = cg.committee_id
WHERE cg.chat_type = 'committee';
```

### After Migration 033 (RLS Policies):
```sql
-- Should return multiple policies per table
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE tablename LIKE '%chat%' OR tablename LIKE '%message%'
GROUP BY tablename
ORDER BY tablename;
```

## 🎉 Final Verification

After all 9 migrations, run this comprehensive check:

```sql
-- Check all tables exist
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_groups') 
    THEN '✅' ELSE '❌' END as chat_groups,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_messages') 
    THEN '✅' ELSE '❌' END as chat_messages,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_participants') 
    THEN '✅' ELSE '❌' END as chat_participants,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'message_read_status') 
    THEN '✅' ELSE '❌' END as message_read_status,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'message_reactions') 
    THEN '✅' ELSE '❌' END as message_reactions,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'message_forwards') 
    THEN '✅' ELSE '❌' END as message_forwards,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'typing_indicators') 
    THEN '✅' ELSE '❌' END as typing_indicators;

-- Check system groups exist
SELECT COUNT(*) as system_groups_count 
FROM chat_groups 
WHERE chat_type IN ('organization', 'executive', 'heads', 'coheads');
-- Should return: 4

-- Check committee groups exist
SELECT COUNT(*) as committee_groups_count 
FROM chat_groups 
WHERE chat_type = 'committee';
-- Should return: number of committees you have

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename LIKE '%chat%' OR tablename LIKE '%message%';
-- All should show: true

-- Check triggers exist
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%chat%' OR trigger_name LIKE '%group%'
ORDER BY event_object_table, trigger_name;
-- Should show multiple triggers
```

## 🎊 Success Indicators

After all migrations, you should have:

### Tables (7 total):
- ✅ chat_groups
- ✅ chat_participants
- ✅ chat_messages
- ✅ message_read_status
- ✅ message_reactions
- ✅ message_forwards
- ✅ typing_indicators

### System Groups (4 total):
- ✅ Whole Organization
- ✅ EC Board
- ✅ All Committee Heads
- ✅ All Committee Co-Heads

### Committee Groups:
- ✅ One chat group per committee

### Auto-Sync Triggers (6 total):
- ✅ New user → Organization group
- ✅ EC role → EC Board group
- ✅ Head role → Heads group
- ✅ Co-Head role → Co-Heads group
- ✅ New committee → Committee chat group
- ✅ Committee member → Committee chat

### RLS Policies:
- ✅ 20+ policies across all chat tables

## 🚨 Troubleshooting

### Error: "relation does not exist"
- You skipped migration 020. Run it first!

### Error: "column already exists"
- You may have run a migration twice. Check which columns exist and skip that migration.

### Error: "duplicate key value violates unique constraint"
- System groups already exist. This is OK, the migration uses `ON CONFLICT DO NOTHING`.

### No committee groups created
- Check if you have committees: `SELECT * FROM committees;`
- Check if committee_members exist: `SELECT * FROM committee_members;`

### No users in system groups
- Check if you have active users: `SELECT * FROM profiles WHERE is_active = true;`
- Check chat_participants: `SELECT * FROM chat_participants;`

## 📞 Need Help?

If you encounter any errors:
1. Note which migration number failed
2. Copy the exact error message
3. Check the troubleshooting section above
4. Let me know and I'll help fix it!

---

**Ready to proceed?** Start with migration 020!

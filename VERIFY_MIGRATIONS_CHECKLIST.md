# ✅ Migration Verification Checklist

Before running the chat migrations in Supabase, verify these items:

## 1. Check Migration Files Exist

Run this command to list all chat migration files:
```bash
ls -la supabase/migrations/02*.sql
```

You should see:
- ✅ 026_enhance_chat_messages.sql
- ✅ 027_create_message_reactions.sql
- ✅ 028_enhance_message_read_status.sql
- ✅ 029_create_message_forwards.sql
- ✅ 030_enhance_chat_groups.sql
- ✅ 031_create_system_chat_groups.sql
- ✅ 032_create_committee_chat_groups.sql
- ✅ 033_comprehensive_chat_rls_policies.sql

## 2. Check Current Database State

Before running migrations, check what tables already exist:

```sql
-- Check if chat tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%chat%' OR table_name LIKE '%message%'
ORDER BY table_name;
```

Expected existing tables:
- chat_groups
- chat_messages
- chat_participants
- message_read_status
- typing_indicators

## 3. Check Existing Columns

Verify current chat_messages structure:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'chat_messages'
ORDER BY ordinal_position;
```

## 4. Backup Recommendation

**IMPORTANT**: Before running migrations, backup your data:

```sql
-- Backup existing chat data (optional, for safety)
CREATE TABLE chat_messages_backup AS SELECT * FROM chat_messages;
CREATE TABLE chat_groups_backup AS SELECT * FROM chat_groups;
CREATE TABLE chat_participants_backup AS SELECT * FROM chat_participants;
```

## 5. Test Migration Syntax

You can test SQL syntax without executing by using:
```sql
-- In Supabase SQL Editor, use EXPLAIN
EXPLAIN <your migration SQL here>
```

## 6. Migration Order Matters!

Run migrations in this EXACT order:
1. 026 (enhance messages)
2. 027 (reactions table)
3. 028 (read status enhancement)
4. 029 (forwards table)
5. 030 (enhance groups)
6. 031 (system groups)
7. 032 (committee groups)
8. 033 (RLS policies)

## 7. What to Watch For

### Migration 026 (Enhance Chat Messages)
- ✅ Adds 7 new columns to chat_messages
- ⚠️ Check: Does chat_messages table exist?
- ⚠️ Check: Do any of these columns already exist?

### Migration 027 (Message Reactions)
- ✅ Creates new table: message_reactions
- ⚠️ Check: Does this table already exist?

### Migration 028 (Read Status)
- ✅ Adds delivered_at column
- ⚠️ Check: Does message_read_status table exist?

### Migration 029 (Forwards)
- ✅ Creates new table: message_forwards
- ⚠️ Check: Does this table already exist?

### Migration 030 (Enhance Groups)
- ✅ Adds is_muted, muted_until columns
- ⚠️ Check: Does chat_groups table exist?

### Migration 031 (System Groups)
- ✅ Creates 4 system groups
- ✅ Creates 4 trigger functions
- ⚠️ Check: Do these groups already exist?
- ⚠️ Check: Do you have profiles and committee_members tables?

### Migration 032 (Committee Groups)
- ✅ Creates committee chat groups
- ✅ Creates trigger for auto-sync
- ⚠️ Check: Do you have committees table?
- ⚠️ Check: Do you have committee_members table?

### Migration 033 (RLS Policies)
- ✅ Enables RLS on all chat tables
- ✅ Creates 20+ policies
- ⚠️ Check: Are there existing policies that might conflict?

## 8. Quick Pre-Flight Check

Run this query to check prerequisites:
```sql
-- Check all required tables exist
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') 
    THEN '✅' ELSE '❌' END as profiles,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'committees') 
    THEN '✅' ELSE '❌' END as committees,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'committee_members') 
    THEN '✅' ELSE '❌' END as committee_members,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_groups') 
    THEN '✅' ELSE '❌' END as chat_groups,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_messages') 
    THEN '✅' ELSE '❌' END as chat_messages,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_participants') 
    THEN '✅' ELSE '❌' END as chat_participants;
```

All should show ✅. If any show ❌, you need to create those tables first.

## 9. After Running Migrations

Verify success with these queries:

### Check new columns exist:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'chat_messages' 
AND column_name IN ('file_name', 'is_edited', 'is_pinned');
```

### Check new tables exist:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('message_reactions', 'message_forwards');
```

### Check system groups created:
```sql
SELECT id, name, chat_type FROM chat_groups 
WHERE chat_type IN ('organization', 'executive', 'heads', 'coheads');
```

### Check committee groups created:
```sql
SELECT cg.name, c.name as committee_name 
FROM chat_groups cg
JOIN committees c ON c.id = cg.committee_id
WHERE cg.chat_type = 'committee';
```

### Check RLS policies:
```sql
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE tablename LIKE '%chat%' OR tablename LIKE '%message%'
GROUP BY tablename;
```

### Check triggers created:
```sql
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%chat%' OR trigger_name LIKE '%group%';
```

## 10. Rollback Plan (If Needed)

If something goes wrong, you can rollback:

```sql
-- Drop new tables
DROP TABLE IF EXISTS message_reactions CASCADE;
DROP TABLE IF EXISTS message_forwards CASCADE;

-- Remove new columns
ALTER TABLE chat_messages 
  DROP COLUMN IF EXISTS file_name,
  DROP COLUMN IF EXISTS file_size,
  DROP COLUMN IF EXISTS is_edited,
  DROP COLUMN IF EXISTS edited_at,
  DROP COLUMN IF EXISTS is_pinned,
  DROP COLUMN IF EXISTS pinned_by,
  DROP COLUMN IF EXISTS pinned_at;

ALTER TABLE message_read_status DROP COLUMN IF EXISTS delivered_at;
ALTER TABLE chat_groups DROP COLUMN IF EXISTS is_muted, DROP COLUMN IF EXISTS muted_until;

-- Remove system groups
DELETE FROM chat_groups WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004'
);

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_add_user_to_org_group ON profiles;
DROP TRIGGER IF EXISTS trigger_manage_ec_group ON profiles;
DROP TRIGGER IF EXISTS trigger_manage_heads_group ON committee_members;
DROP TRIGGER IF EXISTS trigger_manage_coheads_group ON committee_members;
DROP TRIGGER IF EXISTS trigger_create_committee_chat ON committees;
DROP TRIGGER IF EXISTS trigger_manage_committee_chat ON committee_members;

-- Restore from backup if needed
-- INSERT INTO chat_messages SELECT * FROM chat_messages_backup;
```

## ✅ Ready to Proceed?

Once you've verified:
- [ ] All 8 migration files exist
- [ ] Required tables (profiles, committees, etc.) exist
- [ ] No conflicting columns/tables exist
- [ ] You have a backup (optional but recommended)

Then you can proceed with running the migrations!

## 🚀 Run Migrations

Choose your method:

### Method 1: Supabase Dashboard
1. Open Supabase Dashboard → SQL Editor
2. Copy-paste each migration file content (in order 026-033)
3. Click "Run" for each one
4. Verify success after each migration

### Method 2: Supabase CLI
```bash
supabase db push
```

Or individually:
```bash
for i in {026..033}; do
  echo "Running migration $i..."
  supabase db execute -f supabase/migrations/${i}_*.sql
done
```

---

**Need Help?** If any verification step fails, let me know and I'll help fix it before running migrations!

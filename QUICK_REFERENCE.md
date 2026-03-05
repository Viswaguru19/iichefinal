# 🚀 Quick Reference Card

## 📋 What to Do Right Now

### 1. Run SQL Setup (Choose One)

#### Option A: All-in-One (Recommended)
```sql
-- Copy and paste this entire file in Supabase SQL Editor:
COMPLETE_DATABASE_SETUP.sql
```

#### Option B: Individual Files (If Option A fails)
```sql
-- Run these in order:
1. STEP1_ADD_ENUM_VALUES.sql
2. STEP2_ADD_COLUMNS.sql
3. ADD_ACTIVE_ENUM_VALUE.sql
4. CREATE_EC_APPROVALS_TABLE.sql
5. ADD_WORKFLOW_CONFIG_SETTINGS.sql
6. CREATE_NOTIFICATIONS_SYSTEM.sql
```

### 2. Restart Server
```bash
# Press Ctrl+C to stop
npm run dev
```

### 3. Test
1. Open http://localhost:3000/dashboard
2. Look for bell icon 🔔 in top right
3. Propose an event
4. Check notifications as committee head

## ✅ Success Indicators

You'll know it's working when:
- ✅ Bell icon appears in dashboard header
- ✅ No errors in browser console
- ✅ Proposing event creates notification
- ✅ Clicking bell shows dropdown
- ✅ Badge shows unread count

## 🎯 What You Get

### Notification Bell
- Location: Dashboard header (top right)
- Shows: Unread count badge
- Click: Opens dropdown with recent notifications
- Real-time: Updates automatically

### Notifications Page
- URL: `/dashboard/notifications`
- Features: View all, filter, mark read, delete

### Automatic Notifications
- 📝 Event proposed → Committee heads
- ✅ Head approves → EC members
- ✅ Event active → Proposer
- ❌ Event rejected → Proposer
- 🔄 EC revokes → Proposer & Head

## 📖 Documentation

- `FINAL_IMPLEMENTATION_SUMMARY.md` - Complete overview
- `NOTIFICATION_SYSTEM_COMPLETE.md` - Notification details
- `RUN_NOTIFICATIONS_SETUP.md` - Setup instructions
- `SESSION_SUMMARY.md` - Previous features

## 🐛 Quick Fixes

### Bell icon not showing?
```bash
# Restart server
npm run dev
# Hard refresh browser
Ctrl + Shift + R
```

### SQL errors?
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('notifications', 'ec_approvals', 'workflow_config');

-- Check enum values
SELECT unnest(enum_range(NULL::event_status));
```

### Notifications not working?
1. Check Supabase Realtime is enabled
2. Verify triggers exist in Supabase dashboard
3. Check browser console for errors

## 🎉 That's It!

Run the SQL, restart server, and you're done!

---

**Need more help?** See `FINAL_IMPLEMENTATION_SUMMARY.md`

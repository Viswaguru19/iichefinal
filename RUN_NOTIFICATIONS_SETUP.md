# 🚀 Quick Setup: Notification System

## What You Need to Do

### 1️⃣ Run SQL Scripts (In Order)

Open Supabase SQL Editor and run these files in order:

```
1. STEP1_ADD_ENUM_VALUES.sql          ← Adds enum values
2. STEP2_ADD_COLUMNS.sql              ← Adds event columns
3. ADD_ACTIVE_ENUM_VALUE.sql          ← Adds 'active' enum
4. CREATE_EC_APPROVALS_TABLE.sql      ← Creates EC approvals table
5. CREATE_NOTIFICATIONS_SYSTEM.sql    ← Creates notification system ✨ NEW
```

### 2️⃣ Restart Development Server

```bash
# Stop current server (Ctrl+C in terminal)
# Then restart:
npm run dev
```

### 3️⃣ Test It Out!

1. **Open Dashboard** - You'll see a bell icon 🔔 in the header
2. **Propose an Event** - Committee head will get a notification
3. **Click the Bell** - See your notifications dropdown
4. **Click "View All Notifications"** - See full notifications page

## ✨ What's New

### Notification Bell in Header
- Shows unread count badge (red circle with number)
- Click to see recent 20 notifications
- Real-time updates (no refresh needed!)
- Mark as read, delete, or click to navigate

### Full Notifications Page
- URL: `/dashboard/notifications`
- View all notifications with full details
- Filter by all or unread only
- Mark all as read with one click
- Delete all read notifications

### Automatic Notifications For:
- 📝 New event proposals → Committee heads
- ✅ Head approvals → EC members
- ✅ Event becomes active → Proposer
- ❌ Event rejected → Proposer
- 🔄 EC revokes rejection → Proposer & Head

## 🎯 Quick Test

1. **As Committee Member**: Propose an event
2. **As Committee Head**: Check bell icon - you'll see notification!
3. **Click notification**: Goes to proposals page
4. **Approve event**: EC members get notified
5. **As EC Member**: Check bell - you'll see notification!

## 📱 Features

- **Real-time**: No page refresh needed
- **Smart badges**: Shows unread count
- **One-click actions**: Mark read, delete
- **Navigation**: Click to go to relevant page
- **Time formatting**: "5m ago", "2h ago", etc.
- **Type icons**: Different emoji for each type

## 🔧 If Something Goes Wrong

### Notifications not showing?
1. Check if SQL script ran successfully (look for success messages)
2. Hard refresh browser (Ctrl+Shift+R)
3. Check browser console for errors (F12)

### Bell icon not appearing?
1. Make sure you restarted the dev server
2. Clear browser cache
3. Check if DashboardNav component loaded

### Real-time not working?
1. Check Supabase Realtime is enabled
2. Verify websocket connection in Network tab
3. Try refreshing the page

## 📖 Full Documentation

See `NOTIFICATION_SYSTEM_COMPLETE.md` for:
- Complete feature list
- Database schema
- Customization options
- Future enhancements
- Developer guide

## ✅ Success Indicators

You'll know it's working when:
- ✅ Bell icon appears in dashboard header
- ✅ Red badge shows unread count
- ✅ Clicking bell shows dropdown
- ✅ Proposing event creates notification for head
- ✅ Approving event creates notification for EC
- ✅ Notifications update in real-time

## 🎉 That's It!

Your notification system is ready to use. Users will now get instant notifications for all important events!

---

**Need Help?** Check the full documentation in `NOTIFICATION_SYSTEM_COMPLETE.md`

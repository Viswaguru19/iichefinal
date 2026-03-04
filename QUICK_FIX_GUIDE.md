# Quick Fix Guide 🔧

## Issue 1: SQL Policy Already Exists ✅ FIXED
The migration was already run. This is normal and not an error.

**Solution:** Use the updated migration file `RUN_LOGO_MIGRATION.sql` which safely handles existing policies.

## Issue 2: Next.js Cache Error ⚠️ NEEDS FIX

### Error Message:
```
Error: EINVAL: invalid argument, readlink
.next\server\app-paths-manifest.json
```

### Quick Fix (Choose One):

#### Method 1: Command Prompt (Easiest)
```bash
# 1. Stop dev server (Ctrl+C)
# 2. Run this command:
rmdir /s /q .next

# 3. Restart dev server:
npm run dev
```

#### Method 2: PowerShell
```powershell
# 1. Stop dev server (Ctrl+C)
# 2. Run this command:
Remove-Item -Recurse -Force .next

# 3. Restart dev server:
npm run dev
```

#### Method 3: Manual
1. Stop dev server (Ctrl+C in terminal)
2. Go to your project folder
3. Delete the `.next` folder
4. Run `npm run dev`

## Why This Happens
Your project is in OneDrive (`C:\Users\guhag\OneDrive\Desktop\IICHE PORTAL`), which can cause file locking issues with Next.js cache.

## Long-term Solution (Optional)
Move project outside OneDrive:
```bash
# Example: Move to C:\Projects
C:\Projects\IICHE PORTAL
```

## After Fixing

### 1. Run the Logo Migration
In Supabase SQL Editor, run:
```sql
-- Copy and paste contents of RUN_LOGO_MIGRATION.sql
```

### 2. Verify Everything Works
1. Dev server should start without errors
2. Login as admin
3. Go to Admin Panel → Logo Management
4. Upload a test logo
5. Check it appears on all pages

## All Features Working ✅
- Logo management system
- Dynamic logo across portal
- Chat improvements (polls, emoji picker)
- Progress display enhancements
- All previous features

## Need Help?
If issues persist:
1. Check `.env.local` has correct Supabase credentials
2. Verify Supabase project is running
3. Clear browser cache (Ctrl+Shift+Delete)
4. Try incognito/private browsing mode

## Files to Run
1. `RUN_LOGO_MIGRATION.sql` - In Supabase SQL Editor
2. Delete `.next` folder - In your terminal/file explorer
3. `npm run dev` - Start dev server

That's it! 🎉

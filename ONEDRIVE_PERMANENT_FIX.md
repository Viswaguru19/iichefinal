# OneDrive Permanent Fix for Next.js Development

## The Problem

Your project is located in `OneDrive\Desktop\IICHE PORTAL`, which causes OneDrive to sync the `.next` build folder. This creates file locking issues during development and builds.

## Quick Fix (Temporary)

When you get the EINVAL error, run:

```powershell
Remove-Item -Recurse -Force .next
```

Then restart your dev server.

## Permanent Solutions

### Option 1: Exclude .next from OneDrive Sync (Recommended)

1. Right-click the `.next` folder in File Explorer
2. Select "Free up space" or "Always keep on this device" → "Free up space"
3. This tells OneDrive to not sync this folder

**OR** use PowerShell:

```powershell
# Mark .next as excluded from OneDrive sync
attrib +U ".next"
```

### Option 2: Move Project Outside OneDrive (Best)

Move your project to a location NOT synced by OneDrive:

```powershell
# Example: Move to C:\Projects
mkdir C:\Projects
Move-Item "C:\Users\guhag\OneDrive\Desktop\IICHE PORTAL" "C:\Projects\IICHE-PORTAL"
cd C:\Projects\IICHE-PORTAL
```

Benefits:
- No sync conflicts
- Faster builds
- No file locking issues
- Better performance

### Option 3: Add .next to OneDrive Exclusions

1. Open OneDrive settings (system tray icon)
2. Go to Settings → Sync and backup → Advanced settings
3. Add `.next` to excluded folders

## After Applying Fix

1. Delete `.next` folder: `Remove-Item -Recurse -Force .next`
2. Clear node_modules cache: `npm cache clean --force`
3. Reinstall if needed: `npm install`
4. Start dev server: `npm run dev`

## Why This Happens

- OneDrive syncs files in real-time
- Next.js creates/deletes many files in `.next` during builds
- OneDrive locks files during sync
- Next.js can't delete locked files → EINVAL error

## Prevention

Add this to your `.gitignore` (already done):
```
.next
node_modules
.env*.local
```

## Recommended Folder Structure

```
C:\Projects\
  └── IICHE-PORTAL\          ← NOT in OneDrive
      ├── .next\             ← Build folder
      ├── node_modules\      ← Dependencies
      ├── app\               ← Your code
      └── ...

C:\Users\guhag\OneDrive\
  └── Documents\             ← Keep documents here
      └── Project-Backups\   ← Backup code here (without .next)
```

## Quick Commands

```powershell
# Clean and restart
Remove-Item -Recurse -Force .next
npm run dev

# If still having issues
Remove-Item -Recurse -Force .next
Remove-Item -Recurse -Force node_modules
npm install
npm run dev
```

## For Production Builds

If you get this error during `npm run build`:

```powershell
Remove-Item -Recurse -Force .next
npm run build
```

The build will work after cleaning `.next`.

---

**Bottom Line:** Either move your project outside OneDrive or exclude `.next` from sync. This will solve the issue permanently!

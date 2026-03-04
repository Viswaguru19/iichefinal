# Fix Next.js Cache Error

## The Error
```
Error: EINVAL: invalid argument, readlink
```

This is a Windows-specific issue with Next.js cache in OneDrive folders.

## Solution

### Option 1: Delete .next folder (Recommended)
```bash
# Stop the dev server first (Ctrl+C)

# Delete .next folder
rmdir /s /q .next

# Restart dev server
npm run dev
```

### Option 2: PowerShell Command
```powershell
# Stop the dev server first (Ctrl+C)

# Delete .next folder
Remove-Item -Recurse -Force .next

# Restart dev server
npm run dev
```

### Option 3: Manual Delete
1. Stop the dev server (Ctrl+C)
2. Go to your project folder
3. Delete the `.next` folder manually
4. Run `npm run dev` again

## Why This Happens
- OneDrive sync can lock files in the `.next` folder
- Windows symlinks behave differently than Unix
- Next.js cache gets corrupted

## Prevention
Consider moving your project outside OneDrive:
```bash
# Move to C:\Projects instead of OneDrive\Desktop
C:\Projects\IICHE PORTAL
```

## After Fixing
The dev server should start normally and all features will work.

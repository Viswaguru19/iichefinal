# Project Cleanup Instructions

## What Was Done

Created a clean project structure with:
- ✅ Main `README.md` with project overview
- ✅ `docs/troubleshooting/` with Event Progress RLS fix guide
- ✅ `scripts/database/` with the actual RLS fix SQL
- ✅ `scripts/` with cleanup scripts for both Unix and Windows

## How to Clean Up

### Option 1: Automatic Cleanup (Recommended)

#### On Windows (PowerShell):
```powershell
.\scripts\cleanup-temp-files.ps1
```

#### On Mac/Linux (Bash):
```bash
chmod +x scripts/cleanup-temp-files.sh
./scripts/cleanup-temp-files.sh
```

This will:
- Move all temporary files to a backup folder
- Keep all essential project files
- Show you what was moved

### Option 2: Manual Cleanup

Delete these file patterns from the project root:
- `CHECK_*.sql`
- `FIX_*.sql`
- `DEBUG_*.sql`
- `TEST_*.sql`
- `RUN_*.sql`
- `TEMP_*.sql`
- `*_COMPLETE.md`
- `*_FIX.md`
- `*_SUMMARY.md`
- `app/test-*.tsx`

## Files to Keep

### Essential Files (Root)
- `README.md` - Main project documentation
- `.env.local` - Environment variables
- `.env.local.example` - Environment template
- `.gitignore` - Git ignore rules
- `.vercelignore` - Vercel ignore rules
- `next.config.js` - Next.js configuration
- `package.json` - Dependencies
- `tsconfig.json` - TypeScript configuration

### Directories to Keep
- `app/` - All application pages (except test-*)
- `components/` - All React components
- `lib/` - Utility libraries
- `types/` - TypeScript types
- `supabase/migrations/` - Database migrations
- `docs/` - Documentation
- `scripts/` - Utility scripts
- `.kiro/specs/` - Feature specifications

## After Cleanup

Your project structure will look like:

```
project-root/
├── README.md                    # ✅ NEW: Main documentation
├── .env.local
├── .gitignore
├── next.config.js
├── package.json
├── app/                         # Application pages
├── components/                  # React components
├── lib/                        # Utilities
├── types/                      # TypeScript types
├── supabase/
│   └── migrations/             # Database migrations
├── docs/                       # ✅ NEW: Documentation
│   └── troubleshooting/
│       └── event-progress-rls.md
├── scripts/                    # ✅ NEW: Utility scripts
│   ├── database/
│   │   └── fix-event-progress-rls.sql
│   ├── cleanup-temp-files.sh
│   └── cleanup-temp-files.ps1
└── .kiro/
    └── specs/                  # Feature specifications
```

## Backup

The cleanup scripts create a backup folder with timestamp:
```
backup_temp_files_YYYYMMDD_HHMMSS/
```

To restore files if needed:
```bash
# Unix/Mac
mv backup_temp_files_*/* .

# Windows PowerShell
Move-Item backup_temp_files_*\* .
```

To delete backup:
```bash
# Unix/Mac
rm -rf backup_temp_files_*

# Windows PowerShell
Remove-Item -Recurse -Force backup_temp_files_*
```

## What Gets Removed

### SQL Files (~100 files)
All temporary diagnostic and fix SQL files created during troubleshooting.

### Markdown Files (~80 files)
All temporary documentation, summaries, and fix guides.

### Test Files (~10 files)
All test pages in `app/test-*.tsx`

### Other Files
- HTML test files
- CSV data files
- Temporary configuration files

## Total Cleanup

- **Before**: ~250 files in root
- **After**: ~20 files in root
- **Removed**: ~230 temporary files (backed up)

## Important Notes

1. **Backup is created automatically** - Files are moved, not deleted
2. **Essential files are preserved** - All core application files remain
3. **Migrations are kept** - All database migrations in `supabase/migrations/` stay
4. **Specs are kept** - All feature specifications in `.kiro/specs/` stay

## Next Steps

1. Run the cleanup script
2. Verify the backup was created
3. Test the application still works
4. If everything works, delete the backup folder
5. Commit the cleaned-up project to git

## Need Help?

- See `README.md` for project overview
- See `docs/troubleshooting/event-progress-rls.md` for the RLS fix
- Run `scripts/database/fix-event-progress-rls.sql` to fix Event Progress issue

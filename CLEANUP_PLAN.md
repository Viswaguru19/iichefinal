# Project Cleanup & Restructuring Plan

## Current Issue
The project root has 200+ temporary fix/debug files that should be organized or removed.

## Files to Keep (Essential)

### Core Application Files
- `app/**/*.tsx` - All application pages (KEEP)
- `components/**/*.tsx` - All React components (KEEP)
- `lib/**/*.ts` - Utility libraries (KEEP)
- `types/**/*.ts` - TypeScript types (KEEP)
- `supabase/migrations/**/*.sql` - Database migrations (KEEP)
- `.env.local` - Environment variables (KEEP)
- `next.config.js` - Next.js config (KEEP)
- `package.json` - Dependencies (KEEP)

### Documentation to Keep
- `README.md` - Main project readme (CREATE NEW)
- `.kiro/specs/**/*.md` - Feature specifications (KEEP)

## Files to Remove (Temporary/Duplicate)

### Debug & Test Files (DELETE)
- All `CHECK_*.sql` files (diagnostic queries)
- All `FIX_*.sql` files (temporary fixes)
- All `DEBUG_*.sql` files
- All `TEST_*.sql` files
- All `RUN_*.sql` files
- All `*_COMPLETE.md` files (completion summaries)
- All `*_FIX.md` files (fix documentation)
- All `*_SUMMARY.md` files (session summaries)
- All `app/test-*.tsx` files (test pages)

### Specific Files to Delete
```
CHECK_SUPABASE_STATUS.md
CHECK_EVENT_STATUS_ISSUE.sql
CREATE_COMPLETE_TASK_SYSTEM.sql
SIMPLE_TASK_SYSTEM.sql
... (100+ similar files)
```

## Proposed New Structure

```
project-root/
├── app/                          # Next.js app directory (KEEP)
├── components/                   # React components (KEEP)
├── lib/                         # Utilities (KEEP)
├── types/                       # TypeScript types (KEEP)
├── supabase/
│   └── migrations/              # Database migrations (KEEP)
├── docs/                        # NEW: Organized documentation
│   ├── README.md               # Project overview
│   ├── setup/
│   │   ├── installation.md
│   │   └── configuration.md
│   ├── features/
│   │   ├── event-management.md
│   │   ├── task-system.md
│   │   └── approval-workflow.md
│   └── troubleshooting/
│       ├── common-issues.md
│       └── rls-policies.md
├── scripts/                     # NEW: Utility scripts
│   └── database/
│       ├── setup.sql           # Initial setup
│       └── fixes/
│           └── event-progress-rls.sql
├── .env.local
├── next.config.js
├── package.json
└── README.md
```

## Action Items

### Phase 1: Create Essential Documentation
1. Create main `README.md` with project overview
2. Create `docs/troubleshooting/event-progress-rls.md` with the RLS fix
3. Create `scripts/database/fixes/event-progress-rls.sql` with the actual fix

### Phase 2: Delete Temporary Files
Delete all files matching these patterns:
- `CHECK_*.sql`
- `FIX_*.sql`
- `DEBUG_*.sql`
- `TEST_*.sql`
- `RUN_*.sql`
- `*_COMPLETE.md`
- `*_FIX.md`
- `*_SUMMARY.md`
- `TEMP_*.sql`
- `FORCE_*.sql`
- `ULTIMATE_*.sql`
- `app/test-*.tsx`

### Phase 3: Organize Remaining Files
- Move `.kiro/specs/` to `docs/specs/`
- Keep only essential migrations in `supabase/migrations/`
- Remove duplicate or superseded migrations

## Estimated Cleanup

- **Current**: ~250 files in root
- **After cleanup**: ~20 files in root
- **Files to delete**: ~200+
- **Files to keep**: ~50 (organized in proper directories)

## Next Steps

Would you like me to:
1. Create the essential documentation files?
2. Create a script to delete all temporary files?
3. Reorganize the remaining files into the new structure?

Please confirm and I'll proceed with the cleanup.

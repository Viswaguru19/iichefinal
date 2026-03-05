#!/bin/bash

# ============================================
# Cleanup Script - Remove Temporary Files
# ============================================
# This script removes all temporary debug/fix files
# created during development and troubleshooting
# ============================================

echo "🧹 Starting cleanup of temporary files..."
echo ""

# Count files before cleanup
BEFORE_COUNT=$(find . -maxdepth 1 -type f | wc -l)
echo "📊 Files in root before cleanup: $BEFORE_COUNT"
echo ""

# Create backup directory
BACKUP_DIR="backup_temp_files_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "📦 Creating backup in: $BACKUP_DIR"
echo ""

# Function to move files matching pattern
move_files() {
    pattern=$1
    description=$2
    count=$(find . -maxdepth 1 -name "$pattern" -type f | wc -l)
    if [ $count -gt 0 ]; then
        echo "Moving $count $description files..."
        find . -maxdepth 1 -name "$pattern" -type f -exec mv {} "$BACKUP_DIR/" \;
    fi
}

# Move all temporary SQL files
echo "🗄️  Moving SQL files..."
move_files "CHECK_*.sql" "CHECK"
move_files "FIX_*.sql" "FIX"
move_files "DEBUG_*.sql" "DEBUG"
move_files "TEST_*.sql" "TEST"
move_files "RUN_*.sql" "RUN"
move_files "TEMP_*.sql" "TEMP"
move_files "FORCE_*.sql" "FORCE"
move_files "ULTIMATE_*.sql" "ULTIMATE"
move_files "ADD_*.sql" "ADD"
move_files "CREATE_*.sql" "CREATE"
move_files "IMPLEMENT_*.sql" "IMPLEMENT"
move_files "ENABLE_*.sql" "ENABLE"
move_files "COMPLETE_*.sql" "COMPLETE"
move_files "SIMPLE_*.sql" "SIMPLE"
move_files "WORK_*.sql" "WORK"
move_files "USE_*.sql" "USE"
move_files "UPDATE_*.sql" "UPDATE"
move_files "VERIFY_*.sql" "VERIFY"
move_files "SHOW_*.sql" "SHOW"
move_files "REMOVE_*.sql" "REMOVE"
move_files "STEP*.sql" "STEP"
move_files "MINIMAL_*.sql" "MINIMAL"
move_files "COPY_*.sql" "COPY"
move_files "FINAL_*.sql" "FINAL"
move_files "QUICK_*.sql" "QUICK"

echo ""
echo "📝 Moving Markdown documentation files..."
move_files "*_COMPLETE.md" "COMPLETE"
move_files "*_FIX.md" "FIX"
move_files "*_SUMMARY.md" "SUMMARY"
move_files "*_STATUS.md" "STATUS"
move_files "*_GUIDE.md" "GUIDE (except main)"
move_files "CHECK_*.md" "CHECK"
move_files "FIX_*.md" "FIX"
move_files "DEBUG_*.md" "DEBUG"
move_files "RUN_*.md" "RUN"
move_files "START_*.md" "START"
move_files "SEE_*.md" "SEE"
move_files "CURRENT_*.md" "CURRENT"
move_files "FINAL_*.md" "FINAL"
move_files "QUICK_*.md" "QUICK"
move_files "ULTRA_*.md" "ULTRA"
move_files "EVERYTHING_*.md" "EVERYTHING"
move_files "ALL_*.md" "ALL"
move_files "COMPLETE_*.md" "COMPLETE"
move_files "ENHANCED_*.md" "ENHANCED"
move_files "IMPLEMENTATION_*.md" "IMPLEMENTATION"
move_files "VERIFICATION_*.md" "VERIFICATION"
move_files "NOTIFICATION_*.md" "NOTIFICATION"
move_files "TASK_*.md" "TASK"
move_files "COMMITTEES_*.md" "COMMITTEES"
move_files "SESSION_*.md" "SESSION"
move_files "EVENT_*.md" "EVENT"
move_files "ADMIN_*.md" "ADMIN"
move_files "PROPOSALS_*.md" "PROPOSALS"
move_files "KICKOFF_*.md" "KICKOFF"
move_files "SLIDESHOW_*.md" "SLIDESHOW"
move_files "UPCOMING_*.md" "UPCOMING"
move_files "SLIDESHOW_*.md" "SLIDESHOW"
move_files "FORMS_*.md" "FORMS"
move_files "FORM_*.md" "FORM"
move_files "LOGO_*.md" "LOGO"
move_files "CHAT_*.md" "CHAT"
move_files "HOMEPAGE_*.md" "HOMEPAGE"
move_files "APPROVAL_*.md" "APPROVAL"
move_files "PROFILE_*.md" "PROFILE"
move_files "EVENTS_*.md" "EVENTS"
move_files "WORKFLOW_*.md" "WORKFLOW"
move_files "PHASE_*.md" "PHASE"
move_files "RESTORE_*.md" "RESTORE"
move_files "LOGIN_*.md" "LOGIN"
move_files "SUPABASE_*.md" "SUPABASE"
move_files "ONEDRIVE_*.md" "ONEDRIVE"
move_files "DASHBOARD_*.md" "DASHBOARD"
move_files "FIXES_*.md" "FIXES"
move_files "IMMEDIATE_*.md" "IMMEDIATE"
move_files "CRITICAL_*.md" "CRITICAL"
move_files "PREMIUM_*.md" "PREMIUM"
move_files "NOTION_*.md" "NOTION"
move_files "GET_*.md" "GET"
move_files "HOW_*.md" "HOW"
move_files "ISSUE_*.md" "ISSUE"
move_files "CLEANUP_*.md" "CLEANUP"

echo ""
echo "🧪 Moving test files..."
find ./app -name "test-*.tsx" -type f -exec mv {} "$BACKUP_DIR/" \;

echo ""
echo "🗑️  Moving other temporary files..."
move_files "*.html" "HTML test"
move_files "2025-2026-members.csv" "CSV"

# Keep these important files
echo ""
echo "✅ Keeping essential files:"
echo "  - README.md"
echo "  - .env.local"
echo "  - .env.local.example"
echo "  - .gitignore"
echo "  - .vercelignore"
echo "  - next.config.js"
echo "  - package.json"
echo "  - All app/ files (except test-*)"
echo "  - All components/ files"
echo "  - All lib/ files"
echo "  - All types/ files"
echo "  - All supabase/migrations/ files"
echo "  - All docs/ files"
echo "  - All scripts/ files"

# Count files after cleanup
echo ""
AFTER_COUNT=$(find . -maxdepth 1 -type f | wc -l)
MOVED_COUNT=$((BEFORE_COUNT - AFTER_COUNT))
echo "📊 Files in root after cleanup: $AFTER_COUNT"
echo "📦 Files moved to backup: $MOVED_COUNT"
echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📁 Backup location: $BACKUP_DIR"
echo "💡 To restore files: mv $BACKUP_DIR/* ."
echo "🗑️  To delete backup: rm -rf $BACKUP_DIR"

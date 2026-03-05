# ============================================
# Cleanup Script - Remove Temporary Files (PowerShell)
# ============================================
# This script removes all temporary debug/fix files
# created during development and troubleshooting
# ============================================

Write-Host "🧹 Starting cleanup of temporary files..." -ForegroundColor Cyan
Write-Host ""

# Count files before cleanup
$beforeCount = (Get-ChildItem -Path . -File | Measure-Object).Count
Write-Host "📊 Files in root before cleanup: $beforeCount" -ForegroundColor Yellow
Write-Host ""

# Create backup directory
$backupDir = "backup_temp_files_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Write-Host "📦 Creating backup in: $backupDir" -ForegroundColor Green
Write-Host ""

# Function to move files matching pattern
function Move-TempFiles {
    param(
        [string]$Pattern,
        [string]$Description
    )
    
    $files = Get-ChildItem -Path . -Filter $Pattern -File
    if ($files.Count -gt 0) {
        Write-Host "Moving $($files.Count) $Description files..." -ForegroundColor Gray
        $files | Move-Item -Destination $backupDir -Force
    }
}

# Move all temporary SQL files
Write-Host "🗄️  Moving SQL files..." -ForegroundColor Cyan
Move-TempFiles "CHECK_*.sql" "CHECK"
Move-TempFiles "FIX_*.sql" "FIX"
Move-TempFiles "DEBUG_*.sql" "DEBUG"
Move-TempFiles "TEST_*.sql" "TEST"
Move-TempFiles "RUN_*.sql" "RUN"
Move-TempFiles "TEMP_*.sql" "TEMP"
Move-TempFiles "FORCE_*.sql" "FORCE"
Move-TempFiles "ULTIMATE_*.sql" "ULTIMATE"
Move-TempFiles "ADD_*.sql" "ADD"
Move-TempFiles "CREATE_*.sql" "CREATE"
Move-TempFiles "IMPLEMENT_*.sql" "IMPLEMENT"
Move-TempFiles "ENABLE_*.sql" "ENABLE"
Move-TempFiles "COMPLETE_*.sql" "COMPLETE"
Move-TempFiles "SIMPLE_*.sql" "SIMPLE"
Move-TempFiles "WORK_*.sql" "WORK"
Move-TempFiles "USE_*.sql" "USE"
Move-TempFiles "UPDATE_*.sql" "UPDATE"
Move-TempFiles "VERIFY_*.sql" "VERIFY"
Move-TempFiles "SHOW_*.sql" "SHOW"
Move-TempFiles "REMOVE_*.sql" "REMOVE"
Move-TempFiles "STEP*.sql" "STEP"
Move-TempFiles "MINIMAL_*.sql" "MINIMAL"
Move-TempFiles "COPY_*.sql" "COPY"
Move-TempFiles "FINAL_*.sql" "FINAL"
Move-TempFiles "QUICK_*.sql" "QUICK"

Write-Host ""
Write-Host "📝 Moving Markdown documentation files..." -ForegroundColor Cyan
Move-TempFiles "*_COMPLETE.md" "COMPLETE"
Move-TempFiles "*_FIX.md" "FIX"
Move-TempFiles "*_SUMMARY.md" "SUMMARY"
Move-TempFiles "*_STATUS.md" "STATUS"
Move-TempFiles "CHECK_*.md" "CHECK"
Move-TempFiles "FIX_*.md" "FIX"
Move-TempFiles "DEBUG_*.md" "DEBUG"
Move-TempFiles "START_*.md" "START"
Move-TempFiles "SEE_*.md" "SEE"
Move-TempFiles "CURRENT_*.md" "CURRENT"
Move-TempFiles "FINAL_*.md" "FINAL"
Move-TempFiles "QUICK_*.md" "QUICK"
Move-TempFiles "ULTRA_*.md" "ULTRA"
Move-TempFiles "EVERYTHING_*.md" "EVERYTHING"
Move-TempFiles "ALL_*.md" "ALL"
Move-TempFiles "COMPLETE_*.md" "COMPLETE"
Move-TempFiles "ENHANCED_*.md" "ENHANCED"
Move-TempFiles "IMPLEMENTATION_*.md" "IMPLEMENTATION"
Move-TempFiles "VERIFICATION_*.md" "VERIFICATION"
Move-TempFiles "NOTIFICATION_*.md" "NOTIFICATION"
Move-TempFiles "TASK_*.md" "TASK"
Move-TempFiles "COMMITTEES_*.md" "COMMITTEES"
Move-TempFiles "SESSION_*.md" "SESSION"
Move-TempFiles "EVENT_*.md" "EVENT"
Move-TempFiles "ADMIN_*.md" "ADMIN"
Move-TempFiles "PROPOSALS_*.md" "PROPOSALS"
Move-TempFiles "KICKOFF_*.md" "KICKOFF"
Move-TempFiles "SLIDESHOW_*.md" "SLIDESHOW"
Move-TempFiles "UPCOMING_*.md" "UPCOMING"
Move-TempFiles "FORMS_*.md" "FORMS"
Move-TempFiles "FORM_*.md" "FORM"
Move-TempFiles "LOGO_*.md" "LOGO"
Move-TempFiles "CHAT_*.md" "CHAT"
Move-TempFiles "HOMEPAGE_*.md" "HOMEPAGE"
Move-TempFiles "APPROVAL_*.md" "APPROVAL"
Move-TempFiles "PROFILE_*.md" "PROFILE"
Move-TempFiles "EVENTS_*.md" "EVENTS"
Move-TempFiles "WORKFLOW_*.md" "WORKFLOW"
Move-TempFiles "PHASE_*.md" "PHASE"
Move-TempFiles "RESTORE_*.md" "RESTORE"
Move-TempFiles "LOGIN_*.md" "LOGIN"
Move-TempFiles "SUPABASE_*.md" "SUPABASE"
Move-TempFiles "ONEDRIVE_*.md" "ONEDRIVE"
Move-TempFiles "DASHBOARD_*.md" "DASHBOARD"
Move-TempFiles "FIXES_*.md" "FIXES"
Move-TempFiles "IMMEDIATE_*.md" "IMMEDIATE"
Move-TempFiles "CRITICAL_*.md" "CRITICAL"
Move-TempFiles "PREMIUM_*.md" "PREMIUM"
Move-TempFiles "NOTION_*.md" "NOTION"
Move-TempFiles "GET_*.md" "GET"
Move-TempFiles "HOW_*.md" "HOW"
Move-TempFiles "ISSUE_*.md" "ISSUE"
Move-TempFiles "CLEANUP_*.md" "CLEANUP"
Move-TempFiles "RUN_*.md" "RUN"

Write-Host ""
Write-Host "🧪 Moving test files..." -ForegroundColor Cyan
Get-ChildItem -Path ./app -Filter "test-*.tsx" -Recurse -File | Move-Item -Destination $backupDir -Force

Write-Host ""
Write-Host "🗑️  Moving other temporary files..." -ForegroundColor Cyan
Move-TempFiles "*.html" "HTML test"
Move-TempFiles "2025-2026-members.csv" "CSV"

# Keep these important files
Write-Host ""
Write-Host "✅ Keeping essential files:" -ForegroundColor Green
Write-Host "  - README.md"
Write-Host "  - .env.local"
Write-Host "  - .env.local.example"
Write-Host "  - .gitignore"
Write-Host "  - .vercelignore"
Write-Host "  - next.config.js"
Write-Host "  - package.json"
Write-Host "  - All app/ files (except test-*)"
Write-Host "  - All components/ files"
Write-Host "  - All lib/ files"
Write-Host "  - All types/ files"
Write-Host "  - All supabase/migrations/ files"
Write-Host "  - All docs/ files"
Write-Host "  - All scripts/ files"

# Count files after cleanup
Write-Host ""
$afterCount = (Get-ChildItem -Path . -File | Measure-Object).Count
$movedCount = $beforeCount - $afterCount
Write-Host "📊 Files in root after cleanup: $afterCount" -ForegroundColor Yellow
Write-Host "📦 Files moved to backup: $movedCount" -ForegroundColor Yellow
Write-Host ""
Write-Host "✅ Cleanup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📁 Backup location: $backupDir" -ForegroundColor Cyan
Write-Host "💡 To restore files: Move-Item $backupDir\* ." -ForegroundColor Gray
Write-Host "🗑️  To delete backup: Remove-Item -Recurse -Force $backupDir" -ForegroundColor Gray

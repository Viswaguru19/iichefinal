@echo off
echo ========================================
echo Fixing Next.js Cache Issue
echo ========================================
echo.
echo This will delete the .next folder and restart the dev server.
echo.
pause

echo Deleting .next folder...
if exist .next (
    rmdir /s /q .next
    echo .next folder deleted successfully!
) else (
    echo .next folder not found (already deleted?)
)

echo.
echo ========================================
echo Cache cleared!
echo ========================================
echo.
echo Now run: npm run dev
echo.
pause

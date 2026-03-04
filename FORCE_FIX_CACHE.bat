@echo off
echo ========================================
echo FORCE FIX - Next.js Cache Issue
echo ========================================
echo.
echo This will forcefully delete the .next folder
echo.

REM Kill any node processes
echo Killing any running Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

REM Try multiple methods to delete .next
echo.
echo Attempting to delete .next folder...
echo.

REM Method 1: Standard delete
if exist .next (
    echo Method 1: Standard delete...
    rmdir /s /q .next 2>nul
)

REM Method 2: Force delete with attrib
if exist .next (
    echo Method 2: Removing attributes...
    attrib -r -s -h .next\*.* /s /d 2>nul
    rmdir /s /q .next 2>nul
)

REM Method 3: Delete via PowerShell
if exist .next (
    echo Method 3: PowerShell delete...
    powershell -Command "Remove-Item -Path '.next' -Recurse -Force -ErrorAction SilentlyContinue" 2>nul
)

REM Check if deleted
if exist .next (
    echo.
    echo ========================================
    echo WARNING: Could not delete .next folder
    echo ========================================
    echo.
    echo Please try these manual steps:
    echo 1. Close OneDrive
    echo 2. Close VS Code / any editors
    echo 3. Delete .next folder manually
    echo 4. Restart OneDrive
    echo.
    echo OR move project outside OneDrive:
    echo   Move to: C:\Projects\IICHE PORTAL
    echo.
) else (
    echo.
    echo ========================================
    echo SUCCESS! .next folder deleted
    echo ========================================
    echo.
    echo Now you can run: npm run dev
    echo.
)

pause

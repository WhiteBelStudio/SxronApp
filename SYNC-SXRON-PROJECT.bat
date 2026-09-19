@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title SXRON Project Sync 1.3.7
echo ================================================
echo        SXRON PROJECT SYNC 1.3.7
echo ================================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git is not installed or not available in PATH.
  echo Install Git and run this file again.
  pause
  exit /b 1
)

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
  echo [ERROR] This folder is not a Git repository.
  echo Open the SXRON project folder containing .git and run this file there.
  pause
  exit /b 1
)

for /f "delims=" %%A in ('git branch --show-current') do set "BRANCH=%%A"
if /I not "%BRANCH%"=="main" (
  echo [ERROR] Current branch is "%BRANCH%". Refusing to overwrite another branch.
  echo Switch to main first.
  pause
  exit /b 1
)

git diff --quiet
if errorlevel 1 (
  echo [ERROR] Local changes are present. Nothing was overwritten.
  echo Commit or stash your changes, then run this file again.
  pause
  exit /b 1
)

git fetch origin main
if errorlevel 1 (
  echo [ERROR] Could not fetch GitHub.
  pause
  exit /b 1
)

git merge --ff-only origin/main
if errorlevel 1 (
  echo [ERROR] Fast-forward update failed. The local project and GitHub have diverged.
  echo No files were forcefully overwritten.
  pause
  exit /b 1
)

echo.
echo [OK] Local SXRON project is now synchronized with origin/main.
echo [OK] Current commit:
git rev-parse --short HEAD
echo.
pause

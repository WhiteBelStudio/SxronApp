@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title SXRON Marketplace 1.4.4

echo ================================================
echo        SXRON MARKETPLACE 1.4.4
echo        One-click Windows launcher
echo ================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :install_node
where npm >nul 2>nul
if errorlevel 1 goto :install_node

goto :check_python

:install_node
echo [SXRON] Node.js LTS is required. Trying to install it with winget...
where winget >nul 2>nul
if errorlevel 1 goto :missing_node
winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
if errorlevel 1 goto :missing_node

echo [SXRON] Node.js installed. Restarting launcher so Windows refreshes PATH...
start "SXRON Launcher" cmd /c ""%~f0""
exit /b 0

:missing_node
echo.
echo [ERROR] Node.js/npm are unavailable and winget could not install them.
echo Install Node.js LTS from https://nodejs.org/ and run this file again.
pause
exit /b 1

:check_python
where python >nul 2>nul
if errorlevel 1 goto :install_python

goto :install_dependencies

:install_python
echo [SXRON] Python 3.12+ is required. Trying to install it with winget...
where winget >nul 2>nul
if errorlevel 1 goto :missing_python
winget install --id Python.Python.3.12 -e --accept-package-agreements --accept-source-agreements
if errorlevel 1 goto :missing_python

echo [SXRON] Python installed. Restarting launcher so Windows refreshes PATH...
start "SXRON Launcher" cmd /c ""%~f0""
exit /b 0

:missing_python
echo.
echo [ERROR] Python is unavailable and winget could not install it.
echo Install Python 3.12+ from https://www.python.org/ and run this file again.
pause
exit /b 1

:install_dependencies
echo.
echo [1/4] Installing frontend dependencies...
call npm install
if errorlevel 1 goto :npm_error

echo.
echo [2/4] Installing backend dependencies...
python -m pip install -r requirements.txt
if errorlevel 1 goto :python_error

echo.
echo [3/4] Checking SXRON project files...
if not exist server\main.py goto :project_error
if not exist vite.config.ts goto :project_error
if not exist package.json goto :project_error

echo.
echo [4/4] Starting SXRON Marketplace 1.4.4...
echo.
echo Frontend: http://127.0.0.1:5173
echo API:      http://127.0.0.1:8000
echo.
echo Keep this window open while the development app is running.
echo Close the Electron window and this console when you want to stop it.
echo.
call npm run app:dev

if errorlevel 1 goto :runtime_error
exit /b 0

:npm_error
echo.
echo [ERROR] npm install failed.
pause
exit /b 1

:python_error
echo.
echo [ERROR] Python dependencies could not be installed.
pause
exit /b 1

:project_error
echo.
echo [ERROR] The SXRON project files are incomplete.
pause
exit /b 1

:runtime_error
echo.
echo [ERROR] SXRON stopped with an error. The message above contains the exact reason.
pause
exit /b 1

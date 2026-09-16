@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title SXRON Marketplace 1.0.5

echo ================================================
echo        SXRON MARKETPLACE 1.0.5
echo        Local PC launcher
 echo ================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :install_node

where npm >nul 2>nul
if errorlevel 1 goto :install_node

goto :check_python

:install_node
echo [SXRON] Node.js is not installed. Trying to install Node.js LTS with winget...
where winget >nul 2>nul
if errorlevel 1 goto :missing_node
winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
if errorlevel 1 goto :missing_node
call refreshenv >nul 2>nul
where node >nul 2>nul
if errorlevel 1 goto :missing_node
where npm >nul 2>nul
if errorlevel 1 goto :missing_node

goto :check_python

:missing_node
echo.
echo [ERROR] Node.js/npm are unavailable.
echo Install Node.js LTS from https://nodejs.org/ and run this file again.
pause
exit /b 1

:check_python
where python >nul 2>nul
if errorlevel 1 goto :install_python

goto :install_dependencies

:install_python
echo [SXRON] Python is not installed. Trying to install Python 3.12 with winget...
where winget >nul 2>nul
if errorlevel 1 goto :missing_python
winget install --id Python.Python.3.12 -e --accept-package-agreements --accept-source-agreements
if errorlevel 1 goto :missing_python
call refreshenv >nul 2>nul
where python >nul 2>nul
if errorlevel 1 goto :missing_python

goto :install_dependencies

:missing_python
echo.
echo [ERROR] Python is unavailable.
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
echo [3/4] Checking the local API and frontend configuration...
if not exist server\main.py goto :project_error
if not exist vite.config.ts goto :project_error
if not exist package.json goto :project_error

echo.
echo [4/4] Starting SXRON Marketplace...
echo.
echo Frontend: http://127.0.0.1:5173
echo API:      http://127.0.0.1:8000
 echo.
echo Do not close this window while SXRON is running.
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
echo [ERROR] SXRON stopped with an error.
pause
exit /b 1

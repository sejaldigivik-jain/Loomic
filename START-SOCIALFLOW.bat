@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SocialFlow Local Server
cls

echo ============================================================
echo                 SOCIALFLOW LOCAL STARTER
echo ============================================================
echo.
echo Project folder: %CD%
echo.

REM A batch file opened directly from a ZIP is commonly extracted alone to a
REM temporary folder. Detect that case before doing anything else.
if not exist "package.json" goto :not_extracted
if not exist "src" goto :not_extracted

where node >nul 2>nul
if errorlevel 1 goto :no_node

where npm >nul 2>nul
if errorlevel 1 goto :no_npm

echo [1/4] Checking Node.js...
node -e "const [a,b]=process.versions.node.split('.').map(Number); console.log('      Node.js v'+process.versions.node); process.exit(a>20||(a===20&&b>=9)?0:1)"
if errorlevel 1 goto :old_node

echo [2/4] Checking dependencies...
if not exist "node_modules\.bin\next.cmd" (
  echo       Dependencies are not installed yet.
  echo       Running npm install. The first run can take several minutes...
  echo.
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :install_error
) else (
  echo       Dependencies already installed.
)

echo.
echo [3/4] Preparing database and Prisma...
call npm run setup
if errorlevel 1 goto :setup_error

echo.
echo [4/4] Starting SocialFlow...
set "SOCIALFLOW_EMBEDDED_SCHEDULER=1"
set "SOCIALFLOW_SCHEDULER_INTERVAL_MS=5000"
echo       Scheduler: automatic - checks due posts every 5 seconds
echo.
echo ============================================================
echo  Keep this window OPEN while you use SocialFlow.
echo  The browser will open automatically at:
echo  http://localhost:3000
echo ============================================================
echo.

REM Open the browser after Next.js has had time to start.
start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 8; Start-Process 'http://localhost:3000'"

REM Run Next directly because the setup step above already performed predev.
call npm run dev:server
set "EXIT_CODE=%ERRORLEVEL%"

echo.
echo ============================================================
if "%EXIT_CODE%"=="0" (
  echo SocialFlow server stopped.
) else (
  echo SocialFlow stopped with error code %EXIT_CODE%.
  echo Read the error shown above. This window will stay open.
)
echo ============================================================
echo.
pause
exit /b %EXIT_CODE%

:not_extracted
echo ERROR: SocialFlow project files were not found beside this launcher.
echo.
echo Most likely you double-clicked START-SOCIALFLOW.bat INSIDE the ZIP file.
echo Windows cannot run the full project correctly from inside a ZIP.
echo.
echo FIX:
echo   1. Right-click the ZIP file.
echo   2. Choose "Extract All..."
echo   3. Open the extracted folder.
echo   4. Double-click START-SOCIALFLOW.bat there.
echo.
pause
exit /b 1

:no_node
echo ERROR: Node.js was not found.
echo.
echo Install Node.js 22 LTS, close this window, then run this launcher again.
echo After installing Node.js, restart Windows Terminal/Command Prompt if needed.
echo.
pause
exit /b 1

:no_npm
echo ERROR: npm was not found even though Node.js is available.
echo Reinstall Node.js 22 LTS with npm included, then try again.
echo.
pause
exit /b 1

:old_node
echo.
echo ERROR: Your Node.js version is too old for Next.js 16.
echo Install Node.js 22 LTS, then run this launcher again.
echo.
pause
exit /b 1

:install_error
echo.
echo ERROR: npm install failed.
echo The full npm error is shown above.
echo Check your internet connection and make sure antivirus/firewall is not blocking npm.
echo.
pause
exit /b 1

:setup_error
echo.
echo ERROR: SocialFlow database/Prisma setup failed.
echo The exact error is shown above.
echo.
echo You can also run FIX-LOCAL-ERRORS.bat after correcting the reported issue.
echo.
pause
exit /b 1

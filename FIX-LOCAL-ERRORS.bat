@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SocialFlow Local Repair
cls

echo ============================================================
echo                 SOCIALFLOW LOCAL REPAIR
echo ============================================================
echo.

if not exist "package.json" goto :not_extracted
where node >nul 2>nul
if errorlevel 1 goto :no_node
where npm >nul 2>nul
if errorlevel 1 goto :no_node

if not exist "node_modules\.bin\next.cmd" (
  echo Dependencies are missing. Installing them first...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :error
)

echo Clearing Next.js cache and repairing Prisma/database...
call npm run repair
if errorlevel 1 goto :error

echo.
echo Repair completed successfully.
echo Starting SocialFlow now...
echo Keep this window OPEN while you use the app.
echo.
start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 8; Start-Process 'http://localhost:3000'"
call npm run dev:server
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" echo SocialFlow stopped with error code %EXIT_CODE%. Review the error above.
pause
exit /b %EXIT_CODE%

:not_extracted
echo ERROR: Extract the complete ZIP first, then run this file from the extracted project folder.
echo.
pause
exit /b 1

:no_node
echo ERROR: Node.js/npm was not found. Install Node.js 22 LTS and try again.
echo.
pause
exit /b 1

:error
echo.
echo Repair failed. The exact error is shown above.
echo.
pause
exit /b 1

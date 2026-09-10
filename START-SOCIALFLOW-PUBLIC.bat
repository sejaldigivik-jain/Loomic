@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title SocialFlow One-Click Public OAuth Test
cls

echo ============================================================
echo          SOCIALFLOW - ONE CLICK PUBLIC STARTER
echo ============================================================
echo.

if not exist "package.json" goto :not_extracted
if not exist "src" goto :not_extracted
where node >nul 2>nul || goto :no_node
where npm >nul 2>nul || goto :no_npm

echo [1/5] Checking dependencies...
if not exist "node_modules\.bin\next.cmd" (
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :failed
) else (
  echo       Dependencies already installed.
)

echo.
echo [2/5] Preparing database...
call npm run setup
if errorlevel 1 goto :failed

echo.
echo [3/5] Creating temporary HTTPS address...
del /q ".socialflow-public-url.txt" >nul 2>nul
del /q ".socialflow-cloudflared.pid" >nul 2>nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\start-public-tunnel.ps1"
if errorlevel 1 goto :failed

set "PUBLIC_URL="
set /p PUBLIC_URL=<".socialflow-public-url.txt"
if not defined PUBLIC_URL goto :failed
set "NEXT_PUBLIC_APP_URL=%PUBLIC_URL%"
set "SOCIALFLOW_PUBLIC_TUNNEL=1"
set "SOCIALFLOW_EMBEDDED_SCHEDULER=1"
set "SOCIALFLOW_SCHEDULER_INTERVAL_MS=5000"
set "INSTAGRAM_REDIRECT_URI=%PUBLIC_URL%/api/oauth/instagram/callback"

echo.
echo [4/5] Public OAuth callback ready.
echo.
echo ============================================================
echo  ONE UNAVOIDABLE META STEP
echo ============================================================
echo  In Meta Developer Dashboard, paste this Redirect URL once:
echo.
echo  %INSTAGRAM_REDIRECT_URI%
echo.
echo  It is already copied to your clipboard.
echo ============================================================
echo.

echo [5/5] Starting SocialFlow...
echo       App: http://localhost:3000
echo       Public media/OAuth bridge: %PUBLIC_URL%
echo       Scheduler: automatic - checks due posts every 5 seconds
echo.
start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 8; Start-Process 'http://localhost:3000'"
call npm run dev:server
set "EXIT_CODE=%ERRORLEVEL%"

echo.
echo Stopping temporary tunnel...
if exist ".socialflow-cloudflared.pid" (
  set /p TUNNEL_PID=<".socialflow-cloudflared.pid"
  if defined TUNNEL_PID taskkill /PID !TUNNEL_PID! /T /F >nul 2>nul
)
echo.
echo SocialFlow stopped.
pause
exit /b %EXIT_CODE%

:not_extracted
echo ERROR: Extract the ZIP first, then run this file from the project folder.
pause
exit /b 1

:no_node
echo ERROR: Node.js is not installed or not available in PATH.
pause
exit /b 1

:no_npm
echo ERROR: npm is not available in PATH.
pause
exit /b 1

:failed
echo.
echo ERROR: One-click startup failed. The exact error is shown above.
pause
exit /b 1

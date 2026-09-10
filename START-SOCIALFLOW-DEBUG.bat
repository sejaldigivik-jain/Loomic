@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SocialFlow Debug Launcher
cls

echo SOCIALFLOW DEBUG START
echo ======================
echo Folder: %CD%
echo Date: %DATE% %TIME%
echo.

echo package.json:
if exist package.json (echo   FOUND) else (echo   MISSING)
echo.

echo Node:
where node
node --version
echo.
echo npm:
where npm
npm --version
echo.
echo Running normal launcher now...
echo.
call "%~dp0START-SOCIALFLOW.bat"
echo.
echo Debug launcher finished. Press any key to close.
pause >nul

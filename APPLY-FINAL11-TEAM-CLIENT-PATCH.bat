@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================================
echo SocialFlow Final11 - Team + Client Workspace Patch
echo P3005 Existing Database Baseline Fix
echo ============================================================
echo.

if not exist package.json (
  echo ERROR: This fix must be extracted into the MAIN SocialFlow Final11 folder.
  echo package.json was not found here.
  echo.
  pause
  exit /b 1
)

if not exist prisma\schema.prisma (
  echo ERROR: prisma\schema.prisma was not found.
  echo Extract this ZIP into your main Final11 folder and choose Replace files.
  echo.
  pause
  exit /b 1
)

if not exist prisma\migrations\20260825130000_final11_existing_database_baseline\migration.sql (
  echo ERROR: Final11 baseline migration file is missing.
  echo Please extract the full P3005 fix ZIP again.
  echo.
  pause
  exit /b 1
)

if not exist prisma\migrations\20260825132500_agency_team_client_management\migration.sql (
  echo ERROR: Team + Client migration is missing.
  echo First extract the Final11 Team + Client patch, then extract this P3005 fix.
  echo.
  pause
  exit /b 1
)

if exist db\custom.db if not exist db\custom.db.before-team-client-patch.bak (
  echo Creating one-time database backup...
  copy /Y db\custom.db db\custom.db.before-team-client-patch.bak >nul
  if errorlevel 1 goto :fail
)

echo [1/4] Baselining your EXISTING Final11 database for Prisma Migrate...
echo       This does NOT delete, reset, or recreate your database.
call npx prisma migrate resolve --applied 20260825130000_final11_existing_database_baseline
if errorlevel 1 goto :baseline_fail

echo.
echo [2/4] Applying the additive Team + Client migration...
call npx prisma migrate deploy
if errorlevel 1 goto :fail

echo.
echo [3/4] Regenerating Prisma Client...
call npx prisma generate
if errorlevel 1 goto :fail

echo.
echo [4/4] Clearing old Next.js build cache...
if exist .next rmdir /S /Q .next

echo.
echo ============================================================
echo PATCH APPLIED SUCCESSFULLY
echo ============================================================
echo Your existing database, Instagram tokens, .env and uploads were preserved.
echo Now start SocialFlow using RUN-SOCIALFLOW.bat.
echo.
pause
exit /b 0

:baseline_fail
echo.
echo Baseline command failed.
echo If the message says the baseline migration is ALREADY APPLIED,
echo run this command manually next:
echo.
echo     npx prisma migrate deploy
echo.
echo Then run:
echo.
echo     npx prisma generate
echo.
echo Do NOT run prisma migrate reset.
echo.
goto :fail_noexit

:fail
echo.
:fail_noexit
echo PATCH SETUP STOPPED because a command failed.
echo Your original database was not intentionally reset or replaced.
echo If db\custom.db exists, the one-time backup is:
echo     db\custom.db.before-team-client-patch.bak
echo.
echo Do NOT run prisma migrate reset.
echo Take a screenshot of this window if another error appears.
echo.
pause
exit /b 1

@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================================
echo SocialFlow Final11 - P3018 Recovery + Account Lock
echo ============================================================
echo.
echo This fixes the failed AccountAssignment migration WITHOUT reset.
echo Existing users, accounts, Instagram tokens, posts and uploads are preserved.
echo.

if not exist package.json (
  echo ERROR: Extract this ZIP directly into the MAIN Final11 folder.
  echo package.json was not found in: %CD%
echo.
  pause
  exit /b 1
)

if not exist prisma\schema.prisma (
  echo ERROR: prisma\schema.prisma was not found.
  pause
  exit /b 1
)

if not exist prisma\migrations\20260825174600_account_client_assignments\migration.sql (
  echo ERROR: AccountAssignment migration folder is missing.
  pause
  exit /b 1
)

if not exist prisma\migrations\20260826120000_account_connection_lock\migration.sql (
  echo ERROR: Account Connection Lock migration folder is missing.
  pause
  exit /b 1
)

if not exist scripts\repair-account-assignment.sql (
  echo ERROR: recovery SQL file is missing.
  pause
  exit /b 1
)

if exist db\custom.db if not exist db\custom.db.before-p3018-lock-recovery.bak (
  echo Creating one-time database backup...
  copy /Y db\custom.db db\custom.db.before-p3018-lock-recovery.bak >nul
  if errorlevel 1 goto :fail
)

echo [1/5] Verifying/repairing the existing AccountAssignment table...
call npx prisma db execute --file scripts\repair-account-assignment.sql --schema prisma\schema.prisma
if errorlevel 1 goto :fail

echo.
echo [2/5] Recovering Prisma migration history for AccountAssignment...
call npx prisma migrate resolve --applied 20260825174600_account_client_assignments
if errorlevel 1 (
echo.
  echo Prisma resolve returned a non-zero code.
  echo This can happen if the migration is already recorded as applied.
  echo Continuing to deployment check...
)

echo.
echo [3/5] Applying remaining migration(s), including Account Connection Lock...
call npx prisma migrate deploy
if errorlevel 1 goto :fail

echo.
echo [4/5] Regenerating Prisma Client...
call npx prisma generate
if errorlevel 1 goto :fail

echo.
echo [5/5] Clearing old Next.js cache...
if exist .next rmdir /S /Q .next

echo.
echo ============================================================
echo RECOVERY + ACCOUNT LOCK PATCH APPLIED SUCCESSFULLY
echo ============================================================
echo.
echo Your existing AccountAssignment table was kept.
echo Prisma migration history was recovered.
echo Account Connection Lock migration is now deployed.
echo.
echo Next:
echo   1. Run RUN-SOCIALFLOW.bat
echo   2. Open Accounts
echo   3. Click Connect account / Add another
echo   4. Set your permanent connection password once
echo.
echo DO NOT run prisma migrate reset.
echo.
pause
exit /b 0

:fail
echo.
echo ============================================================
echo RECOVERY STOPPED because a command failed.
echo ============================================================
echo.
echo DO NOT run prisma migrate reset.
echo Your database was not intentionally reset or replaced.
echo Backup (if db\custom.db exists):
echo   db\custom.db.before-p3018-lock-recovery.bak
echo.
echo Send a screenshot of this window if another error appears.
echo.
pause
exit /b 1

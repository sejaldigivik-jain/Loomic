@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================================
echo SocialFlow Final11 - Permanent Account Connection Lock Patch
echo ============================================================
echo.

echo IMPORTANT: Stop SocialFlow before applying this patch.
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
  echo Extract the ZIP into your Final11 folder and choose Replace files.
  echo.
  pause
  exit /b 1
)

if not exist prisma\migrations\20260826120000_account_connection_lock\migration.sql (
  echo ERROR: Account connection lock migration is missing.
  echo Extract the ZIP again into the Final11 folder.
  echo.
  pause
  exit /b 1
)

if exist db\custom.db if not exist db\custom.db.before-account-connection-lock.bak (
  echo Creating one-time database backup...
  copy /Y db\custom.db db\custom.db.before-account-connection-lock.bak >nul
  if errorlevel 1 goto :fail
)

echo [1/3] Applying additive Account Connection Lock migration...
call npx prisma migrate deploy
if errorlevel 1 goto :fail

echo.
echo [2/3] Regenerating Prisma Client...
call npx prisma generate
if errorlevel 1 goto :fail

echo.
echo [3/3] Clearing old Next.js cache...
if exist .next rmdir /S /Q .next

echo.
echo ============================================================
echo PATCH APPLIED SUCCESSFULLY
echo ============================================================
echo.
echo Account connection protection is now installed.
echo.
echo First use:
echo   1. Start SocialFlow with RUN-SOCIALFLOW.bat.
echo   2. Open Accounts.
echo   3. Click Connect account or Add another.
echo   4. As Owner, set the permanent connection password once.
echo   5. The connection screen opens for one attempt only.
echo.
echo Later connections:
echo   - Enter the same permanent password.
echo   - One connection attempt is unlocked.
echo   - It automatically locks again after the attempt or when closed.
echo.
echo There is NO normal change/reset/forgot-password action for this lock.
echo Keep the password safely. Existing accounts/tokens/posts were not changed.
echo.
pause
exit /b 0

:fail
echo.
echo ============================================================
echo PATCH SETUP STOPPED because a command failed.
echo ============================================================
echo.
echo Do NOT run prisma migrate reset.
echo Your database was not intentionally reset or replaced.
echo If db\custom.db exists, the backup is:
echo   db\custom.db.before-account-connection-lock.bak
echo.
echo Take a screenshot of this window and send it if another error appears.
echo.
pause
exit /b 1

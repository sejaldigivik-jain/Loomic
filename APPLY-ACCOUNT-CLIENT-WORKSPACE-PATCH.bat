@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================================
echo SocialFlow Final11 - Account-as-Client Team Workspace Patch
echo ============================================================
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

if not exist prisma\migrations\20260825174600_account_client_assignments\migration.sql (
  echo ERROR: Account assignment migration is missing.
  echo Extract the ZIP again into the Final11 folder.
  echo.
  pause
  exit /b 1
)

if exist db\custom.db if not exist db\custom.db.before-account-client-workspace.bak (
  echo Creating one-time database backup...
  copy /Y db\custom.db db\custom.db.before-account-client-workspace.bak >nul
  if errorlevel 1 goto :fail
)

echo [1/4] Applying additive AccountAssignment migration...
call npx prisma migrate deploy
if errorlevel 1 goto :fail

echo.
echo [2/4] Regenerating Prisma Client...
call npx prisma generate
if errorlevel 1 goto :fail

echo.
echo [3/4] Removing obsolete separate-Client source from the previous patch...
if exist src\components\app\client-manager.tsx del /Q src\components\app\client-manager.tsx
if exist src\lib\client-access.ts del /Q src\lib\client-access.ts
if exist src\app\api\v1\clients rmdir /S /Q src\app\api\v1\clients
if exist src\app\api\v1\teams\members\[id]\clients rmdir /S /Q src\app\api\v1\teams\members\[id]\clients

echo.
echo [4/4] Clearing old Next.js cache...
if exist .next rmdir /S /Q .next

echo.
echo ============================================================
echo PATCH APPLIED SUCCESSFULLY
echo ============================================================
echo.
echo New workflow:
echo   - Each connected Instagram/social account is a Client.
echo   - Owner creates team-member login + role manually.
echo   - Owner assigns any number of connected accounts to that member.
echo   - Team members see only assigned accounts/posts/queue/calendar/analytics.
echo   - Owner sees everything and can filter by Team Member / Client / Platform.
echo.
echo Existing .env, SQLite data, Instagram tokens/accounts and uploads were preserved.
echo Now start SocialFlow with RUN-SOCIALFLOW.bat.
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
echo Your original database was not intentionally reset or replaced.
echo If db\custom.db exists, the backup is:
echo   db\custom.db.before-account-client-workspace.bak
echo.
echo Take a screenshot of this window and send it if another error appears.
echo.
pause
exit /b 1

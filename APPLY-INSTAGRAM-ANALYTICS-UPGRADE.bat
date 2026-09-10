@echo off
setlocal
cd /d "%~dp0"

echo =============================================================
echo SocialFlow - Instagram Analytics and Intelligence Upgrade
echo =============================================================
echo.
echo This is an additive migration. It does NOT reset your database.
echo.

echo [1/3] Applying Prisma migration...
call npx prisma migrate deploy
if errorlevel 1 (
  echo.
  echo ERROR: Prisma migration failed.
  echo DO NOT run prisma migrate reset.
  echo Copy the complete error and ask for a recovery fix.
  pause
  exit /b 1
)

echo [2/3] Regenerating Prisma Client...
call npx prisma generate
if errorlevel 1 (
  echo.
  echo ERROR: Prisma Client generation failed.
  pause
  exit /b 1
)

echo [3/3] Clearing Next.js cache...
if exist .next rmdir /s /q .next

echo.
echo Upgrade complete.
echo Start SocialFlow normally, open Analytics, select an Instagram client,
echo then click "Sync Instagram".
echo.
echo IMPORTANT: Existing Instagram accounts connected before this upgrade
 echo may need to be reconnected ONCE to grant the Insights permission.
echo This does not delete their SocialFlow posts or client assignments.
echo =============================================================
pause

@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo SocialFlow Final12 - SQLite to Supabase PostgreSQL Migration
echo ============================================================
echo.
echo Before continuing:
echo   1. Create an EMPTY Supabase project.
echo   2. Open Supabase Dashboard ^> Connect.
echo   3. Put DATABASE_URL and DIRECT_URL in this project's .env.
echo.
echo Your existing db\custom.db will NOT be deleted or modified.
echo.
pause

call npm run db:supabase:migrate
if errorlevel 1 (
  echo.
  echo Migration failed. Read the error above.
  pause
  exit /b 1
)

echo.
echo Migration completed successfully.
echo Start SocialFlow normally with npm run dev.
echo.
pause

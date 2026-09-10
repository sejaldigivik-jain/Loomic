SocialFlow Final12 - Supabase Migration Hotfix

WHY THIS HOTFIX IS NEEDED
-------------------------
The original migrate-sqlite-to-supabase.mjs contained over-escaped regular
expressions in its custom .env parser. The parent setup script could read
DIRECT_URL and successfully run `prisma db push`, but the child migration
script could not parse the .env file and incorrectly reported:

  DIRECT_URL is missing or invalid in .env.

This hotfix fixes only that migration helper.

REPLACE ONLY
------------
D:\Insta\Final12\scripts\migrate-sqlite-to-supabase.mjs

WHAT WAS FIXED
--------------
1. Correct .env line splitting: /\r?\n/
2. Correct .env KEY=VALUE matching whitespace regex
3. Correct numeric DateTime detection: /^\d+$/

NO DATABASE OR APP LOGIC CHANGES
--------------------------------
- No Prisma schema change
- No UI change
- No SocialFlow feature change
- No existing SQLite data change
- No Supabase table reset

AFTER REPLACING
---------------
1. Keep the same .env that already allowed `prisma db push` to succeed.
2. Double-click MIGRATE-TO-SUPABASE.bat again.
3. It may run `db push` again; that is safe/idempotent for the same schema.
4. It should then continue past "Copying SQLite data to Supabase...".

If a NEW error appears during row copying, stop and send the full screenshot.
Do not run prisma migrate reset.

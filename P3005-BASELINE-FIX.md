# SocialFlow Final11 — Prisma P3005 Baseline Fix

This hotfix is for the error:

`Error: P3005 — The database schema is not empty.`

Final11 already had a working SQLite database before Prisma migration history was introduced. Prisma therefore needs the existing Final11 schema to be **baselined** once before the new Team + Client migration can be deployed.

## What this fix does

1. Keeps the existing `db/custom.db` database.
2. Creates/keeps `db/custom.db.before-team-client-patch.bak` as a safety backup.
3. Marks the new `20260825130000_final11_existing_database_baseline` migration as already applied to the existing database.
4. Runs the additive `20260825132500_agency_team_client_management` migration.
5. Regenerates Prisma Client.
6. Clears `.next` so Next.js uses the regenerated Prisma Client.

## What it does NOT do

- No `prisma migrate reset`
- No database deletion
- No `.env` replacement
- No Instagram token replacement
- No upload deletion
- No reconnect of existing social accounts

## Install

Extract this ZIP directly into the main `Final11` folder and choose **Replace files in destination**.

Then run:

`APPLY-FINAL11-TEAM-CLIENT-PATCH.bat`

After success, start SocialFlow with your normal `RUN-SOCIALFLOW.bat`.

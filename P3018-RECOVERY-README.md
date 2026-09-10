# SocialFlow Final11 — P3018 Recovery + Account Connection Lock

This patch is for the specific Prisma error:

- `P3018`
- migration: `20260825174600_account_client_assignments`
- SQLite error: `table "AccountAssignment" already exists`

## What it does

1. Creates a database backup if one does not already exist.
2. Runs an idempotent SQL repair that keeps the existing `AccountAssignment` table and rows, and only creates missing indexes if necessary.
3. Uses Prisma `migrate resolve --applied` to recover the failed migration history.
4. Runs `prisma migrate deploy` so the pending Account Connection Lock migration can apply.
5. Regenerates Prisma Client and clears `.next`.

## What it does NOT do

- No `prisma migrate reset`
- No database deletion
- No table drop
- No `.env` replacement
- No Instagram token replacement
- No post/account deletion
- No upload deletion

## Install

Extract directly into the main `Final11` folder and choose **Replace files in destination**.
Then run:

`APPLY-P3018-RECOVERY-AND-ACCOUNT-LOCK.bat`

After success, run:

`RUN-SOCIALFLOW.bat`

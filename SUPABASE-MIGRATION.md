# SocialFlow Final12 — Supabase Database Conversion

This patch converts **only the database layer** from SQLite to **Supabase PostgreSQL**.

It does **not** replace SocialFlow authentication with Supabase Auth and does not change:
- UI
- Instagram connections/tokens
- publishing
- scheduler
- analytics logic
- workspaces
- teams
- permissions
- uploads
- existing application APIs

Your current SQLite file remains at `db/custom.db` as a rollback backup.

## What changes

- `prisma/schema.prisma` now uses `provider = "postgresql"`.
- Prisma uses `DATABASE_URL` for application queries.
- Prisma uses `DIRECT_URL` for CLI/schema operations.
- Normal `npm run dev` no longer runs `prisma db push` against the remote database on every startup.
- A one-time migration script copies all SocialFlow application rows from SQLite to Supabase while preserving IDs, timestamps, encrypted tokens, relationships, posts, analytics, sessions, workspaces, and assignments.

## Step 1 — Create Supabase

Create a new **empty** Supabase project.

In Supabase Dashboard choose **Connect**.

For your current local/persistent SocialFlow server, copy the **Session pooler** connection string (port `5432`).

## Step 2 — Update `.env`

Keep all your existing SocialFlow secrets exactly as they are.

Replace only the database section with:

```env
DATABASE_URL="YOUR_SUPABASE_SESSION_POOLER_5432_URL"
DIRECT_URL="YOUR_SUPABASE_SESSION_POOLER_5432_URL"
SOURCE_SQLITE_PATH="./db/custom.db"
```

Do **not** send your database password or connection string to anyone.

For a future serverless deployment, you can use Supavisor transaction mode (`6543`) for `DATABASE_URL`, while keeping `DIRECT_URL` on session/direct mode (`5432`).

## Step 3 — Run the migration

Double-click:

```text
MIGRATE-TO-SUPABASE.bat
```

or run:

```bash
npm run db:supabase:migrate
```

The command performs:

1. Prisma Client generation for PostgreSQL.
2. `prisma db push` to create the SocialFlow schema in your empty Supabase database.
3. Read-only access to `db/custom.db`.
4. Dependency-ordered data copy to Supabase.
5. Row-count verification for every SocialFlow table.

The script refuses to import when the Supabase target already contains SocialFlow rows. This prevents accidental duplication/overwriting.

## Step 4 — Start SocialFlow

```bash
npm run dev
```

SocialFlow will now use Supabase PostgreSQL.

## Source-data check only

Before connecting to Supabase you can verify the SQLite source:

```bash
npm run db:supabase:source-check
```

## Important

The existing `prisma/migrations` directory contains the historical SQLite migration history. This patch uses `prisma db push` for the database conversion and does not execute those old SQLite migrations against Supabase.

Do not run `prisma migrate reset`.

After the Supabase cutover is verified, keep `db/custom.db` somewhere safe until you are satisfied that all data is present.

## Expected Final12 source snapshot

The uploaded SQLite database currently contains SocialFlow data across tables such as:
- users and sessions
- workspaces and memberships
- connected social accounts and encrypted provider credentials
- posts, post targets and media
- Instagram account snapshots and media insights
- assignments, invitations and account connection lock state

The migration copies application tables only. `_prisma_migrations` is intentionally not copied because it belongs to the old SQLite migration history.

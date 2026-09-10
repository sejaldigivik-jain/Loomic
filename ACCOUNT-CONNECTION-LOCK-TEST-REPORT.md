# Account Connection Lock — Test Report

Tested against the uploaded Final11 source plus the current Account-as-Client Team patch.

## Database migration

The additive SQLite migration was executed on a copy of the uploaded Final11 `db/custom.db`.

Before / after row counts remained unchanged:

- User: 1 → 1
- Workspace: 1 → 1
- SocialAccount: 2 → 2
- Post: 24 → 24
- PostTarget: 28 → 28
- Membership: 1 → 1

New tables created:

- `AccountConnectionLock`
- `AccountConnectionGrant`

`PRAGMA foreign_key_check` returned no violations.

## Security-path review

The one-use unlock grant is required server-side by:

- `POST /api/v1/accounts` (direct/demo connection)
- `POST /api/v1/accounts/instagram/token-connect`
- `GET /api/v1/oauth/instagram/start`
- `GET /api/v1/oauth/[provider]/start`

The OAuth callbacks remain protected by the signed OAuth state created only after the protected start route consumes a valid grant.

## Permanent-password behaviour

- Setup route is Owner-only.
- A second setup request returns a conflict; there is no app route to change/reset/delete the password.
- Password is hashed with the existing SocialFlow PBKDF2-SHA512 password hashing utility.
- Unlock is Owner-only.
- Five recent bad passwords trigger a 15-minute lockout.
- Unlock grants are random, user/workspace-bound, expire after five minutes and are atomically deleted on first use.
- Closing the connection dialog revokes an unused grant.

## TypeScript check note

A full TypeScript pass was run on a reconstructed source tree. The uploaded Windows Prisma Client cannot be regenerated in this Linux validation environment because its Linux Prisma engine binary is not present/offline. The remaining Prisma-model type errors are therefore from the stale pre-migration generated client (and pre-existing Account-as-Client patch type warnings). The installer runs `npx prisma generate` on the user's Windows project immediately after `migrate deploy`, which regenerates those model types from the supplied schema.

No `.env`, SQLite database, uploads, provider tokens, `node_modules`, `.next`, or publishing/scheduler files are included in this patch.

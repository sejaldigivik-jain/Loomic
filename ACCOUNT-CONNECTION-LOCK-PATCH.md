# SocialFlow Final11 — Permanent Account Connection Lock

This incremental patch is for the current Final11 account-as-client/team-workspace build.

## Behaviour

- `Connect account` and `Add another` are locked.
- The **workspace Owner** sets the connection password once on first use.
- The password is stored only as a PBKDF2-SHA512 hash with a random salt.
- SocialFlow exposes no normal change, reset or forgot-password route for this lock.
- Only the workspace Owner can unlock account connection.
- A correct password creates a random **one-use, 5-minute grant** bound to that Owner and workspace.
- The grant is consumed server-side by the next account-connection attempt.
- Closing the connection dialog revokes the unused grant.
- Five incorrect passwords in the recent failure window trigger a 15-minute lockout.

## Protected connection paths

Server-side enforcement is added to:

- Direct/demo social account creation
- Instagram Meta-token connection
- Instagram OAuth start
- LinkedIn / X / Facebook / Threads / Pinterest OAuth start

OAuth callbacks can save an account only after a signed OAuth state was issued by a protected start route.

## Existing data preserved

The migration only adds `AccountConnectionLock` and `AccountConnectionGrant` tables. It does not modify existing `SocialAccount`, token, post, user, workspace or upload data.

## Install

1. Stop SocialFlow.
2. Extract the ZIP directly into the main Final11 folder and choose **Replace files in destination**.
3. Run `APPLY-ACCOUNT-CONNECTION-LOCK-PATCH.bat`.
4. Start `RUN-SOCIALFLOW.bat`.
5. Open Accounts and click **Connect account** or **Add another**.

## Password warning

The password is intentionally one-time configuration. If it is forgotten, there is no in-app recovery. A deliberate server/database administrator intervention would be required.

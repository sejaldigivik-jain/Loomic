# SocialFlow Final11 — Team Member + Client Workspace Patch

This patch was built against the exact uploaded `Final11.zip` source, completed with the uploaded `SocialFlow-part3.zip` launcher files and `public.zip` structure.

## What it adds

- One agency workspace with Owner-wide visibility.
- Any number of clients can be assigned to each team member.
- The same client can be assigned to multiple team members.
- Each team member uses their own existing SocialFlow email/password login through the current Team invitation system.
- Non-owner logins are automatically restricted to assigned clients across Accounts, Composer, Queue, Calendar, Dashboard and Analytics.
- Server-side authorization prevents a member from requesting another member's client/account/post through URL or API manipulation.
- Owner can see all clients, all accounts, all posts, Queue, Calendar, Composer, Dashboard and Analytics.
- Owner header filters: Team Member, Client and Platform.
- Owner can filter the whole app to one team member and then return to All team members.
- Client Management: create, rename, archive, assign members and attach/reassign existing social accounts.
- Newly created posts track `createdByUserId`; old posts remain compatible with `NULL` values.
- Existing unassigned accounts/posts remain visible to Owner and can be assigned later.

## Role behavior

- `owner`: unrestricted agency view and Owner filters.
- `admin`: manager-equivalent role; existing admin permissions remain, with client scope enforced.
- `editor` / `contributor`: member view restricted to assigned clients; existing publish/create permissions remain.
- `viewer`: existing read-only permission behavior plus assigned-client scope.

The Owner is determined by the existing workspace `owner` role; the code does not hard-code a person's name.

## Install

1. Stop SocialFlow.
2. Extract this ZIP into the main SocialFlow project folder.
3. Choose **Replace files in destination**.
4. Double-click `APPLY-FINAL11-TEAM-CLIENT-PATCH.bat`.
5. Wait for `prisma migrate deploy` and `prisma generate` to complete.
6. Start your existing `RUN-SOCIALFLOW.bat`.

Do **not** run `prisma migrate reset`.

If `db/custom.db` exists, the installer creates `db/custom.db.before-team-client-patch.bak` once before migration.

## First setup after login

1. Sign in as Owner.
2. Open **Team → Clients**.
3. Create your clients.
4. Assign existing Instagram/social accounts to each client.
5. Open a team member and choose **Assign clients**.
6. Select as many clients as needed and save.
7. The member logs in with their own account and sees only those assigned clients.
8. As Owner, use the Team Member filter in the top bar to view that person's Accounts, Queue, Calendar, Dashboard and Analytics.

## Existing data preserved

The migration is additive. It does not delete/reset the existing database and does not change provider tokens. `SocialAccount.clientId`, `Post.clientId` and `Post.createdByUserId` are nullable for backward compatibility.

This patch ZIP intentionally contains no `.env`, database, `public/uploads`, Instagram tokens, `node_modules`, `.next`, or build cache.

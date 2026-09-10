# Patch test report

## Scope

Tested only the Instagram analytics/intelligence upgrade. No unrelated SocialFlow feature was intentionally modified.

## Checks performed

- Reconstructed the working Final11 source state using the existing account/client/team patch, P3018 account-lock recovery patch, and the fixed Local Assist patch before making this change.
- TypeScript syntax transpilation passed for all changed `.ts` and `.tsx` files.
- The new SQLite migration SQL was executed against a temporary SQLite database with foreign keys enabled; both new tables and indexes were created successfully.
- Migration is additive and contains no DROP, DELETE, reset, or destructive data statement.
- Existing account-access scoping is reused for analytics summary and manual sync routes.
- OAuth scope was extended rather than replacing the existing basic/content-publish scopes.
- No `.env`, database file, access token, upload directory, build cache or node_modules are included in the patch.

## Note on Prisma validation in the build container

The reconstructed archive contains a Prisma Client generated before the latest project migrations. Full Prisma regeneration in this isolated test container required a platform engine download that was unavailable. The installer therefore runs `npx prisma migrate deploy` followed by `npx prisma generate` on the user's normal SocialFlow machine, where the existing project already runs Prisma.

## Functional verification after install

1. Start SocialFlow and log in as Owner.
2. Open Analytics.
3. Select one Instagram professional account/client.
4. Click **Sync Instagram**.
5. If prompted for Insights permission, reconnect that same Instagram account once and retry.
6. Verify Account Analytics shows a Live Instagram Data timestamp.
7. Verify Content Analytics lists actual Instagram content and metrics.
8. Verify SocialFlow Intelligence produces best day/time/format/theme recommendations from the synced data.
9. Switch to another client; verify the first client's analytics disappear.
10. Log in as a team member; verify only assigned accounts are available.

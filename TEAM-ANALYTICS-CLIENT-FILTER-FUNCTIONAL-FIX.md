# SocialFlow Team Analytics Client Filter — Functional Fix

## Fixed
The Analytics-page Client dropdown changed visually, but the data request callback was still cached against the old header `agencyClientId`.

The callback now correctly depends on `pageClientId`.

Changing the Analytics Client dropdown now immediately reloads and filters:
- Account Analytics
- Content Analytics
- SocialFlow Intelligence

`Sync Instagram` also uses the currently selected Analytics client.

## Install
UI-only fix:
1. Stop SocialFlow.
2. Extract this ZIP directly into the current SocialFlow folder.
3. Choose **Replace files in destination**.
4. Start SocialFlow normally.

No Prisma migration.
No `npx prisma generate`.
No `.next` deletion unless the browser somehow keeps an old compiled page.

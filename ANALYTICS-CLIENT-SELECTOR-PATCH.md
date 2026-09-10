# SocialFlow Analytics Client Selector Patch

## What this changes
- Adds a dedicated **Client** dropdown directly inside the Instagram Analytics page.
- Places it immediately before the Account Analytics / Content Analytics / SocialFlow Intelligence tabs.
- Uses the same muted/light panel treatment as the existing analytics tab area.
- Includes **All clients** plus the clients/accounts already available to the signed-in user.
- The page-level selector is synchronized with the existing header Client filter.
- Changing it immediately refreshes Account Analytics, Content Analytics and SocialFlow Intelligence for the selected client.
- Existing team-member and platform filters continue to apply.

## What this does NOT change
- Instagram OAuth/tokens
- Instagram publishing
- Analytics database tables
- Existing analytics calculations
- Team permissions
- Client/account assignments
- Scheduler
- Posts
- Uploads
- `.env`

## Installation
1. Stop SocialFlow.
2. Extract this ZIP directly into your current SocialFlow folder (for example `D:\Insta\Final12`).
3. Choose **Replace files in destination**.
4. Delete the Next.js cache:
   `rmdir /s /q .next`
5. Regenerate Prisma Client:
   `npx prisma generate`
6. Start SocialFlow normally.

No Prisma migration is required for this UI-only patch.

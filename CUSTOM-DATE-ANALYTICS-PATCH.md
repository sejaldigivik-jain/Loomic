# SocialFlow Custom Date Analytics Patch

This patch is designed to be applied after:
- Real Instagram Analytics + Intelligence patch
- Analytics Client Selector patch

## Adds
- `Custom` option beside 7 / 30 / 90 days.
- From-date and To-date controls.
- Same custom range applies to Account Analytics, Content Analytics and SocialFlow Intelligence.
- CSV export filename includes the selected custom range.
- Sync Instagram understands the custom start date.
- Historical Instagram-owned media pagination is expanded for custom ranges (up to 500 media items), stopping once the requested start date is reached.
- Previous-period comparison uses the same number of days as the selected custom range.
- Existing Client / Team Member / Platform access scope is preserved.

## Important Meta limitation
Meta stores account-level User Insights for up to 90 days. A newly connected account cannot reconstruct account reach/profile activity from older dates if SocialFlow never stored those daily snapshots.

Historical owned media is different: SocialFlow can walk the account's media list and sync media-level insights for older Posts/Reels/Carousels when Meta returns them. This is what lets a custom range such as Nov 2025 → Aug 2026 find an older last post.

## Install
1. Stop SocialFlow.
2. Extract this ZIP directly into your active project, for example:
   `D:\Insta\Final12`
3. Choose **Replace files in destination**.
4. Delete Next.js cache:
   `rmdir /s /q .next`
5. Regenerate Prisma Client:
   `npx prisma generate`
6. Start:
   `RUN-SOCIALFLOW.bat`

No Prisma migration is required.

## Example for the BIM MANTRA account shown
1. Analytics → Client → BIM MANTRA
2. Choose **Custom**
3. From: `2025-11-01`
4. To: today's date (or a later desired date)
5. Click **Sync Instagram**
6. Open **Content Analytics**

The November 2025 post should appear if the connected professional account token has Insights permission and Meta returns the media/media insights.

## Files changed
- src/components/app/views/analytics.tsx
- src/app/api/v1/analytics/summary/route.ts
- src/app/api/v1/analytics/sync/route.ts
- src/lib/analytics-service.ts

This patch does not modify `.env`, SQLite data, Instagram tokens, publishing, scheduler, posts, uploads, or account assignments.

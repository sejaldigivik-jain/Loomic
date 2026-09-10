# SocialFlow Content Analytics Order Switch Patch

## Adds two Content Analytics viewing modes

1. **Performance ranking**
   - Keeps the current SocialFlow ranking.
   - Best-performing content is shown first.
   - Rank number is the actual performance rank.

2. **Latest to oldest**
   - Matches normal Instagram posting chronology.
   - Newest published post is shown first.
   - Older posts follow underneath.
   - The left number becomes the chronological position.
   - The original performance rank is still visible as `Performance #N`.

The selected date range and Client filter continue to apply to both modes.

## Installation

1. Stop SocialFlow.
2. Extract this ZIP directly into your current project folder, e.g.:
   `D:\Insta\Final12`
3. Choose **Replace files in destination**.
4. Run:
   `rmdir /s /q .next`
5. Run:
   `npx prisma generate`
6. Start SocialFlow normally:
   `RUN-SOCIALFLOW.bat`

## Database
No Prisma migration is required.

## Changed file only
`src/components/app/views/analytics.tsx`

This patch does not change Instagram tokens, API sync, publishing, scheduler, database, posts, uploads, `.env`, account assignments, or analytics calculations.

# Final6 — Instagram Publishing Limit Patch

This patch adds Instagram API publishing allowance checks without changing your database, `.env`, connected accounts, tokens, or uploaded media.

## What changes

- Composer shows live Instagram publishing allowance for every selected Instagram account.
- Shows `used / total`, remaining publishing slots, and a Refresh button.
- Server checks Meta's `/content_publishing_limit` before Feed, Reel, Story, and Carousel publishing.
- If the quota is fully used, the target stays pending instead of being permanently failed.
- SocialFlow retries a quota-blocked scheduled target after 15 minutes.
- If Meta's quota-status endpoint is temporarily unavailable, normal publishing is allowed to continue rather than breaking an otherwise working account.

## Install

1. Stop SocialFlow with `Ctrl + C`.
2. Extract this ZIP directly into the ROOT of your existing Final6 project (the folder that contains `package.json`).
3. Choose **Replace the files in the destination** when Windows asks.
4. Start SocialFlow again with `RUN-SOCIALFLOW.bat`.
5. Open Composer and select an Instagram account.
6. A new **Instagram publishing allowance** card appears below **Publish to**.

No `npm install` or Prisma migration is required if your current Final6 is already running.

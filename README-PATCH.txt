Loomic Final Responsive Handoff + Favicon Patch

Changes only:
1. Finish in Instagram modal is responsive on desktop/tablet/mobile and prevents right-side overflow.
2. Browser favicon uses the Loomic BrandMark instead of the old Z logo.

No database or Prisma migration.

Copy the CONTENTS of this ZIP into D:\Loomic_for_Sejal and replace matching files.
Then run:
  npm.cmd install
  npx.cmd prisma generate
  npm.cmd run build
  npm.cmd run dev

If the old favicon remains, hard refresh / close and reopen the browser tab because favicons are aggressively cached.

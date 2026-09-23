LOOMIC — NATIVE INSTAGRAM PUBLISHING + STORY EDITOR PATCH
=======================================================

WHAT THIS PATCH ADDS
--------------------
1. Dual Instagram connection support:
   - Existing Instagram Login remains supported.
   - Facebook Login + linked Facebook Page is added as an enhanced Instagram path.
   - Connecting the same @username through Facebook updates the existing Loomic account row instead of intentionally creating a duplicate.

2. Caption @mentions:
   - Loomic preserves @username text in Feed/Reel/Carousel captions for automatic publishing.

3. Native media tags for Facebook-linked Instagram:
   - Feed image user_tags.
   - First image of a Carousel receives the current global Loomic tag list.
   - Instagram Login accounts keep the existing safe/manual fallback because that API path does not expose tagging.

4. Native location support:
   - Facebook-linked Instagram accounts can search Meta places and store a location_id.
   - When a native location ID is available, Loomic sends location_id so Instagram can show the location under the username.
   - If Meta Pages Search is unavailable/not approved, Loomic keeps the existing Geoapify/text-location fallback.

5. Instagram-style Story editor:
   - 9:16 canvas.
   - Drag text, visual @mentions and decorative stickers.
   - Freehand draw + undo stroke.
   - Brightness, contrast, saturation and grayscale effects.
   - Resize/color selected overlays.
   - Download and Apply to Story.
   - Image Stories are rendered to a final 1080x1920 JPEG and then use Loomic's existing publish/schedule flow.
   - Video Story overlay rendering is intentionally not faked: the original video stays intact and native Instagram-only features still require finishing in Instagram.

6. Existing Loomic publishing preserved:
   - Feed / Reel / Story / Carousel.
   - Reel Share to Feed.
   - Existing scheduler and retries.
   - Publishing-limit checks.
   - Analytics/sync now choose graph.instagram.com or graph.facebook.com based on the account connection method.

NO DATABASE MIGRATION
---------------------
This patch uses existing SocialAccount.providerData and existing post Instagram option metadata.
Do NOT run prisma migrate reset.

REQUIRED META SETUP FOR ENHANCED FACEBOOK-LINKED INSTAGRAM
----------------------------------------------------------
- Instagram account must be Professional (Business or Creator).
- It must be linked to a Facebook Page.
- Add this OAuth redirect URI to your Meta app:
  https://loomic-three.vercel.app/api/oauth/facebook/callback

The Facebook OAuth path requests these permissions because Loomic already supports Facebook/Instagram publishing and analytics:
- pages_show_list
- pages_manage_posts
- pages_read_engagement
- instagram_basic
- instagram_content_publish
- instagram_manage_insights

Your existing META_APP_ID and META_APP_SECRET are reused as fallback Facebook OAuth credentials.
Do not put app secrets into frontend code or GitHub source files.

IMPORTANT META LIMITS
---------------------
- Native Story Mention/Music/Poll/Question/Link stickers are not created by the Content Publishing API.
- A visual @username rendered into a Story is pixels, not Instagram's native Mention sticker.
- Facebook-linked Stories are subject to Meta's account-type/API limitations.
- Meta place search may require appropriate App Review/access. Loomic safely falls back to the existing text location behavior if unavailable.

INSTALL IN VS CODE
------------------
1. Open your Loomic project in VS Code:
   D:\Loomic_for_Sejal

2. In Terminal, create a backup commit first:
   git status
   git add .
   git commit -m "Backup before Instagram native publishing patch"

3. Stop the local Loomic dev server.

4. Extract this ZIP DIRECTLY over D:\Loomic_for_Sejal
   Choose "Replace files in destination" when Windows asks.

5. No Prisma migration is required.

6. Run:
   npm.cmd install
   npx.cmd prisma generate
   npm.cmd run build

7. If build succeeds, run locally:
   npm.cmd run dev

8. Test before pushing:
   - Existing Instagram Login account still loads.
   - Feed image Publish Now.
   - Reel Publish Now.
   - Carousel Publish Now.
   - Story image editor -> Apply to Story -> Publish/Schedule.
   - Caption containing @username.
   - Existing scheduled post.
   - Connect Facebook for one test Page linked to a Professional Instagram account.
   - Check enhanced account badge/capabilities.
   - Native image tag on Feed image.
   - Native location search/selection.
   - Analytics sync for the enhanced account.

PUSH TO CONNECTED GITHUB
------------------------
From the VS Code terminal in D:\Loomic_for_Sejal:

   git status
   git add .
   git commit -m "Add Instagram native publishing and Story editor"
   git push origin main

If Vercel is connected to the GitHub main branch, it will start a new deployment automatically.

ROLLBACK
--------
If the local build fails after extraction, do not push it.
Use:
   git status
   git restore .

If you already committed the patch locally but have NOT pushed:
   git reset --hard HEAD~1

VALIDATION NOTE
---------------
The changed TypeScript/TSX files were syntax-parsed successfully in the patch environment.
A full Next.js production build could not be completed in this environment because the recovered project copy did not contain usable installed npm dependencies. Run npm.cmd install and npm.cmd run build on your actual Loomic project before pushing to GitHub.

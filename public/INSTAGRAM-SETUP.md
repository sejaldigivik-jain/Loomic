# Real Instagram Publishing — Complete Setup Guide

This guide walks you through connecting your **real Instagram account** to SocialFlow and publishing posts to your actual Instagram feed (not simulated).

---

## How It Works

SocialFlow now supports **two types of accounts**:

| Type | How it connects | How it publishes |
|------|----------------|-----------------|
| **REAL** | Instagram OAuth (you log into Instagram + authorize) | Calls Instagram Graph API → post appears on your real feed |
| **DEMO** | You type a handle in a form | Simulated publish (fake success/failure, no real post) |

The Accounts page shows a **REAL** or **DEMO** badge on each account card so you always know which is which.

---

## What You Need (one-time setup, ~15 minutes)

Instagram's publishing API has hard requirements you cannot bypass:

1. **Instagram Business or Creator account** (personal accounts can't use the API)
2. **A Facebook Page** linked to your Instagram account
3. **A Meta developer app** (free) with the Instagram Graph API product
4. **Your Instagram account added as a test user** (during development)

---

## Step 1 — Convert Your Instagram to Business/Creator

1. Open the **Instagram app** on your phone
2. Go to your profile → **Settings** (hamburger menu → Settings and privacy)
3. **Account type and tools** → **Switch to professional account**
4. Choose **Business** (recommended) or **Creator**
5. Complete the setup wizard (category, contact info, etc.)

> ⚠️ **Personal accounts cannot use the publishing API.** You must switch to Business or Creator.

---

## Step 2 — Link Instagram to a Facebook Page

Instagram's API publishes **through** a Facebook Page relationship. This is mandatory.

1. Go to your **Facebook Page** (create one at facebook.com/pages if you don't have one — it's free)
2. **Settings** → **Linked accounts** → **Instagram** → **Connect Account**
3. Log in with your Instagram credentials
4. Confirm the link

> The Facebook Page doesn't need to be active or have followers — it just needs to exist and be linked.

---

## Step 3 — Create a Meta Developer App

1. Go to **https://developers.facebook.com**
2. Log in with your Facebook account
3. Click **My Apps** → **Create App**
4. App type: **Business**
5. App name: `SocialFlow` (or anything you like)
6. App contact email: your email
7. Click **Create App**

### Add the Instagram Graph API product:
1. In your app dashboard, scroll down to **Add Product**
2. Find **Instagram Graph API** → click **Set Up**
3. This enables the `/media` and `/media_publish` endpoints

### Add Facebook Login product (for OAuth):
1. **Add Product** → find **Facebook Login** → **Set Up**
2. Choose **Web** platform
3. Site URL: `http://localhost:3000`
4. In **Facebook Login → Settings**:
   - **Valid OAuth Redirect URIs**: `http://localhost:3000/api/oauth/instagram/callback`
   - Click **Save**

---

## Step 4 — Add Your Instagram as a Test User

During development (before app review), only test users can use your app's API.

1. In your Meta app dashboard → **Roles** → **Instagram Testers**
2. Click **Add Instagram Testers**
3. Enter your Instagram username
4. The tester receives an invitation in their Instagram app:
   - Open **Instagram app** → **Profile** → **Settings** → **Apps and Websites** → **Tester Invitations**
   - **Accept** the invitation

> Without this step, you'll get "User is not a test user" errors.

---

## Step 5 — Get Your Credentials

In your Meta app dashboard → **Settings → Basic**:

- **App ID** → this is your `INSTAGRAM_CLIENT_ID`
- **App Secret** → click "Show" → this is your `INSTAGRAM_CLIENT_SECRET`

### Add to your `.env` file:

```env
# Meta / Instagram OAuth
INSTAGRAM_CLIENT_ID=1234567890123456
INSTAGRAM_CLIENT_SECRET=abc123def456ghi789jkl012mno345pqr678stu
INSTAGRAM_REDIRECT_URI=http://localhost:3000/api/oauth/instagram/callback
```

### Restart your dev server:
```bash
# Stop the current server (Ctrl+C), then:
npm run dev
```

---

## Step 6 — Connect Your Real Instagram Account

1. Open SocialFlow in your browser → sign in
2. Go to **Accounts**
3. You should now see a green banner: **"Instagram OAuth configured ✓"**
4. Click **Connect account**
5. Click **Instagram** (now shows "REAL OAUTH" badge)
6. You'll be redirected to Instagram's consent screen
7. Log in with your Instagram credentials
8. Click **Authorize**
9. Instagram redirects back to SocialFlow
10. Your real Instagram account appears with a **REAL** badge ✓

---

## Step 7 — Publish a Real Post

1. Go to **Composer**
2. Select your **REAL** Instagram account (look for the green REAL badge)
3. **IMPORTANT**: Add at least one image — Instagram's API does NOT support text-only posts
4. The image URL must be **publicly accessible** (Instagram's servers fetch it). The sample stock images in the composer work. For your own images, upload them to Cloudinary, Imgur, or any public URL first.
5. Type your caption
6. Click **Publish now** OR **Schedule** for later
7. Watch the **Queue** — the status chips show `pending → publishing → published`
8. When it shows green **published**, click the 🔗 link icon → it opens your real Instagram post

---

## Important Limitations (Instagram's rules, not ours)

| Limitation | Detail |
|-----------|--------|
| **No text-only posts** | Instagram's API requires at least 1 image or video |
| **Public media URLs** | Instagram's servers fetch your image. Must be publicly accessible (not localhost, not behind auth) |
| **Carousel max 10** | Instagram carousels support 2-10 items |
| **25 posts / 24 hours** | Per account rate limit |
| **Token expires in 60 days** | Needs reconnection or refresh |
| **Business/Creator only** | Personal accounts cannot use the publishing API |
| **App review for other users** | To let OTHER people connect their Instagram, your app needs Meta's review. For your own personal use, test users are fine. |

---

## Troubleshooting

### "Instagram OAuth not configured" banner still shows
→ Your `.env` file doesn't have `INSTAGRAM_CLIENT_ID` and `INSTAGRAM_CLIENT_SECRET`. Add them and restart the dev server.

### "User is not a test user"
→ Your Instagram account isn't added as a tester. Go to your Meta app → Roles → Instagram Testers → add your username. Then accept the invitation in your Instagram app (Settings → Apps and Websites → Tester Invitations).

### "Invalid scope: instagram_content_publish"
→ Your app hasn't been approved for this permission. During development, test users can use it without approval. Make sure your Instagram is added as a tester.

### "Media container creation failed: Invalid image URL"
→ Instagram couldn't fetch your image. The URL must be publicly accessible. `localhost` URLs won't work (Instagram's servers can't reach your computer). Use the sample stock images in the composer, or upload your images to Cloudinary/Imgur first.

### "Access token expired"
→ Your 60-day token expired. Click "Connect account" → Instagram again to get a fresh token.

### OAuth redirect shows "URL blocked" or "Redirect URI mismatch"
→ The redirect URI in your `.env` (`INSTAGRAM_REDIRECT_URI`) must EXACTLY match what's in your Meta app's Facebook Login settings. Both must be `http://localhost:3000/api/oauth/instagram/callback`.

### Post shows "published" but I don't see it on Instagram
→ Check if the account is REAL (green badge) or DEMO. Demo accounts simulate publishing — no real post is created. Only REAL accounts publish to Instagram.

---

## How to Tell Real vs Demo Accounts

Every account card shows a badge:

- 🟢 **REAL** — connected via OAuth, has a real access token, posts publish to your actual Instagram
- ⚪ **DEMO** — manually entered handle, no real token, posts are simulated

The publish worker automatically uses the right strategy:
- REAL accounts → calls `/api/v1/publish` → real Instagram Graph API
- DEMO accounts → simulated publish (random success/failure)

---

## File Reference

| File | Purpose |
|------|---------|
| `src/app/api/v1/config/instagram/route.ts` | Tells the client if Instagram OAuth is configured |
| `src/app/api/oauth/instagram/callback/route.ts` | OAuth callback — exchanges code for token, stores in DB |
| `src/app/api/v1/publish/route.ts` | Server endpoint that publishes to real Instagram |
| `src/lib/instagram-publisher.ts` | Instagram Graph API calls (create container, publish, carousel, refresh) |
| `src/hooks/use-publish-worker.ts` | Background worker — real accounts use API, demo uses simulation |
| `src/components/app/views/accounts.tsx` | Accounts UI — shows REAL/DEMO badges, OAuth status banner |
| `src/lib/store.ts` | Zustand store — reads OAuth callback cookie, tracks `isReal` + `externalUserId` |

---

## For Other Platforms (Twitter, LinkedIn, Facebook, etc.)

The architecture is identical — you need to:

1. Create a developer app on the platform
2. Add OAuth credentials to `.env`
3. Create an OAuth callback route at `src/app/api/oauth/{platform}/callback/route.ts`
4. Create a publisher at `src/lib/{platform}-publisher.ts`
5. Wire it into `src/app/api/v1/publish/route.ts`

| Platform | API Docs | Scopes Needed |
|----------|----------|---------------|
| **Twitter/X** | https://developer.twitter.com/en/docs/twitter-api | `tweet.read`, `tweet.write` |
| **LinkedIn** | https://learn.microsoft.com/linkedin/marketing/integrations | `w_member_social` |
| **Facebook Pages** | https://developers.facebook.com/docs/pages-api | `pages_manage_posts`, `pages_read_engagement` |
| **Threads** | https://developers.facebook.com/docs/threads | `threads_basic`, `threads_content_publish` |
| **Pinterest** | https://developers.pinterest.com/docs/api/v5/ | `boards:read`, `pins:write` |

The Instagram implementation serves as a complete reference — copy the pattern for each platform.

---

## Quick Checklist

- [ ] Instagram account converted to Business/Creator
- [ ] Instagram linked to a Facebook Page
- [ ] Meta developer app created
- [ ] Instagram Graph API product added
- [ ] Facebook Login product added with redirect URI set
- [ ] Instagram tester added + invitation accepted
- [ ] `.env` has `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`, `INSTAGRAM_REDIRECT_URI`
- [ ] Dev server restarted after adding env vars
- [ ] Green "Instagram OAuth configured ✓" banner appears on Accounts page
- [ ] Connected real Instagram account (shows REAL badge)
- [ ] Test post includes at least one image
- [ ] Post published → click the 🔗 link → opens on real Instagram

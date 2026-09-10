# Instagram connection — fixed one-click flow

This build fixes the redirect URI bug that occurred behind Cloudflare Quick Tunnel.

## What changed
- The active Quick Tunnel URL is now the source of truth for OAuth callbacks, even when Next.js internally sees localhost.
- Old localhost and old trycloudflare callbacks stored in the database are ignored while one-click tunnel mode is running.
- Instagram OAuth requests only the two permissions needed for connection + publishing: `instagram_business_basic` and `instagram_business_content_publish`.
- Instagram Business Login flags are included (`enable_fb_login=0`, `force_authentication=1`).
- Token exchange uses multipart form-data, matching Meta's documented token request.
- Profile enrichment can no longer break a successful OAuth connection.

## Run
1. `npm install` (first run only)
2. `START-SOCIALFLOW-PUBLIC.bat`
3. Copy the callback printed by the launcher into Meta > Instagram API > API setup with Instagram login > Set up Instagram business login.
4. In SocialFlow Settings > Integrations > Instagram, save the Instagram App ID and App Secret. The callback is auto-managed.
5. Accounts > Instagram > Connect.

The Meta redirect registration is the only provider-side setting SocialFlow cannot modify for you.

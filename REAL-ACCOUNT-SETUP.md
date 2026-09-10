# SocialFlow — connect real social accounts

SocialFlow now uses real OAuth for Instagram, Facebook Pages, Threads, LinkedIn, X, and Pinterest. The old development demo connector is disabled unless `ALLOW_DEMO_SOCIAL_CONNECTIONS=true` is explicitly set.

## Important: why a developer app is required

A self-hosted social scheduler cannot securely connect a customer's username/password directly. Each social network requires SocialFlow to identify itself with a developer application (Client ID/App ID and, for most providers, a Client Secret), then the account owner approves access on the provider's own OAuth screen.

Buffer already operates approved provider applications. Your own SocialFlow installation needs your own provider applications/approvals before real accounts can be connected.

## The easiest setup inside SocialFlow

1. Start SocialFlow and sign in as the workspace owner/admin.
2. Open **Settings → Integrations**.
3. Pick a provider and click **Open developer portal**.
4. Create/configure the provider app and enable the publishing product/permissions described below.
5. In the provider portal, register the **exact Redirect / Callback URI** shown by SocialFlow. Do not type a different path.
6. Copy the provider **Client ID / App ID** and **Client Secret** into SocialFlow and click **Save integration**.
7. Open **Accounts**. The provider card will change from **Set up** to **Connect**.
8. Click **Connect**, sign in on the provider's own site, and approve access.
9. After the callback, SocialFlow stores the returned account token encrypted and the account appears with a **REAL** badge.

You configure the developer app once per provider/workspace. You can then connect multiple real client accounts through the same provider app, subject to the provider's app mode, review status and policies.

## Provider requirements

### Instagram
- Uses **Instagram API with Instagram Login**.
- Works with Instagram **professional accounts (Business or Creator)** supported by Meta's API; it is not a generic password connector for personal accounts.
- Requested scopes in this build: `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_insights`.
- Callback: `/api/oauth/instagram/callback`.
- Publishing requires media. SocialFlow normalizes static image uploads for Instagram compatibility.

### Facebook
- Connects **Facebook Pages you can manage**, not personal-profile publishing.
- Requested scopes: `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`.
- Callback: `/api/oauth/facebook/callback`.
- On successful OAuth, SocialFlow imports the manageable Pages returned by the Pages API.

### Threads
- Create a Meta app with the **Threads use case**.
- Requested scopes: `threads_basic`, `threads_content_publish`, `threads_manage_insights`.
- Callback: `/api/oauth/threads/callback`.

### LinkedIn
- Add **Sign In with LinkedIn using OpenID Connect** and **Share on LinkedIn** to the LinkedIn developer app.
- Requested scopes: `openid`, `profile`, `w_member_social`.
- Callback: `/api/oauth/linkedin/callback`.
- This build publishes on behalf of the authenticated LinkedIn member. LinkedIn organization publishing requires additional Marketing/organization permissions and is not presented as enabled here.

### X
- Enable OAuth 2.0 in the X Developer Console.
- Uses Authorization Code Flow with **PKCE**.
- Requested scopes: `tweet.read`, `tweet.write`, `users.read`, `offline.access`.
- Callback: `/api/oauth/twitter/callback`.
- X API access/pricing is controlled by X. The current build publishes text posts; media upload is intentionally not claimed as enabled.

### Pinterest
- Register a Pinterest app and configure OAuth access.
- Requested scopes: `user_accounts:read`, `boards:read`, `pins:read`, `pins:write`.
- Callback: `/api/oauth/pinterest/callback`.
- SocialFlow stores the first available board as the default board during connection. Pinterest publishing in this build requires one image.

## Localhost vs live domain

OAuth can be tested locally only where the provider accepts the localhost callback you register. For production, use a public HTTPS domain and register the production callback shown by SocialFlow.

A public domain is also important for media publishing: providers such as Meta may need to fetch the media URL from SocialFlow's server. A `localhost` media URL is not reachable from the provider's servers.

## Environment-variable fallback

Settings → Integrations is the easiest method. Server administrators can instead set provider credentials in `.env` / production secrets. Workspace credentials saved in Settings take priority; environment variables are the fallback.

Keep `ALLOW_DEMO_SOCIAL_CONNECTIONS=false` when you want only real accounts.

## Existing demo account

If your database already contains `@yourbrand` with a **DEMO** badge, open its `…` menu and choose **Disconnect**. It is not a real Instagram connection. After configuring Instagram, use **Connect account** and complete Meta/Instagram OAuth.

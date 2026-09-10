# Instagram Setup

Instagram is one of SocialFlow's real provider adapters. For the complete multi-provider environment reference, see **PROVIDER-SETUP.md**.

## Environment

```env
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=
INSTAGRAM_REDIRECT_URI=http://localhost:3000/api/oauth/instagram/callback
META_GRAPH_API_VERSION=v26.0
```

For production, change the redirect URI to your public HTTPS domain and register the exact same URI in the Meta/Instagram developer application.

SocialFlow requests:

```text
instagram_business_basic
instagram_business_content_publish
instagram_business_manage_insights
```

## Connect

1. Sign in to SocialFlow.
2. Open **Accounts** → **Connect account** → **Instagram**.
3. Complete Instagram OAuth for the active workspace.
4. After the callback, the connected professional account is stored with encrypted provider credentials.

## Publish

Instagram publishing is server-side. You can publish immediately or schedule a post; the scheduler container handles due posts independently of the browser.

Supported in this build: image, video and carousel posts. Media must be reachable by Instagram's servers from your public deployment URL.

## Analytics

The account sync route and scheduled analytics job refresh published-post metrics into SocialFlow's persisted analytics records. Other providers currently retain their publishing integration but do not yet have equivalent detailed analytics sync adapters.

## Production notes

- Use an Instagram professional account eligible for the API.
- Complete the provider's required app setup/review for users outside your developer/test roles.
- Keep `TOKEN_ENCRYPTION_KEY` stable; changing it prevents existing encrypted social tokens from being decrypted.
- Do not enable `ALLOW_DEMO_SOCIAL_CONNECTIONS` on a customer-facing deployment unless you explicitly want labeled UI-only demo channels.

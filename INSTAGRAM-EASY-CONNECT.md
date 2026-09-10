# Instagram — easiest local connection

This build has **two** Instagram connection methods.

## A. Easy test connection (recommended before going live)

This avoids OAuth redirect-URI setup entirely.

1. Start SocialFlow using `RUN-SOCIALFLOW.bat`.
2. In **Settings → Integrations → Instagram**, save the Instagram App ID and App Secret from Meta.
3. In Meta Developer open **Use cases → Instagram API → API setup with Instagram login**.
4. Make sure the Instagram Business/Creator account is an **Instagram Tester** for the app.
5. Under **Generate access tokens**, click **Generate token** beside the account and approve access.
6. In SocialFlow open **Accounts → Instagram → Connect**.
7. Choose **Easy test connection — Meta generated token**.
8. Paste the token and click **Connect real account**.
9. SocialFlow verifies the token, attempts to exchange it for a long-lived token, encrypts it at rest, and stores the real Instagram account.
10. Open Composer, select the account, attach media, and publish.

## B. Production OAuth connection

Use this when SocialFlow has a permanent public HTTPS domain. Register the exact SocialFlow callback in Meta Business Login settings, then use **Accounts → Instagram → Connect → Production OAuth connection**. This is the flow intended for normal customers connecting their own accounts.

## Why RUN-SOCIALFLOW.bat creates a public bridge

Instagram fetches image/video URLs from SocialFlow's server during publishing. A file URL that exists only on `localhost` cannot be reached by Instagram. The launcher therefore creates a temporary HTTPS bridge and uses it when it builds uploaded media URLs, while you continue to use the SocialFlow UI at `http://localhost:3000`.

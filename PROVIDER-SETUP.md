# Provider setup

Real provider configuration can now be completed from **SocialFlow → Settings → Integrations**. The application stores provider Client IDs and encrypted Client Secrets per workspace, displays the exact OAuth callback URI, and uses those credentials when **Accounts → Connect** starts OAuth.

See **REAL-ACCOUNT-SETUP.md** for the step-by-step provider checklist.

## Optional environment fallback

For managed deployments you may configure credentials as server environment variables instead of saving them in a workspace:

- `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`, `INSTAGRAM_REDIRECT_URI`
- `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`, `FACEBOOK_REDIRECT_URI`
- `THREADS_CLIENT_ID`, `THREADS_CLIENT_SECRET`, `THREADS_REDIRECT_URI`
- `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI`
- `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_REDIRECT_URI`
- `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET`, `PINTEREST_REDIRECT_URI`

Workspace credentials take priority over environment variables. X can operate as a public OAuth client without a stored client secret where the X application configuration permits it; the other provider integrations in this build expect a client secret.

Set `ALLOW_DEMO_SOCIAL_CONNECTIONS=false` for a real deployment.

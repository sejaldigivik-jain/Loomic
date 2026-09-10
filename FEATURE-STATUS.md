# SocialFlow feature status

## Production-backed application features

- Email/password registration, login, refresh sessions, logout and password reset flow.
- Multiple workspaces with membership/role authorization.
- Team invitations, role management, ownership transfer and approval workflow.
- Database-backed composer, drafts, scheduled posts, queue and calendar.
- Edit existing drafts/scheduled posts from Queue or Calendar; published posts open as a new draft rather than pretending to edit a remote live post.
- Per-account copy overrides from one composer.
- Persistent media uploads.
- Server-side Publish Now and scheduled publishing worker/cron endpoint.
- Provider target status, external URL and publish-error tracking.
- Real OAuth configuration UI under Settings → Integrations.
- Encrypted provider app secrets and encrypted connected-account access tokens.
- Real OAuth account connection adapters for Instagram, Facebook Pages, Threads, LinkedIn member accounts, X and Pinterest.
- Provider profile refresh for all six channels; detailed post analytics sync currently centers on Instagram.
- Instagram image/video/carousel publishing.
- Facebook Page text/link or one-image publishing.
- Threads text/image/video/carousel publishing.
- LinkedIn member text or one-image publishing.
- X text publishing.
- Pinterest one-image Pin publishing to the connected default board.
- Analytics CSV export and full application JSON backup export.
- PostgreSQL/Docker/Caddy production deployment path plus SQLite local development.

## Provider/API limitations intentionally shown to the user

These are not fake buttons or simulated successes:

- Personal Facebook profile publishing is not supported; Facebook integration is Page-based.
- Instagram connection is for professional accounts supported by Instagram's API.
- X media upload is not enabled in this build.
- LinkedIn organization/video/document publishing is not enabled in this build.
- Facebook video/multi-image adapter is not enabled in this build.
- Pinterest uses a default board selected at connection time; advanced board selection UI is a future enhancement.
- Cross-provider detailed analytics are not yet at Buffer-scale parity.
- Inbox/comments/DM management is not implemented.
- Billing is not connected to a payment gateway.

## Real vs demo

Development demo accounts are off by default and can only be enabled with `ALLOW_DEMO_SOCIAL_CONNECTIONS=true`. Real OAuth accounts show a **REAL** badge. See `REAL-ACCOUNT-SETUP.md`.

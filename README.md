# SocialFlow — Buffer-style social publishing workspace

> **Connecting real social accounts:** open **Settings → Integrations** in the app and follow [`REAL-ACCOUNT-SETUP.md`](REAL-ACCOUNT-SETUP.md). Demo connections are disabled by default.


SocialFlow is a self-hostable social media management application built with Next.js, Prisma and PostgreSQL. This upgraded edition is designed to be deployed as a real multi-user workspace rather than run as a browser-only demo.

## What is implemented

- **Authentication & recovery** — registration, login, short-lived access tokens, rotating HttpOnly refresh sessions, logout/revocation, password change and expiring password-reset links.
- **Multi-workspace access** — workspace switching, role-based membership checks, profile/workspace settings and audit-oriented permission boundaries.
- **Publishing workflow** — composer, normalized media upload, drafts, scheduled posts, per-account copy overrides, per-account targets, queue states, calendar views and publish-now.
- **Server-side scheduler** — due posts are published from the server even when nobody has the browser open.
- **Team collaboration** — invitations, member roles, approval / reject / request-changes workflow and owner-safe membership changes.
- **Social connections** — OAuth adapters for Instagram, Facebook Pages, Threads, LinkedIn members, X and Pinterest.
- **Provider publishing** — supported formats are listed below; provider restrictions are surfaced as errors instead of simulated success.
- **Analytics** — persisted analytics/dashboard views with live Instagram post-metric sync. The data model is ready for more provider-specific analytics adapters.
- **API access** — scoped API tokens (`read`, `write`, `admin`) with revocation, expiry and last-used tracking.
- **Security** — encrypted OAuth tokens at rest, Secure/HttpOnly refresh cookies, signed OAuth state, workspace authorization on protected APIs, auth rate limiting and production-only secret requirements.
- **Production stack** — PostgreSQL, persistent media, Caddy HTTPS, health checks and a dedicated scheduler container through Docker Compose.

## Social provider support

| Provider | OAuth | Publishing implemented | Notes |
|---|---|---|---|
| Instagram | Yes | Image, video, carousel | Professional accounts; analytics sync included |
| Facebook Pages | Yes | Text/link, one image | Connects manageable Pages from the authorized profile |
| Threads | Yes | Text, image, video, carousel | Long-lived token exchange/refresh supported |
| LinkedIn | Yes | Text, one image | Member posting via `w_member_social` |
| X | Yes, OAuth 2.0 PKCE | Text | Media upload is intentionally not advertised/enabled in this build |
| Pinterest | Yes | One image Pin | Uses the first accessible board as the default board |

Developer credentials, provider approval and any platform billing/access requirements are still required before a live account can publish. See **PROVIDER-SETUP.md**.

## Local development

Requirements: Node.js 22 recommended, npm, and a writable local directory.

```bash
npm install
npm run dev
```

The development command automatically creates a local `.env` when needed, generates the Prisma client, and synchronizes the SQLite schema before Next.js starts. If you are upgrading an older copy, `npm run repair` clears the Next.js cache and re-syncs the database.

Open `http://localhost:3000`, register a user, then create/connect accounts from the Accounts screen. Local development uses SQLite by default.

## Production deployment

The included production stack uses PostgreSQL and a scheduler process:

```bash
cp .env.production.example .env.production
# Fill in DOMAIN, database password, security secrets and provider credentials.
docker compose --env-file .env.production up -d --build
```

See **PRODUCTION-DEPLOYMENT.md** for DNS, backups, HTTPS, OAuth callback URLs and live checks.

## Important environment variables

```env
JWT_SECRET="...32+ random characters..."
TOKEN_ENCRYPTION_KEY="...32+ random characters..."
CRON_SECRET="...separate random secret..."
NEXT_PUBLIC_APP_URL="https://social.example.com"
MAX_UPLOAD_MB=25

# Optional email delivery for invitations / password resets
RESEND_API_KEY=""
EMAIL_FROM="SocialFlow <notifications@example.com>"
```

Provider variables are documented in **PROVIDER-SETUP.md**.

## Production publishing model

1. A user creates a draft or scheduled post.
2. The API persists the master copy, optional per-account copy overrides, media and per-social-account target records.
3. Publish-now calls the server publishing service immediately.
4. Scheduled posts stay in `scheduled` state until the scheduler calls `/api/v1/jobs/publish-due`.
5. The publishing service selects the provider adapter, refreshes supported OAuth tokens when necessary, and stores each target's provider result/error.
6. Queue/calendar/dashboard views reload the persisted result; no local-success fallback is used when a server mutation fails.

## Media behavior

Uploaded JPG/PNG/WebP images are normalized to JPEG for broad publishing compatibility, including Instagram. MP4 is accepted for the video-capable adapters in this build. The default upload limit is controlled by `MAX_UPLOAD_MB` (25 MB in the supplied configuration).

## Key API areas

- `/api/v1/auth/*` — auth, refresh, password recovery
- `/api/v1/workspace*` — workspace read/update/activate
- `/api/v1/posts*` — drafts, schedule, target updates, publish
- `/api/v1/accounts*` — connected social accounts and Instagram analytics sync
- `/api/v1/oauth/{provider}/start` — provider OAuth start (Instagram has its dedicated equivalent)
- `/api/oauth/{provider}/callback` — provider callbacks
- `/api/v1/approvals` — approval queue and actions
- `/api/v1/teams/*` — members/invitations
- `/api/v1/tokens` — personal API tokens
- `/api/v1/jobs/publish-due` — cron-safe publisher
- `/api/v1/jobs/sync-analytics` — cron-safe analytics sync
- `/api/health` — database-backed health check

## Tech stack

Next.js 16 App Router, React 19, TypeScript, Prisma, SQLite (development), PostgreSQL (production), Zustand, Tailwind CSS 4, shadcn/Radix UI, Framer Motion, Recharts and Caddy/Docker Compose for deployment.

## AI Studio

AI Studio now uses the OpenAI Responses API server-side. Configure it from **Settings → AI Provider** or with `OPENAI_API_KEY` / `OPENAI_MODEL` environment variables. The workspace API key is encrypted before database storage and is never returned to the browser. See `AI-SETUP.md`.

## Known scope boundaries

This is a substantial Buffer-style publishing application, not a claim of one-to-one parity with every Buffer product or every social network API feature. In particular, cross-network analytics beyond Instagram, X media upload, LinkedIn video/doc posts, Facebook multi-media/video publishing, Pinterest board selection UI, billing/payment processing and provider-specific inbox/reply features require further adapters if you need them.

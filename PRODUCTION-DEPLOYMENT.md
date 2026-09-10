# SocialFlow — Production Deployment

The included Docker stack is the recommended live path. It separates the web application, PostgreSQL database, scheduler and HTTPS proxy so scheduled publishing does not depend on a browser tab being open.

## Stack

- Next.js application
- PostgreSQL 17 with a persistent volume
- Caddy with automatic HTTPS
- Persistent `/public/uploads` volume
- Scheduler: due-post check every 60 seconds
- Analytics job: approximately every 15 minutes
- Database-backed `/api/health` check

## 1. Server and DNS

Use a Linux server with Docker Engine and Docker Compose. Point the domain's DNS record to the server before launch. A practical small-team baseline is 2 vCPU, 4 GB RAM and sufficient persistent disk for media/database growth.

## 2. Configure production secrets

```bash
cp .env.production.example .env.production
```

Set at minimum:

```text
DOMAIN
POSTGRES_PASSWORD
JWT_SECRET
CRON_SECRET
TOKEN_ENCRYPTION_KEY
MAX_UPLOAD_MB (optional; defaults to 25)
```

Generate separate random secrets, for example:

```bash
openssl rand -hex 32
```

Do not rotate `TOKEN_ENCRYPTION_KEY` casually after accounts are connected; existing encrypted provider tokens depend on it.

## 3. Configure social apps

Fill only the providers you intend to offer. The Docker Compose file derives their callback URLs from `DOMAIN`. Register those same callback URLs in each provider console. See **PROVIDER-SETUP.md** for scopes and format boundaries.

Leave this disabled on a public deployment:

```env
ALLOW_DEMO_SOCIAL_CONNECTIONS=false
```

## 4. Optional email

Team invitations and password-reset emails can be sent through the included Resend-compatible HTTP integration:

```env
RESEND_API_KEY=
EMAIL_FROM="SocialFlow <notifications@your-domain.com>"
```

Without email configuration, invitation/reset APIs remain safe, but delivery cannot be automatic; development responses can expose local recovery/invite URLs where implemented.

## 5. Launch

```bash
docker compose --env-file .env.production up -d --build
```

Inspect the stack:

```bash
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs -f app
docker compose --env-file .env.production logs -f scheduler
```

Caddy will serve the app at `https://YOUR-DOMAIN` after certificate issuance succeeds.

## 6. Live acceptance test

Before onboarding users, verify registration/login and refresh-cookie rotation, password reset delivery, workspace switching, team invite/approval, JPEG-normalized image and MP4 upload from the public domain, per-account copy overrides, one publish-now post per configured provider, one scheduled post with the browser closed, failed-target error visibility, Instagram analytics sync and reconnect/token-refresh behavior.

## 7. Backups

Database example:

```bash
docker compose --env-file .env.production exec -T db \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > socialflow-backup.sql
```

Back up the `socialflow_uploads` volume too. For larger deployments, move media to object storage/CDN and add that storage adapter before scaling horizontally.

## 8. Scheduler endpoints

The scheduler calls:

```text
POST /api/v1/jobs/publish-due
POST /api/v1/jobs/sync-analytics
```

Both require `CRON_SECRET` and are intended for server-to-server use.

## 9. Scaling notes

The included deployment is a strong single-server setup. At higher traffic/media volume, move uploads to S3/R2-compatible object storage, run managed PostgreSQL, use a distributed job queue with idempotency/locking for publishing, add centralized logs/metrics and configure multiple application replicas behind a load balancer.

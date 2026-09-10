# Deploying SocialFlow / Loomic to Vercel

This replaces the Docker/Caddy instructions in `PRODUCTION-DEPLOYMENT.md`, which
describe the old single-server setup.

Work through the steps in order. Steps 1–3 must be done before the first deploy
will actually work.

---

## What changed for Vercel, and why

Vercel runs the app as **serverless functions**: short-lived processes that wake
on a request and disappear afterwards. Three things had to change.

| Assumption that broke | Why | What replaced it |
| --- | --- | --- |
| Uploads written to `public/uploads` | The filesystem is read-only, and anything in `/tmp` vanishes when the function recycles | Supabase Storage (public `media` bucket) |
| 1 GB video uploads through the API | Vercel rejects request bodies over 4.5 MB | Browser uploads straight to Supabase using a signed URL |
| `setInterval` scheduler in `instrumentation.ts` | No always-on process exists | GitHub Actions calls the job endpoints on a timer |

**Current upload limits:** images 4 MB (Vercel's request cap), video 50 MB
(Supabase Free's per-file cap). Both are environment variables — raise
`MAX_VIDEO_UPLOAD_MB` after upgrading the Supabase plan, and raise the bucket's
file size limit in the Supabase dashboard to match.

---

## 1. Create the Supabase Storage bucket

Media must be publicly readable, because Instagram and Facebook publish by
*fetching the URL from Meta's servers* — the link has to work from outside.

1. In the Supabase dashboard, open **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **`service_role` key** → `SUPABASE_SERVICE_ROLE_KEY`

   > The `service_role` key bypasses all row level security. Keep it server-side
   > only. Never give it a `NEXT_PUBLIC_` prefix.

2. Put both into your local `.env`, then create the bucket:

   ```bash
   node scripts/setup-supabase-storage.mjs
   ```

   It creates a public bucket named `media` with a 50 MB per-file limit, and is
   safe to run more than once.

---

## 2. Push to GitHub

The repository already ignores `.env`, `node_modules`, `.next`, the SQLite
database, `public/uploads`, and `*.zip`, so none of that gets published.

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

Make the repository **private** — the code contains client and workspace logic.

---

## 3. Import into Vercel

1. <https://vercel.com/new> → import the GitHub repository.
2. Framework preset: **Next.js**. Leave build and output settings at defaults —
   `prisma generate` runs automatically via the `postinstall` script.
3. Add every variable below under **Settings → Environment Variables**, then
   deploy.

### Environment variables

Copy the values from your local `.env`.

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Supabase **transaction** pooler, port **6543**, must keep `?pgbouncer=true` |
| `DIRECT_URL` | Supabase **session** pooler, port **5432** (migrations only) |
| `NEXT_PUBLIC_SUPABASE_URL` | From step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | From step 1 — secret |
| `SUPABASE_STORAGE_BUCKET` | `media` |
| `JWT_SECRET` | Safe to regenerate; doing so logs everyone out |
| `TOKEN_ENCRYPTION_KEY` | **Copy exactly. Do not regenerate.** It decrypts stored OAuth tokens — changing it disconnects every connected social account. |
| `CRON_SECRET` | Must match the GitHub Actions secret in step 5 |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL. Set after the first deploy (step 4). |
| `MAX_UPLOAD_MB` | `4` |
| `MAX_VIDEO_UPLOAD_MB` | `50` |
| `META_GRAPH_API_VERSION` | `v26.0` |
| `LINKEDIN_API_VERSION` | `202607` |
| `ALLOW_DEMO_SOCIAL_CONNECTIONS` | `false` for real use; see step 6 |
| `*_CLIENT_ID` / `*_CLIENT_SECRET` | Per provider, as needed |
| `*_REDIRECT_URI` | Update to the Vercel domain (step 4) |
| `GEOAPIFY_API_KEY` | Optional — location suggestions |
| `OPENAI_API_KEY`, `RESEND_API_KEY` | Optional |

`SOURCE_SQLITE_PATH` is **not** needed — it was only used by the one-time
SQLite → Supabase migration.

---

## 4. Point the app at its own URL

After the first deploy you get a URL like `https://your-app.vercel.app`.

1. Set `NEXT_PUBLIC_APP_URL` to it (no trailing slash).
2. Update each `*_REDIRECT_URI` to match, e.g.
   `https://your-app.vercel.app/api/oauth/instagram/callback`.
3. **Register the exact same URLs in each provider's developer console**
   (Meta, LinkedIn, X, Pinterest). OAuth fails unless they match character for
   character.
4. Redeploy so the new values take effect.

---

## 5. Turn on scheduled publishing

`.github/workflows/scheduler.yml` calls the job endpoints on a timer. In the
GitHub repo, go to **Settings → Secrets and variables → Actions** and add:

- `APP_URL` — your Vercel URL, no trailing slash
- `CRON_SECRET` — the same value as in Vercel

Test it from the **Actions** tab → *SocialFlow scheduler* → **Run workflow**. A
green run means publishing works; a 401 means the two `CRON_SECRET` values
differ.

> GitHub's shortest interval is 5 minutes and runs are best-effort, so a post
> can publish a few minutes late. For tighter timing use cron-job.org (1-minute
> intervals) against the same endpoint, or Vercel Pro's built-in cron.

---

## 6. Before inviting testers

- **Meta app must be in Live mode.** While it is in Development, only people
  listed as app roles can connect an Instagram or Facebook account — testers
  will hit an OAuth error.
- If Meta is not live yet, set `ALLOW_DEMO_SOCIAL_CONNECTIONS=true` so testers
  can exercise the composer, calendar and approvals with fake channels. Set it
  back to `false` afterwards.
- **Old media is already gone.** Every pre-existing media row points at an
  expired Cloudflare tunnel hostname, so those images and videos were
  unreachable before this migration too. New uploads are unaffected.

---

## Watch your Supabase Free limits

- **1 GB** total storage — a handful of videos will consume it
- **5 GB/month** egress — Meta *downloading* your video to publish it counts
- **50 MB** maximum per file

If video becomes the constraint, Cloudflare R2 (10 GB free, no egress fees) is
the usual next step.

---

## Troubleshooting

**`PrismaClientInitializationError` on Vercel** — `DATABASE_URL` must be the
6543 pooler URL with `?pgbouncer=true`. The 5432 URL exhausts connections under
serverless.

**Uploads fail with "…is not set"** — the Supabase Storage variables are missing
in Vercel. They are read at request time, so add them and redeploy.

**Images upload but video fails** — check the file is under 50 MB and that the
bucket's file size limit in Supabase matches `MAX_VIDEO_UPLOAD_MB`.

**Instagram publish fails with a media fetch error** — the bucket is not public.
Re-run `node scripts/setup-supabase-storage.mjs`.

**Scheduled posts never publish** — the GitHub Actions workflow is the only
thing driving publishing. Check the Actions tab for failed runs.

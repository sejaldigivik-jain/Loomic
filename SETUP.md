# SocialFlow — Quick Setup

> **Windows:** Extract the complete ZIP first, then double-click `START-SOCIALFLOW.bat`. Do not run the launcher from inside the ZIP. The updated launcher stays open on errors and opens `http://localhost:3000` automatically.

For a local development environment:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and register a user. SQLite is used locally.

`npm run dev` now performs a safe local preflight automatically: it creates `.env` when missing, generates development-only random secrets, repairs the legacy SQLite path, runs `prisma generate`, and runs `prisma db push`.

If you upgraded an older SocialFlow folder and still see a database or Turbopack error, run:

```bash
npm run repair
npm run dev
```

## Real social connections

Provider cards only become live when their developer credentials are present. Follow **PROVIDER-SETUP.md** for Instagram, Facebook Pages, Threads, LinkedIn, X and Pinterest.

Development-only account placeholders can be enabled with:

```env
ALLOW_DEMO_SOCIAL_CONNECTIONS=true
```

They are labeled as demo connections, have no real OAuth token and cannot publish to social networks. Keep the option `false` in production.

## Production

Use **PRODUCTION-DEPLOYMENT.md**. The included Docker stack uses PostgreSQL, persistent uploads, Caddy HTTPS and a separate scheduler process. Scheduled publishing therefore continues without an open browser.

## First checks

After starting locally, verify registration/login, create a draft, add a media upload, schedule a post, switch workspaces if applicable, and test team approvals. Real provider publishing cannot be validated until you supply that provider's developer credentials and connect an eligible account.

# SocialFlow complete update

This package consolidates the earlier Windows, OAuth, functionality and AI patches into one clean source tree.

## Reliability fixes

- Windows/Node 24-safe Prisma bootstrap (runs Prisma's JS CLI directly instead of spawning npx.cmd).
- Automatic `.env` creation and SQLite `db push` before local development startup.
- React duplicate navbar-key fix.
- Signed-in API requests now share an automatic access-token refresh helper, including Accounts, Composer, AI Studio, Analytics, Dashboard, Settings, Team, uploads and publish actions.
- Composer drafts are preserved when a server write fails.
- Server-side scheduler remains the publishing source of truth for scheduled posts.

## AI fixes

- OpenAI Responses API integration remains server-side.
- GPT-5.6 Luna / Terra / Sol model selection.
- Workspace OpenAI keys are encrypted at rest.
- Built-in Local Assist means AI-related buttons no longer become dead controls when no external API key exists.
- OpenAI failures gracefully fall back during normal generation while the explicit OpenAI test still reports provider errors.
- UI identifies whether output came from OpenAI or Local Assist.

## Real social accounts

Provider credentials are configured under Settings → Integrations. Accounts → Connect starts the real provider OAuth flow. Production connection still requires developer-app credentials/permissions from each social network.

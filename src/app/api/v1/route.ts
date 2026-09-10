/**
 * GET /api/v1 — API health & discovery.
 */
import { ok } from "@/lib/api-utils";

export const runtime = "nodejs";

export function GET() {
  return ok({
    name: "Loomic API",
    version: "1.0.0",
    status: "operational",
    serverTime: new Date().toISOString(),
    endpoints: [
      "/api/v1/auth/register",
      "/api/v1/auth/login",
      "/api/v1/auth/me",
      "/api/v1/posts",
      "/api/v1/posts/:id",
      "/api/v1/accounts",
      "/api/v1/analytics/summary",
      "/api/v1/teams/members",
      "/api/v1/billing/plans",
      "/api/v1/billing/subscription (read-only until billing provider is configured)",
      "/api/v1/ai/caption",
      "/api/v1/ai/hashtag",
    ],
  });
}

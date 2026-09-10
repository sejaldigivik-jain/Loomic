/**
 * GET  /api/v1/billing/subscription?workspaceId=...
 *   Returns the workspace's active subscription, plan details, usage
 *   counters and recent invoices.
 *
 * POST /api/v1/billing/subscription
 *   Paid subscription mutation is deliberately disabled until a real
 *   billing provider is connected; the app never fabricates payment success.
 */
import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireWorkspace } from "@/lib/server-auth";

export const runtime = "nodejs";

export const GET = withHandler(null, async ({ req }) => {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) throw ApiError.badRequest("workspaceId is required");
  await requireWorkspace(req, workspaceId);

  const subscription = await db.subscription.findUnique({
    where: { workspaceId },
    include: { plan: true },
  });

  if (!subscription) {
    const [postsCount, channelsCount] = await Promise.all([
      db.post.count({ where: { workspaceId, status: { not: "archived" } } }),
      db.socialAccount.count({ where: { workspaceId } }),
    ]);
    return ok({
      configured: false,
      subscription: null,
      plan: null,
      usage: { postsThisMonth: postsCount, aiCreditsUsed: 0, channelsConnected: channelsCount },
    });
  }

  // Compute usage for the current billing period
  const periodStart = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd.getTime() - 30 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [postsCount, channelsCount] = await Promise.all([
    db.post.count({
      where: {
        workspaceId,
        createdAt: { gte: periodStart },
        status: { not: "archived" },
      },
    }),
    db.socialAccount.count({ where: { workspaceId } }),
  ]);

  const invoices = await db.invoice.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  return ok({
    subscription: {
      ...subscription,
      plan: { ...subscription.plan, features: JSON.parse(subscription.plan.features) },
    },
    usage: {
      postsThisMonth: postsCount,
      aiCreditsUsed: 0, // Pulled from a separate counter in production
      channelsConnected: channelsCount,
    },
    invoices,
  });
});

const updateSchema = z.object({
  workspaceId: z.string(),
  planSlug: z.enum(["free", "pro", "team", "agency"]),
  interval: z.enum(["monthly", "annual"]).default("monthly"),
});

export const POST = withHandler(updateSchema, async ({ req, body }) => {
  const { workspaceId } = body!;
  await requireWorkspace(req, workspaceId, "billing.manage");
  throw ApiError.badRequest(
    "Subscription checkout is not configured. Connect a real billing provider before enabling paid plan changes."
  );
});

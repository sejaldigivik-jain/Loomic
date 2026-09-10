/**
 * GET /api/v1/billing/plans
 *
 * Billing checkout is intentionally disabled until a real payment provider
 * is connected. We return only plans that an operator has explicitly seeded
 * into the database; the API never invents prices or entitlements.
 */
import { db } from "@/lib/db";
import { withHandler, ok } from "@/lib/api-utils";

export const runtime = "nodejs";

export const GET = withHandler(null, async () => {
  const plans = await db.plan.findMany({ orderBy: { sortOrder: "asc" } });
  return ok({
    configured: false,
    plans: plans.map((p) => ({
      ...p,
      features: JSON.parse(p.features),
    })),
  });
});

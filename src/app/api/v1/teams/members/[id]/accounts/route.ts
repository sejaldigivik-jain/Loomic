import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireWorkspace } from "@/lib/server-auth";

export const runtime = "nodejs";

const schema = z.object({
  accountIds: z.array(z.string()).default([]),
});

/** Owner-only bulk replacement of a member's connected-account/client assignments. */
export const PUT = withHandler(schema, async ({ req, ctx, body }) => {
  const membershipId = String(ctx.params.id);
  const membership = await db.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, userId: true, workspaceId: true, role: true },
  });
  if (!membership) throw ApiError.notFound("Team member not found");

  const auth = await requireWorkspace(req, membership.workspaceId);
  if (auth.role !== "owner") {
    throw ApiError.forbidden("Only the workspace owner can change client assignments");
  }
  if (membership.role === "owner") {
    throw ApiError.badRequest("The owner already has access to every connected account");
  }

  const accountIds = Array.from(new Set(body!.accountIds));
  if (accountIds.length) {
    const count = await db.socialAccount.count({
      where: { workspaceId: membership.workspaceId, id: { in: accountIds } },
    });
    if (count !== accountIds.length) throw ApiError.badRequest("One or more selected clients/accounts are invalid");
  }

  await db.$transaction(async (tx) => {
    await tx.accountAssignment.deleteMany({
      where: { userId: membership.userId, socialAccount: { workspaceId: membership.workspaceId } },
    });
    if (accountIds.length) {
      await tx.accountAssignment.createMany({
        data: accountIds.map((socialAccountId) => ({ socialAccountId, userId: membership.userId })),
      });
    }
  });

  return ok({ membershipId, userId: membership.userId, accountIds });
});

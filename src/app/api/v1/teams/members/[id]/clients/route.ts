import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireWorkspace } from "@/lib/server-auth";

export const runtime = "nodejs";

const schema = z.object({
  clientIds: z.array(z.string()).default([]),
});

/** Owner-only bulk replacement of one member's assigned clients. */
export const PUT = withHandler(schema, async ({ req, ctx, body }) => {
  const membershipId = String(ctx.params.id);
  const membership = await db.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, userId: true, workspaceId: true, role: true },
  });
  if (!membership) throw ApiError.notFound("Team member not found");

  const auth = await requireWorkspace(req, membership.workspaceId);
  if (auth.role !== "owner") {
    throw ApiError.forbidden("Only the workspace owner can replace a member's client assignments");
  }

  const clientIds = Array.from(new Set(body!.clientIds));
  if (clientIds.length) {
    const count = await db.client.count({
      where: { workspaceId: membership.workspaceId, id: { in: clientIds } },
    });
    if (count !== clientIds.length) throw ApiError.badRequest("One or more selected clients are invalid");
  }

  await db.$transaction(async (tx) => {
    await tx.clientAssignment.deleteMany({
      where: { userId: membership.userId, client: { workspaceId: membership.workspaceId } },
    });
    if (clientIds.length) {
      await tx.clientAssignment.createMany({
        data: clientIds.map((clientId) => ({ clientId, userId: membership.userId })),
      });
    }
  });

  return ok({ membershipId, userId: membership.userId, clientIds });
});

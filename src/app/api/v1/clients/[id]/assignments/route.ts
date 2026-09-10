import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireWorkspace } from "@/lib/server-auth";
import { assertClientAccess, canSeeAllClients } from "@/lib/client-access";

export const runtime = "nodejs";

const schema = z.object({
  userIds: z.array(z.string()).default([]),
  socialAccountIds: z.array(z.string()).default([]),
});

export const PUT = withHandler(schema, async ({ req, ctx, body }) => {
  const id = String(ctx.params.id);
  const client = await db.client.findUnique({ where: { id } });
  if (!client) throw ApiError.notFound("Client not found");
  const auth = await requireWorkspace(req, client.workspaceId, "client.manage");
  await assertClientAccess({ workspaceId: client.workspaceId, userId: auth.userId, role: auth.role, clientId: id });

  const userIds = Array.from(new Set(body!.userIds));
  const accountIds = Array.from(new Set(body!.socialAccountIds));

  if (userIds.length) {
    const count = await db.membership.count({
      where: { workspaceId: client.workspaceId, userId: { in: userIds } },
    });
    if (count !== userIds.length) throw ApiError.badRequest("One or more selected team members are invalid");
  }

  if (accountIds.length) {
    const accounts = await db.socialAccount.findMany({
      where: { workspaceId: client.workspaceId, id: { in: accountIds } },
      select: { id: true, clientId: true },
    });
    if (accounts.length !== accountIds.length) {
      throw ApiError.badRequest("One or more selected social accounts are invalid");
    }
    if (!canSeeAllClients(auth.role) && accounts.some((account) => account.clientId && account.clientId !== id)) {
      throw ApiError.forbidden("Managers cannot take an account away from another client");
    }
  }

  await db.$transaction(async (tx) => {
    await tx.clientAssignment.deleteMany({ where: { clientId: id } });
    if (userIds.length) {
      await tx.clientAssignment.createMany({
        data: userIds.map((userId) => ({ clientId: id, userId })),
      });
    }

    await tx.socialAccount.updateMany({
      where: { clientId: id, id: { notIn: accountIds } },
      data: { clientId: null },
    });
    // If a post no longer targets any account belonging to this client,
    // clear its clientId rather than leaving a stale authorization link.
    await tx.post.updateMany({
      where: {
        workspaceId: client.workspaceId,
        clientId: id,
        targets: { none: { socialAccount: { clientId: id } } },
      },
      data: { clientId: null },
    });
    if (accountIds.length) {
      await tx.socialAccount.updateMany({
        where: { id: { in: accountIds }, workspaceId: client.workspaceId },
        data: { clientId: id },
      });
      await tx.post.updateMany({
        where: {
          workspaceId: client.workspaceId,
          targets: { some: { socialAccountId: { in: accountIds } } },
        },
        data: { clientId: id },
      });
    }
  });

  return ok({ clientId: id, userIds, socialAccountIds: accountIds });
});

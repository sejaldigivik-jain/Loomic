import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireWorkspace } from "@/lib/server-auth";

export const runtime = "nodejs";

const updateMemberSchema = z.object({
  role: z.enum(["owner", "admin", "editor", "contributor", "viewer"]),
});

export const PATCH = withHandler(updateMemberSchema, async ({ req, ctx, body }) => {
  const id = ctx.params.id as string;
  const membership = await db.membership.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!membership) throw ApiError.notFound("Team member not found");

  const auth = await requireWorkspace(req, membership.workspaceId, "team.invite");
  const nextRole = body!.role;

  if (membership.role === "owner" && nextRole !== "owner") {
    throw ApiError.badRequest("Transfer ownership to another member before changing the owner role");
  }

  if (nextRole === "owner") {
    if (auth.role !== "owner") throw ApiError.forbidden("Only the workspace owner can transfer ownership");
    if (membership.userId === auth.userId) return ok({ member: membership });

    const result = await db.$transaction(async (tx) => {
      await tx.membership.updateMany({
        where: { workspaceId: membership.workspaceId, role: "owner" },
        data: { role: "admin" },
      });
      return tx.membership.update({ where: { id }, data: { role: "owner" } });
    });
    return ok({ member: result, ownershipTransferred: true });
  }

  const updated = await db.membership.update({
    where: { id },
    data: { role: nextRole },
  });
  return ok({ member: updated });
});

export const DELETE = withHandler(null, async ({ req, ctx }) => {
  const id = ctx.params.id as string;
  const membership = await db.membership.findUnique({ where: { id } });
  if (!membership) throw ApiError.notFound("Team member not found");

  const auth = await requireWorkspace(req, membership.workspaceId, "team.remove");
  if (membership.role === "owner") throw ApiError.badRequest("Transfer ownership before removing the owner");
  if (membership.userId === auth.userId) throw ApiError.badRequest("You cannot remove yourself from this workspace");

  await db.$transaction(async (tx) => {
    await tx.accountAssignment.deleteMany({
      where: { userId: membership.userId, socialAccount: { workspaceId: membership.workspaceId } },
    });
    await tx.membership.delete({ where: { id } });
  });
  return ok({ removed: true });
});

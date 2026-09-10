import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireUser } from "@/lib/server-auth";

export const runtime = "nodejs";

export const POST = withHandler(null, async ({ req, ctx }) => {
  const auth = requireUser(req);
  const token = String(ctx.params.token);
  const invitation = await db.invitation.findUnique({ where: { token } });
  if (!invitation) throw ApiError.notFound("Invitation not found");
  if (invitation.status !== "pending") throw ApiError.badRequest(`Invitation is ${invitation.status}`);
  if (invitation.expiresAt < new Date()) {
    await db.invitation.update({ where: { id: invitation.id }, data: { status: "expired" } });
    throw ApiError.badRequest("Invitation has expired");
  }
  if (invitation.email.toLowerCase() !== auth.email.toLowerCase()) {
    throw ApiError.forbidden(`This invitation is for ${invitation.email}`);
  }

  await db.$transaction(async (tx) => {
    await tx.membership.updateMany({ where: { userId: auth.userId }, data: { isActive: false } });
    await tx.membership.upsert({
      where: { userId_workspaceId: { userId: auth.userId, workspaceId: invitation.workspaceId } },
      update: { role: invitation.role, isActive: true },
      create: { userId: auth.userId, workspaceId: invitation.workspaceId, role: invitation.role, isActive: true },
    });
    await tx.user.update({ where: { id: auth.userId }, data: { defaultWorkspaceId: invitation.workspaceId } });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "accepted", acceptedAt: new Date() },
    });
  });

  return ok({ workspaceId: invitation.workspaceId, role: invitation.role });
});

import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";

export const runtime = "nodejs";

export const GET = withHandler(null, async ({ ctx }) => {
  const token = String(ctx.params.token);
  const invitation = await db.invitation.findUnique({
    where: { token },
    include: { workspace: { select: { id: true, name: true } } },
  });
  if (!invitation) throw ApiError.notFound("Invitation not found");
  const expired = invitation.expiresAt < new Date();
  return ok({
    email: invitation.email,
    role: invitation.role,
    workspace: invitation.workspace,
    status: expired && invitation.status === "pending" ? "expired" : invitation.status,
    expiresAt: invitation.expiresAt,
  });
});

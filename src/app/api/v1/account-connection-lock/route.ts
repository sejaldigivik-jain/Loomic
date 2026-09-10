import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireWorkspace } from "@/lib/server-auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export const GET = withHandler(null, async ({ req }) => {
  const workspaceId = new URL(req.url).searchParams.get("workspaceId");
  if (!workspaceId) throw ApiError.badRequest("workspaceId is required");
  const auth = await requireWorkspace(req, workspaceId);
  const lock = await db.accountConnectionLock.findUnique({
    where: { workspaceId },
    select: { setAt: true },
  });

  return ok({
    workspaceId,
    configured: Boolean(lock),
    setAt: lock?.setAt ?? null,
    canManage: auth.role === "owner",
  });
});

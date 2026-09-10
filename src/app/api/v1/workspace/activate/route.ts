import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok } from "@/lib/api-utils";
import { requireWorkspace } from "@/lib/server-auth";

export const runtime = "nodejs";

const schema = z.object({ workspaceId: z.string() });

export const POST = withHandler(schema, async ({ req, body }) => {
  const auth = await requireWorkspace(req, body!.workspaceId);
  await db.$transaction([
    db.membership.updateMany({ where: { userId: auth.userId }, data: { isActive: false } }),
    db.membership.update({
      where: { userId_workspaceId: { userId: auth.userId, workspaceId: body!.workspaceId } },
      data: { isActive: true },
    }),
    db.user.update({ where: { id: auth.userId }, data: { defaultWorkspaceId: body!.workspaceId } }),
  ]);
  return ok({ workspaceId: body!.workspaceId });
});

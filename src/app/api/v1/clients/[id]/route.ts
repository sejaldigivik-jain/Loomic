import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireWorkspace } from "@/lib/server-auth";
import { assertClientAccess } from "@/lib/client-access";

export const runtime = "nodejs";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  notes: z.string().max(1000).nullable().optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export const PATCH = withHandler(patchSchema, async ({ req, ctx, body }) => {
  const id = String(ctx.params.id);
  const client = await db.client.findUnique({ where: { id } });
  if (!client) throw ApiError.notFound("Client not found");
  const auth = await requireWorkspace(req, client.workspaceId, "client.manage");
  await assertClientAccess({ workspaceId: client.workspaceId, userId: auth.userId, role: auth.role, clientId: id });
  const updated = await db.client.update({ where: { id }, data: body! });
  return ok(updated);
});

// Archive instead of hard-delete so existing post/account history remains intact.
export const DELETE = withHandler(null, async ({ req, ctx }) => {
  const id = String(ctx.params.id);
  const client = await db.client.findUnique({ where: { id } });
  if (!client) throw ApiError.notFound("Client not found");
  const auth = await requireWorkspace(req, client.workspaceId, "client.manage");
  await assertClientAccess({ workspaceId: client.workspaceId, userId: auth.userId, role: auth.role, clientId: id });
  const archived = await db.client.update({ where: { id }, data: { status: "archived" } });
  return ok({ id: archived.id, status: archived.status });
});

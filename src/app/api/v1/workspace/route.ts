import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireUser, requireWorkspace } from "@/lib/server-auth";

export const runtime = "nodejs";

async function resolveWorkspace(req: Request, requestedId?: string | null) {
  if (requestedId) {
    const auth = await requireWorkspace(req, requestedId);
    const workspace = await db.workspace.findUnique({ where: { id: requestedId } });
    if (!workspace) throw ApiError.notFound("Workspace not found");
    return { auth, workspace };
  }

  const auth = requireUser(req);
  const user = await db.user.findUnique({
    where: { id: auth.userId },
    include: { memberships: { include: { workspace: true } } },
  });
  if (!user) throw ApiError.notFound("User not found");
  const membership = user.memberships.find((m) => m.isActive)
    ?? user.memberships.find((m) => m.workspaceId === user.defaultWorkspaceId)
    ?? user.memberships[0];
  if (!membership) throw ApiError.notFound("No workspace found");
  return { auth: { ...auth, workspaceId: membership.workspaceId, role: membership.role }, workspace: membership.workspace };
}

export const GET = withHandler(null, async ({ req }) => {
  const workspaceId = new URL(req.url).searchParams.get("workspaceId");
  const { auth, workspace } = await resolveWorkspace(req, workspaceId);
  return ok({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      logoUrl: workspace.logoUrl,
      timezone: workspace.timezone,
      customDomain: workspace.customDomain ?? "",
      role: auth.role,
    },
  });
});

const patchSchema = z.object({
  workspaceId: z.string().optional(),
  name: z.string().min(1).max(80).optional(),
  timezone: z.string().min(1).max(80).optional(),
  customDomain: z.string().max(200).nullable().optional(),
});

export const PATCH = withHandler(patchSchema, async ({ req, body }) => {
  const queryId = new URL(req.url).searchParams.get("workspaceId");
  const targetId = body!.workspaceId ?? queryId;
  const resolved = await resolveWorkspace(req, targetId);
  const workspaceId = resolved.workspace.id;
  await requireWorkspace(req, workspaceId, "workspace.update");

  const updated = await db.workspace.update({
    where: { id: workspaceId },
    data: {
      ...(body!.name !== undefined ? { name: body!.name } : {}),
      ...(body!.timezone !== undefined ? { timezone: body!.timezone } : {}),
      ...(body!.customDomain !== undefined ? { customDomain: body!.customDomain || null } : {}),
    },
  });

  return ok({
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    timezone: updated.timezone,
    customDomain: updated.customDomain ?? "",
  });
});

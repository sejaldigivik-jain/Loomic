import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireWorkspace } from "@/lib/server-auth";
import { canManageClients, resolveClientScope } from "@/lib/client-access";

export const runtime = "nodejs";

export const GET = withHandler(null, async ({ req }) => {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) throw ApiError.badRequest("workspaceId is required");
  const auth = await requireWorkspace(req, workspaceId);
  const requestedMemberId = url.searchParams.get("memberId");
  const requestedClientId = url.searchParams.get("clientId");
  const scope = await resolveClientScope({
    workspaceId,
    userId: auth.userId,
    role: auth.role,
    requestedMemberId,
    requestedClientId,
  });

  const clients = await db.client.findMany({
    where: { workspaceId, ...(scope ? { id: { in: scope } } : {}) },
    include: {
      assignments: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
      socialAccounts: { select: { id: true, platform: true, handle: true, displayName: true, status: true } },
      _count: { select: { posts: true } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  return ok(clients.map((client) => ({
    id: client.id,
    name: client.name,
    notes: client.notes,
    status: client.status,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
    members: client.assignments.map((a) => ({
      userId: a.user.id,
      name: a.user.name,
      email: a.user.email,
      image: a.user.image,
    })),
    accounts: client.socialAccounts,
    postCount: client._count.posts,
    canManage: canManageClients(auth.role),
  })));
});

const createSchema = z.object({
  workspaceId: z.string(),
  name: z.string().trim().min(1).max(120),
  notes: z.string().max(1000).optional(),
});

export const POST = withHandler(createSchema, async ({ req, body }) => {
  const { workspaceId, name, notes } = body!;
  const auth = await requireWorkspace(req, workspaceId, "client.manage");
  const duplicate = await db.client.findFirst({ where: { workspaceId, name } });
  if (duplicate) throw ApiError.conflict("A client with this name already exists");

  const client = await db.$transaction(async (tx) => {
    const created = await tx.client.create({
      data: { workspaceId, name, notes: notes?.trim() || null },
    });
    // Existing Admin is the Manager-equivalent role. Managers only work on
    // assigned clients, so a client they create is assigned to them immediately.
    if (auth.role !== "owner") {
      await tx.clientAssignment.create({ data: { clientId: created.id, userId: auth.userId } });
    }
    return created;
  });

  return ok(client, {}, 201);
});

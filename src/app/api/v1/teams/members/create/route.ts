import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireWorkspace } from "@/lib/server-auth";
import { hashPassword } from "@/lib/auth";

export const runtime = "nodejs";

const schema = z.object({
  workspaceId: z.string(),
  name: z.string().trim().min(1).max(80),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
  role: z.enum(["admin", "editor", "contributor", "viewer"]).default("editor"),
  accountIds: z.array(z.string()).default([]),
});

/**
 * Owner-created team login. This does not create another workspace.
 * The new user joins the owner's agency workspace and is scoped to the
 * connected accounts selected in accountIds.
 */
export const POST = withHandler(schema, async ({ req, body }) => {
  const { workspaceId, name, email, password, role } = body!;
  const accountIds = Array.from(new Set(body!.accountIds));
  const auth = await requireWorkspace(req, workspaceId);
  if (auth.role !== "owner") throw ApiError.forbidden("Only the workspace owner can create team logins");

  if (accountIds.length) {
    const count = await db.socialAccount.count({ where: { workspaceId, id: { in: accountIds } } });
    if (count !== accountIds.length) throw ApiError.badRequest("One or more selected clients/accounts are invalid");
  }

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    throw ApiError.conflict("A Loomic user with this email already exists. Use Invite by email for an existing user.");
  }

  const passwordHash = await hashPassword(password);
  const result = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        defaultWorkspaceId: workspaceId,
        onboardingState: "completed",
      },
    });

    const membership = await tx.membership.create({
      data: { userId: user.id, workspaceId, role, isActive: true },
    });

    if (accountIds.length) {
      await tx.accountAssignment.createMany({
        data: accountIds.map((socialAccountId) => ({ socialAccountId, userId: user.id })),
      });
    }

    return { user, membership };
  });

  return ok({
    member: {
      id: result.membership.id,
      userId: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: result.membership.role,
      assignedAccountIds: accountIds,
    },
  }, {}, 201);
});

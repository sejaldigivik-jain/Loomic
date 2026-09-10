import { z } from "zod";
import { Prisma } from "@prisma/client";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireWorkspace } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { issueAccountConnectionGrant } from "@/lib/account-connection-lock";

export const runtime = "nodejs";

const schema = z.object({
  workspaceId: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const POST = withHandler(schema, async ({ req, body }) => {
  const { workspaceId, password } = body!;
  const auth = await requireWorkspace(req, workspaceId);
  if (auth.role !== "owner") {
    throw ApiError.forbidden("Only the workspace owner can set the permanent account connection password");
  }

  const existing = await db.accountConnectionLock.findUnique({ where: { workspaceId } });
  if (existing) {
    throw ApiError.conflict("The account connection password has already been set permanently and cannot be changed in Loomic");
  }

  const passwordHash = await hashPassword(password);
  try {
    await db.accountConnectionLock.create({
      data: { workspaceId, passwordHash, setByUserId: auth.userId },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw ApiError.conflict("The account connection password has already been set permanently and cannot be changed in Loomic");
    }
    throw error;
  }

  const grant = await issueAccountConnectionGrant(workspaceId, auth.userId);
  return ok({ configured: true, grant: grant.id, expiresAt: grant.expiresAt }, {}, 201);
});

import { z } from "zod";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireWorkspace } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { issueAccountConnectionGrant } from "@/lib/account-connection-lock";

export const runtime = "nodejs";

const schema = z.object({
  workspaceId: z.string().min(1),
  password: z.string().min(1).max(128),
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

export const POST = withHandler(schema, async ({ req, body }) => {
  const { workspaceId, password } = body!;
  const auth = await requireWorkspace(req, workspaceId);
  if (auth.role !== "owner") {
    throw ApiError.forbidden("Only the workspace owner can unlock account connections");
  }

  const lock = await db.accountConnectionLock.findUnique({ where: { workspaceId } });
  if (!lock) {
    throw ApiError.conflict("Set the permanent account connection password first");
  }

  const now = Date.now();
  if (lock.lockedUntil && lock.lockedUntil.getTime() > now) {
    const retryAfter = Math.max(1, Math.ceil((lock.lockedUntil.getTime() - now) / 1000));
    throw ApiError.rateLimited("Too many incorrect passwords. Try again later.", retryAfter);
  }

  const valid = await verifyPassword(password, lock.passwordHash);
  if (!valid) {
    const inWindow = Boolean(lock.lastFailedAt && now - lock.lastFailedAt.getTime() <= FAILURE_WINDOW_MS);
    const failedAttempts = (inWindow ? lock.failedAttempts : 0) + 1;
    const lockedUntil = failedAttempts >= MAX_FAILED_ATTEMPTS ? new Date(now + LOCKOUT_MS) : null;
    await db.accountConnectionLock.update({
      where: { workspaceId },
      data: {
        failedAttempts: lockedUntil ? 0 : failedAttempts,
        lastFailedAt: new Date(now),
        lockedUntil,
      },
    });
    if (lockedUntil) {
      throw ApiError.rateLimited("Too many incorrect passwords. Account connections are locked for 15 minutes.", 15 * 60);
    }
    throw ApiError.forbidden("Incorrect account connection password");
  }

  await db.accountConnectionLock.update({
    where: { workspaceId },
    data: { failedAttempts: 0, lastFailedAt: null, lockedUntil: null },
  });
  const grant = await issueAccountConnectionGrant(workspaceId, auth.userId);
  return ok({ grant: grant.id, expiresAt: grant.expiresAt });
});

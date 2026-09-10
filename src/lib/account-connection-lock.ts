import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-utils";

const GRANT_HEADER = "x-account-connect-grant";
const GRANT_TTL_MS = 5 * 60 * 1000;

export function readAccountConnectionGrant(req: Request): string | null {
  const value = req.headers.get(GRANT_HEADER)?.trim();
  return value || null;
}

export async function issueAccountConnectionGrant(workspaceId: string, userId: string) {
  const now = new Date();
  await db.accountConnectionGrant.deleteMany({
    where: {
      workspaceId,
      OR: [{ userId }, { expiresAt: { lte: now } }],
    },
  });

  const id = randomBytes(32).toString("hex");
  const grant = await db.accountConnectionGrant.create({
    data: {
      id,
      workspaceId,
      userId,
      expiresAt: new Date(Date.now() + GRANT_TTL_MS),
    },
  });
  return { id: grant.id, expiresAt: grant.expiresAt };
}

/**
 * Atomically consumes a one-use account connection grant. The grant is bound
 * to both the authenticated user and workspace, expires after five minutes,
 * and is deleted on first use so it cannot be replayed.
 */
export async function consumeAccountConnectionGrant(
  req: Request,
  workspaceId: string,
  userId: string
) {
  const configured = await db.accountConnectionLock.findUnique({
    where: { workspaceId },
    select: { workspaceId: true },
  });
  if (!configured) {
    throw ApiError.forbidden("Account connection is locked. The workspace owner must set the permanent connection password first.");
  }

  const grantId = readAccountConnectionGrant(req);
  if (!grantId) {
    throw ApiError.forbidden("Account connection is locked. Unlock it with the permanent owner password first.");
  }

  const result = await db.accountConnectionGrant.deleteMany({
    where: {
      id: grantId,
      workspaceId,
      userId,
      expiresAt: { gt: new Date() },
    },
  });
  if (result.count !== 1) {
    throw ApiError.forbidden("This account connection unlock has expired or was already used. Unlock again.");
  }
}

export async function revokeAccountConnectionGrant(
  workspaceId: string,
  userId: string,
  grantId?: string | null
) {
  if (!grantId) return;
  await db.accountConnectionGrant.deleteMany({
    where: { id: grantId, workspaceId, userId },
  });
}

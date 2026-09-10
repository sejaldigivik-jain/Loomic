import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-utils";
import type { Role } from "@/lib/auth";

/** Only the workspace owner gets unrestricted agency visibility. */
export function canSeeAllAccounts(role: Role | string | undefined) {
  return role === "owner";
}

export async function assignedAccountIds(workspaceId: string, userId: string): Promise<string[]> {
  const rows = await db.accountAssignment.findMany({
    where: { userId, socialAccount: { workspaceId } },
    select: { socialAccountId: true },
  });
  return rows.map((row) => row.socialAccountId);
}

/**
 * Resolve the account/client scope for an API request.
 * In this agency workflow a connected SocialAccount is the Client.
 *
 * Owner:
 *   - no filters => unrestricted (null)
 *   - member filter => that member's assigned accounts
 *   - account filter => that one connected account
 * Team member:
 *   - always restricted to accounts assigned to their user id
 */
export async function resolveAccountScope(input: {
  workspaceId: string;
  userId: string;
  role: Role | string | undefined;
  requestedMemberId?: string | null;
  requestedAccountId?: string | null;
}): Promise<string[] | null> {
  const { workspaceId, userId, role, requestedMemberId, requestedAccountId } = input;
  const owner = canSeeAllAccounts(role);

  if (!owner && requestedMemberId && requestedMemberId !== userId) {
    throw ApiError.forbidden("You cannot view another team member's clients");
  }

  let ids: string[] | null = null;
  if (owner) {
    if (requestedMemberId) {
      const membership = await db.membership.findUnique({
        where: { userId_workspaceId: { userId: requestedMemberId, workspaceId } },
        select: { userId: true },
      });
      if (!membership) throw ApiError.badRequest("Selected team member is not in this workspace");
      ids = await assignedAccountIds(workspaceId, requestedMemberId);
    }
  } else {
    ids = await assignedAccountIds(workspaceId, userId);
  }

  if (requestedAccountId) {
    const account = await db.socialAccount.findFirst({
      where: { id: requestedAccountId, workspaceId },
      select: { id: true },
    });
    if (!account) throw ApiError.badRequest("Selected client/account is not in this workspace");
    if (ids && !ids.includes(requestedAccountId)) {
      throw ApiError.forbidden("You do not have access to this client/account");
    }
    ids = [requestedAccountId];
  }

  return ids;
}

export async function assertAccountAccess(input: {
  workspaceId: string;
  userId: string;
  role: Role | string | undefined;
  accountId: string;
}) {
  if (canSeeAllAccounts(input.role)) return;
  const ids = await assignedAccountIds(input.workspaceId, input.userId);
  if (!ids.includes(input.accountId)) {
    throw ApiError.forbidden("This client/account is not assigned to your login");
  }
}

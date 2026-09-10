import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-utils";
import type { Role } from "@/lib/auth";

/** Only the workspace owner bypasses agency client assignment restrictions. */
export function canSeeAllClients(role: Role | string | undefined) {
  return role === "owner";
}

/** Existing admin is the Manager-equivalent role for client/team management. */
export function canManageClients(role: Role | string | undefined) {
  return role === "owner" || role === "admin";
}

export async function assignedClientIds(workspaceId: string, userId: string): Promise<string[]> {
  const rows = await db.clientAssignment.findMany({
    where: { userId, client: { workspaceId } },
    select: { clientId: true },
  });
  return rows.map((row) => row.clientId);
}

/**
 * Resolve the server-side client scope for a request.
 *
 * - Owner: null means unrestricted; may filter by any member/client.
 * - Everyone else: always restricted to their assigned clients.
 * - A manually supplied unauthorized member/client id is rejected, not ignored.
 */
export async function resolveClientScope(input: {
  workspaceId: string;
  userId: string;
  role: Role | string | undefined;
  requestedMemberId?: string | null;
  requestedClientId?: string | null;
}): Promise<string[] | null> {
  const { workspaceId, userId, role, requestedMemberId, requestedClientId } = input;
  const owner = canSeeAllClients(role);

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
      ids = await assignedClientIds(workspaceId, requestedMemberId);
    }
  } else {
    ids = await assignedClientIds(workspaceId, userId);
  }

  if (requestedClientId) {
    const client = await db.client.findFirst({
      where: { id: requestedClientId, workspaceId },
      select: { id: true },
    });
    if (!client) throw ApiError.badRequest("Selected client is not in this workspace");
    if (ids && !ids.includes(requestedClientId)) {
      throw ApiError.forbidden("You do not have access to this client");
    }
    ids = [requestedClientId];
  }

  return ids;
}

export async function assertClientAccess(input: {
  workspaceId: string;
  userId: string;
  role: Role | string | undefined;
  clientId: string | null | undefined;
}) {
  if (canSeeAllClients(input.role)) return;
  if (!input.clientId) {
    throw ApiError.forbidden("This item is not assigned to one of your clients");
  }
  const ids = await assignedClientIds(input.workspaceId, input.userId);
  if (!ids.includes(input.clientId)) {
    throw ApiError.forbidden("You do not have access to this client");
  }
}

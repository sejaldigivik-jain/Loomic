import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-utils";
import {
  can,
  getBearerToken,
  hashApiToken,
  verifyToken,
  type AccessTokenPayload,
  type Permission,
  type Role,
} from "@/lib/auth";
import { assertAccountAccess, assignedAccountIds, canSeeAllAccounts } from "@/lib/account-access";

export interface AuthContext {
  userId: string;
  email: string;
  workspaceId?: string;
  role?: Role;
}

export function requireUser(req: Request): AuthContext {
  const token = getBearerToken(req);
  if (!token) throw ApiError.unauthorized("Missing bearer token");
  const payload = verifyToken<AccessTokenPayload>(token);
  if (!payload || payload.type !== "access") {
    throw ApiError.unauthorized("Invalid or expired access token");
  }
  return {
    userId: payload.sub,
    email: payload.email,
    workspaceId: payload.workspaceId,
    role: payload.role as Role | undefined,
  };
}

export async function requireWorkspace(
  req: Request,
  workspaceId: string,
  permission?: Permission
): Promise<AuthContext & { workspaceId: string; role: Role }> {
  const bearer = getBearerToken(req);

  // Personal API tokens use the sflow_ prefix. They are hashed at rest and
  // inherit the user's workspace membership while their token scope adds an
  // additional ceiling (read < write < admin).
  if (bearer?.startsWith("sflow_")) {
    const apiToken = await db.apiToken.findUnique({
      where: { tokenHash: hashApiToken(bearer) },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!apiToken || apiToken.revokedAt || (apiToken.expiresAt && apiToken.expiresAt < new Date())) {
      throw ApiError.unauthorized("Invalid, expired or revoked API token");
    }

    const membership = await db.membership.findUnique({
      where: { userId_workspaceId: { userId: apiToken.userId, workspaceId } },
      select: { role: true },
    });
    if (!membership) throw ApiError.forbidden("API token owner does not have access to this workspace");

    const privileged = new Set<Permission>([
      "account.connect", "account.disconnect", "team.invite", "team.remove", "client.manage", "billing.manage", "workspace.update", "workspace.delete",
    ]);
    if (permission) {
      if (apiToken.scopes === "read") throw ApiError.forbidden("This API token is read-only");
      if (privileged.has(permission) && apiToken.scopes !== "admin") {
        throw ApiError.forbidden("This action requires an admin-scoped API token");
      }
    }

    const role = membership.role as Role;
    if (permission && !can(role, permission)) {
      throw ApiError.forbidden("The token owner's workspace role does not allow this action");
    }
    void db.apiToken.update({ where: { id: apiToken.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
    return { userId: apiToken.user.id, email: apiToken.user.email, workspaceId, role };
  }

  const auth = requireUser(req);
  const membership = await db.membership.findUnique({
    where: { userId_workspaceId: { userId: auth.userId, workspaceId } },
    select: { role: true },
  });
  if (!membership) throw ApiError.forbidden("You do not have access to this workspace");
  const role = membership.role as Role;
  if (permission && !can(role, permission)) {
    throw ApiError.forbidden("Your workspace role does not allow this action");
  }
  return { ...auth, workspaceId, role };
}

export async function requirePostAccess(
  req: Request,
  postId: string,
  permission?: Permission
) {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: { id: true, workspaceId: true, authorId: true, targets: { select: { socialAccountId: true } } },
  });
  if (!post) throw ApiError.notFound("Post not found");
  const auth = await requireWorkspace(req, post.workspaceId, permission);
  if (!canSeeAllAccounts(auth.role)) {
    const ids = await assignedAccountIds(post.workspaceId, auth.userId);
    const allowed = post.targets.length > 0 && post.targets.every((target) => ids.includes(target.socialAccountId));
    if (!allowed) throw ApiError.forbidden("You do not have access to this client's post");
  }
  return { auth, post };
}

export async function requireAccountAccess(
  req: Request,
  accountId: string,
  permission?: Permission
) {
  const account = await db.socialAccount.findUnique({
    where: { id: accountId },
    select: { id: true, workspaceId: true },
  });
  if (!account) throw ApiError.notFound("Social account not found");
  const auth = await requireWorkspace(req, account.workspaceId, permission);
  await assertAccountAccess({ workspaceId: account.workspaceId, userId: auth.userId, role: auth.role, accountId: account.id });
  return { auth, account };
}

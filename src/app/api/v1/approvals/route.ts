import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requirePostAccess, requireWorkspace } from "@/lib/server-auth";
import { resolveAccountScope } from "@/lib/account-access";

export const runtime = "nodejs";

export const GET = withHandler(null, async ({ req }) => {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) throw ApiError.badRequest("workspaceId is required");
  const auth = await requireWorkspace(req, workspaceId);
  const scope = await resolveAccountScope({ workspaceId, userId: auth.userId, role: auth.role });

  const posts = await db.post.findMany({
    where: { workspaceId, approvalState: { in: ["pending", "approved", "rejected", "changes_requested"] },
      ...(scope ? {
        AND: [
          { targets: { some: { socialAccountId: { in: scope } } } },
          { targets: { every: { socialAccountId: { in: scope } } } },
        ],
      } : {}),
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
      comments: true,
      targets: { include: { socialAccount: { select: { platform: true } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return ok(posts.map((p) => ({
    id: p.id,
    postId: p.id,
    postContent: p.content,
    status: p.approvalState,
    requestedAt: p.createdAt,
    resolvedAt: p.approvedAt,
    author: p.author,
    platforms: Array.from(new Set(p.targets.map((t) => t.socialAccount.platform))),
    commentCount: p.comments.length,
  })));
});

const actionSchema = z.object({
  workspaceId: z.string(),
  postId: z.string(),
  action: z.enum(["approve", "reject", "request_changes", "submit"]),
  comment: z.string().max(2000).optional(),
});

export const PATCH = withHandler(actionSchema, async ({ req, body }) => {
  const { workspaceId, postId, action, comment } = body!;
  const access = await requirePostAccess(req, postId, action === "submit" ? "post.create" : "post.publish");
  if (access.post.workspaceId !== workspaceId) throw ApiError.badRequest("Post does not belong to this workspace");
  const auth = access.auth;
  const post = await db.post.findFirst({ where: { id: postId, workspaceId } });
  if (!post) throw ApiError.notFound("Post not found");

  const approvalState = action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "request_changes" ? "changes_requested" : "pending";
  await db.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: {
        approvalState,
        approvedById: action === "approve" ? auth.userId : null,
        approvedAt: action === "approve" ? new Date() : null,
      },
    });
    if (comment?.trim()) {
      await tx.comment.create({ data: { postId, userId: auth.userId, body: comment.trim() } });
    }
    await tx.auditLog.create({
      data: {
        workspaceId,
        userId: auth.userId,
        action: `approval.${action}`,
        targetType: "post",
        targetId: postId,
      },
    });
  });
  return ok({ postId, approvalState });
});

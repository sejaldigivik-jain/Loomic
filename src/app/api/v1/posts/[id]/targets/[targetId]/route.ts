import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requirePostAccess } from "@/lib/server-auth";

const schema = z.object({
  content: z.string().max(5000).nullable().optional(),
  status: z.enum(["pending", "publishing", "published", "failed"]).optional(),
  externalId: z.string().nullable().optional(),
  externalUrl: z.string().url().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
});

export const PATCH = withHandler(schema, async ({ req, ctx, body }) => {
  const postId = String(ctx.params.id);
  const targetId = String(ctx.params.targetId);
  await requirePostAccess(req, postId, "post.publish");
  const target = await db.postTarget.findFirst({ where: { id: targetId, postId } });
  if (!target) throw ApiError.notFound("Post target not found");
  const patch = body!;
  const updated = await db.postTarget.update({
    where: { id: targetId },
    data: {
      ...(patch.content !== undefined ? { content: patch.content } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.externalId !== undefined ? { externalId: patch.externalId } : {}),
      ...(patch.externalUrl !== undefined ? { externalUrl: patch.externalUrl } : {}),
      ...(patch.errorMessage !== undefined ? { errorMessage: patch.errorMessage } : {}),
      ...(patch.publishedAt !== undefined ? { publishedAt: patch.publishedAt ? new Date(patch.publishedAt) : null } : {}),
    },
  });
  return ok(updated);
});

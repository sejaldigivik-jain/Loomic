/**
 * Single-post operations.
 *
 * GET    /api/v1/posts/:id — fetch one post with all relations
 * PATCH  /api/v1/posts/:id — update content / schedule / status / targets
 * DELETE /api/v1/posts/:id — hard delete
 */
import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requirePostAccess } from "@/lib/server-auth";
import { resolveAccountScope } from "@/lib/account-access";

export const runtime = "nodejs";

export const GET = withHandler(null, async ({ req, ctx }) => {
  const id = String(ctx.params.id);
  await requirePostAccess(req, id);
  const post = await db.post.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, email: true, image: true } },
      createdBy: { select: { id: true, name: true, email: true, image: true } },
      client: { select: { id: true, name: true } },
      media: { orderBy: { sortOrder: "asc" } },
      targets: { include: { socialAccount: true } },
      comments: { include: { user: { select: { name: true, image: true } } } },
      analytics: true,
    },
  });
  if (!post) throw ApiError.notFound("Post not found");
  return ok(post);
});

const patchSchema = z.object({
  content: z.string().max(5000).optional(),
  title: z.string().max(200).nullable().optional(),
  status: z.enum(["draft", "scheduled", "published", "failed", "archived"]).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  hashtags: z.array(z.string()).max(30).optional(),
  linkUrl: z.string().url().nullable().optional(),
  instagramOptions: z.object({
    postType: z.enum(["auto", "feed", "reel", "story", "carousel"]).default("auto"),
    shareToFeed: z.boolean().default(true),
    nativeFinish: z.object({
      musicTitle: z.string().max(120).optional(),
      musicArtist: z.string().max(120).optional(),
      location: z.string().max(200).optional(),
      locationId: z.string().max(100).optional(),
      taggedPeople: z.array(z.string().max(100)).max(20).optional(),
      collaborators: z.array(z.string().max(100)).max(10).optional(),
      firstComment: z.string().max(2200).optional(),
      effectsNotes: z.string().max(800).optional(),
    }).optional(),
  }).nullable().optional(),
  approvalState: z.enum(["none", "pending", "approved", "rejected", "changes_requested"]).optional(),
  // Optional: replace targets (replaces all targets if provided). `targets` also
  // preserves Buffer-style per-account caption overrides.
  targetAccountIds: z.array(z.string()).optional(),
  targets: z.array(z.object({
    accountId: z.string(),
    content: z.string().max(5000).nullable().optional(),
  })).optional(),
  // Optional: replace media (replaces all media if provided)
  media: z
    .array(
      z.object({
        type: z.enum(["image", "video"]).default("image"),
        url: z.string().url(),
        altText: z.string().max(280).optional(),
        sortOrder: z.number().int().default(0),
      })
    )
    .optional(),
});

export const PATCH = withHandler(patchSchema, async ({ req, ctx, body }) => {
  const id = String(ctx.params.id);
  const access = await requirePostAccess(req, id, "post.create");
  const patch = body!;

  const existing = await db.post.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Post not found");

  // Build update data (only provided fields)
  const updateData: Record<string, unknown> = {};
  if (patch.content !== undefined) updateData.content = patch.content;
  if (patch.title !== undefined) updateData.title = patch.title;
  if (patch.status !== undefined) updateData.status = patch.status;
  if (patch.scheduledAt !== undefined) {
    updateData.scheduledAt = patch.scheduledAt ? new Date(patch.scheduledAt) : null;
  }
  if (patch.hashtags !== undefined) updateData.hashtags = JSON.stringify(patch.hashtags);
  if (patch.linkUrl !== undefined) updateData.linkUrl = patch.linkUrl;
  if (patch.instagramOptions !== undefined) updateData.aiMeta = patch.instagramOptions ? JSON.stringify({ instagramOptions: patch.instagramOptions }) : null;
  if (patch.approvalState !== undefined) updateData.approvalState = patch.approvalState;

  // If targets are being replaced, verify every account belongs to the post's
  // workspace before touching the existing target rows.
  const replacementTargets = patch.targets !== undefined
    ? patch.targets
    : patch.targetAccountIds !== undefined
      ? patch.targetAccountIds.map((accountId) => ({ accountId, content: null }))
      : undefined;
  if (replacementTargets !== undefined) {
    const ids = Array.from(new Set(replacementTargets.map((target) => target.accountId)));
    if (ids.length !== replacementTargets.length) throw ApiError.badRequest("Duplicate target accounts are not allowed");
    const scope = await resolveAccountScope({ workspaceId: existing.workspaceId, userId: access.auth.userId, role: access.auth.role });
    const allowedIds = scope ? ids.filter((accountId) => scope.includes(accountId)) : ids;
    const accounts = await db.socialAccount.findMany({ where: { id: { in: allowedIds }, workspaceId: existing.workspaceId }, select: { id: true } });
    if (accounts.length !== ids.length) throw ApiError.badRequest("One or more target accounts are invalid or not assigned to you");
    updateData.clientId = null;

    await db.postTarget.deleteMany({ where: { postId: id } });
    updateData.targets = {
      create: replacementTargets.map((target) => ({
        socialAccountId: target.accountId,
        content: target.content?.trim() || null,
      })),
    };
  }

  // If media is being replaced
  if (patch.media !== undefined) {
    await db.media.deleteMany({ where: { postId: id } });
    updateData.media = {
      create: patch.media.map((m) => ({
        type: m.type,
        url: m.url,
        altText: m.altText,
        sortOrder: m.sortOrder,
      })),
    };
  }

  const updated = await db.post.update({
    where: { id },
    data: updateData,
    include: {
      targets: { include: { socialAccount: { select: { id: true, platform: true, handle: true, displayName: true } } } },
      media: true,
      author: { select: { id: true, name: true, email: true, image: true } },
      createdBy: { select: { id: true, name: true, email: true, image: true } },
      client: { select: { id: true, name: true } },
    },
  });

  return ok(updated);
});

export const DELETE = withHandler(null, async ({ req, ctx }) => {
  const id = String(ctx.params.id);
  await requirePostAccess(req, id, "post.delete");
  const existing = await db.post.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Post not found");

  // Hard delete — cascades to targets, media, analytics, comments
  await db.post.delete({ where: { id } });
  return ok({ id, status: "deleted" });
});

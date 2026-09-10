/**
 * Posts API
 *
 * GET  /api/v1/posts          — list posts (paginated, filtered, sorted)
 * POST /api/v1/posts          — create a post (draft / scheduled / published)
 *
 * GET    /api/v1/posts/:id    — fetch a single post
 * PATCH  /api/v1/posts/:id    — update post content / schedule / status
 * DELETE /api/v1/posts/:id    — hard-delete (we don't archive for personal use)
 */
import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError, parsePagination, paginateMeta, parseSort } from "@/lib/api-utils";
import { requireWorkspace } from "@/lib/server-auth";
import { resolveAccountScope } from "@/lib/account-access";

export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*  GET — list with filters                                                    */
/* -------------------------------------------------------------------------- */

export const GET = withHandler(null, async ({ req }) => {
  const url = new URL(req.url);
  const { page, pageSize } = parsePagination(url.searchParams);
  const status = url.searchParams.get("status");
  const platform = url.searchParams.get("platform");
  const search = url.searchParams.get("q");
  const createdByUserId = url.searchParams.get("createdByUserId");
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) throw ApiError.badRequest("workspaceId is required");
  const auth = await requireWorkspace(req, workspaceId);
  const accountScope = await resolveAccountScope({
    workspaceId,
    userId: auth.userId,
    role: auth.role,
    requestedMemberId: url.searchParams.get("memberId"),
    requestedAccountId: url.searchParams.get("accountId") ?? url.searchParams.get("clientId"),
  });

  const { field, dir } = parseSort(url.searchParams, ["createdAt", "scheduledAt", "publishedAt", "updatedAt"], "createdAt");

  const where: Record<string, unknown> = {
    workspaceId,
    ...(status ? { status } : {}),
    ...(search ? { content: { contains: search } } : {}),
    ...(platform ? { targets: { some: { socialAccount: { platform } } } } : {}),
    ...(createdByUserId ? { createdByUserId } : {}),
    ...(accountScope ? {
      AND: [
        { targets: { some: { socialAccountId: { in: accountScope } } } },
        { targets: { every: { socialAccountId: { in: accountScope } } } },
      ],
    } : {}),
  };
  // Exclude archived by default unless explicitly requested
  if (status !== "archived") {
    where.status = status ? { in: [status] } : { not: "archived" };
  }

  const [total, posts] = await Promise.all([
    db.post.count({ where }),
    db.post.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, email: true, image: true } },
        createdBy: { select: { id: true, name: true, email: true, image: true } },
        client: { select: { id: true, name: true } },
        media: { orderBy: { sortOrder: "asc" } },
        targets: { include: { socialAccount: { select: { id: true, platform: true, handle: true, displayName: true } } } },
        analytics: { orderBy: { date: "desc" } },
      },
      orderBy: { [field]: dir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok(posts, paginateMeta(total, { page, pageSize }));
});

/* -------------------------------------------------------------------------- */
/*  POST — create                                                              */
/* -------------------------------------------------------------------------- */

const createSchema = z.object({
  workspaceId: z.string(),
  content: z.string().max(5000),
  title: z.string().max(200).optional(),
  status: z.enum(["draft", "scheduled", "published"]).default("draft"),
  scheduledAt: z.string().datetime().optional(),
  hashtags: z.array(z.string()).max(30).optional(),
  linkUrl: z.string().url().optional(),
  instagramOptions: z.object({
    postType: z.enum(["auto", "feed", "reel", "story", "carousel"]).default("auto"),
    shareToFeed: z.boolean().default(true),
    nativeFinish: z.object({
      musicTitle: z.string().max(120).optional(),
      musicArtist: z.string().max(120).optional(),
      location: z.string().max(200).optional(),
      taggedPeople: z.array(z.string().max(100)).max(20).optional(),
      collaborators: z.array(z.string().max(100)).max(10).optional(),
      firstComment: z.string().max(2200).optional(),
      effectsNotes: z.string().max(800).optional(),
    }).optional(),
  }).optional(),
  targetAccountIds: z.array(z.string()).optional(),
  targets: z
    .array(
      z.object({
        accountId: z.string(),
        content: z.string().max(5000).nullable().optional(),
      })
    )
    .optional(),
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
}).refine(
  (value) => (value.targets?.length ?? 0) > 0 || (value.targetAccountIds?.length ?? 0) > 0,
  { message: "Select at least one channel", path: ["targets"] }
);

export const POST = withHandler(createSchema, async ({ req, body }) => {
  const {
    workspaceId,
    content,
    title,
    status,
    scheduledAt,
    hashtags,
    linkUrl,
    instagramOptions,
    targetAccountIds,
    targets,
    media,
  } = body!;

  const auth = await requireWorkspace(req, workspaceId, "post.create");

  if (status === "scheduled" && !scheduledAt) {
    throw ApiError.badRequest("scheduledAt is required when status=scheduled");
  }

  const normalizedTargets = targets?.length
    ? targets
    : (targetAccountIds ?? []).map((accountId) => ({ accountId, content: null }));
  const normalizedAccountIds = Array.from(new Set(normalizedTargets.map((target) => target.accountId)));
  if (normalizedAccountIds.length !== normalizedTargets.length) {
    throw ApiError.badRequest("Duplicate target accounts are not allowed");
  }

  // Verify all target accounts belong to the workspace
  const createScope = await resolveAccountScope({ workspaceId, userId: auth.userId, role: auth.role });
  const accounts = await db.socialAccount.findMany({
    where: { workspaceId, id: { in: createScope ? normalizedAccountIds.filter((id) => createScope.includes(id)) : normalizedAccountIds } },
    select: { id: true },
  });
  if (accounts.length !== normalizedAccountIds.length) {
    throw ApiError.badRequest("One or more target accounts are invalid or not assigned to you");
  }

  const authorId = auth.userId;

  const post = await db.post.create({
    data: {
      workspaceId,
      clientId: null,
      authorId,
      createdByUserId: auth.userId,
      content,
      title,
      status,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      hashtags: hashtags ? JSON.stringify(hashtags) : null,
      linkUrl,
      aiMeta: instagramOptions ? JSON.stringify({ instagramOptions }) : null,
      targets: {
        create: normalizedTargets.map((target) => ({
          socialAccountId: target.accountId,
          content: target.content?.trim() || null,
        })),
      },
      media: media
        ? {
            create: media.map((m) => ({
              type: m.type,
              url: m.url,
              altText: m.altText,
              sortOrder: m.sortOrder,
            })),
          }
        : undefined,
    },
    include: {
      targets: { include: { socialAccount: { select: { id: true, platform: true, handle: true, displayName: true } } } },
      media: true,
      author: { select: { id: true, name: true, email: true, image: true } },
      createdBy: { select: { id: true, name: true, email: true, image: true } },
      client: { select: { id: true, name: true } },
    },
  });

  return ok(post, {}, 201);
});

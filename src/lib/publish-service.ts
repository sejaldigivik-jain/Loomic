import { db } from "@/lib/db";
import { publishInstagramCarousel, publishToInstagram } from "@/lib/instagram-publisher";
import { decryptSecret } from "@/lib/secrets";
import { publishViaProvider } from "@/lib/social-publisher";

type PublishResult = {
  success: boolean;
  externalId?: string;
  externalUrl?: string;
  errorMessage?: string;
};

function isInstagramQuotaLimitError(message?: string): boolean {
  return Boolean(message?.startsWith("Instagram publishing limit reached."));
}

const INSTAGRAM_QUOTA_RETRY_MS = 15 * 60 * 1000;

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Uploaded media is stored as an absolute URL. During local testing the public
 * Cloudflare hostname can change after a restart. Rebase our own /uploads/*
 * files onto the CURRENT public app URL at publish time so already-scheduled
 * posts do not keep a dead, old tunnel hostname. External media URLs are left
 * untouched.
 */
function currentPublishMediaUrl(storedUrl: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (!base) return storedUrl;
  try {
    const parsed = new URL(storedUrl);
    if (!parsed.pathname.startsWith("/uploads/")) return storedUrl;
    return `${base}${parsed.pathname}${parsed.search}`;
  } catch {
    return storedUrl;
  }
}

async function publishTarget(targetId: string): Promise<PublishResult> {
  const target = await db.postTarget.findUnique({
    where: { id: targetId },
    include: {
      socialAccount: true,
      post: { include: { media: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  if (!target) return { success: false, errorMessage: "Publish target not found" };

  const account = target.socialAccount;
  const post = target.post;
  if (account.status !== "connected") {
    return { success: false, errorMessage: `Account is ${account.status}. Reconnect it first.` };
  }
  if (!account.accessToken || account.accessToken === "demo-token") {
    return { success: false, errorMessage: "This channel is not connected with real OAuth credentials." };
  }
  // Instagram publishing currently relies on its long-lived token directly.
  // Other providers are allowed to enter their provider-specific refresh flow
  // in social-publisher.ts before we decide that a reconnect is required.
  if (account.platform === "instagram" && account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
    return { success: false, errorMessage: "Instagram access token expired. Reconnect the channel." };
  }

  const media = post.media.map((m) => ({
    id: m.id,
    type: m.type as "image" | "video",
    url: currentPublishMediaUrl(m.url),
    alt: m.altText ?? "",
    altText: m.altText ?? "",
  }));
  const hashtags = parseJsonArray(post.hashtags);
  let instagramOptions: any = undefined;
  if (post.aiMeta) {
    try { instagramOptions = JSON.parse(post.aiMeta)?.instagramOptions; } catch { instagramOptions = undefined; }
  }

  if (account.platform === "instagram") {
    const igUserId = account.externalUserId;
    if (!igUserId) return { success: false, errorMessage: "Instagram external account ID is missing. Reconnect Instagram." };
    const igPost = {
      id: post.id, content: target.content ?? post.content, hashtags, media,
      platforms: ["instagram" as const], status: "publishing" as const, targets: [],
      author: { name: "", initials: "", gradient: "" },
    };
    const accessToken = decryptSecret(account.accessToken);
    const requestedType = instagramOptions?.postType ?? "auto";
    return requestedType === "carousel" || (requestedType === "auto" && media.length > 1)
      ? publishInstagramCarousel(accessToken, igUserId, igPost as any, instagramOptions)
      : publishToInstagram(accessToken, igUserId, igPost as any, instagramOptions);
  }

  return publishViaProvider({
    account,
    content: target.content ?? post.content,
    hashtags,
    media,
    linkUrl: post.linkUrl,
  });
}

export async function publishPostById(postId: string) {
  const post = await db.post.findUnique({
    where: { id: postId },
    include: { targets: true },
  });
  if (!post) throw new Error("Post not found");
  if (["pending", "rejected", "changes_requested"].includes(post.approvalState)) {
    return { postId, status: "blocked", published: 0, failed: post.targets.length };
  }

  await db.post.update({ where: { id: postId }, data: { status: "publishing" } });
  await db.postTarget.updateMany({
    where: { postId, status: { in: ["pending", "failed"] } },
    data: { status: "publishing", errorMessage: null },
  });

  const targetIds = post.targets
    .filter((t) => t.status === "pending" || t.status === "failed")
    .map((t) => t.id);

  const results = await Promise.all(
    targetIds.map(async (targetId) => {
      const result = await publishTarget(targetId);
      const quotaBlocked = !result.success && isInstagramQuotaLimitError(result.errorMessage);
      await db.postTarget.update({
        where: { id: targetId },
        data: result.success
          ? {
              status: "published",
              externalId: result.externalId ?? null,
              externalUrl: result.externalUrl ?? null,
              publishedAt: new Date(),
              errorMessage: null,
            }
          : quotaBlocked
            ? { status: "pending", errorMessage: result.errorMessage ?? "Waiting for Instagram publishing quota" }
            : { status: "failed", errorMessage: result.errorMessage ?? "Publishing failed" },
      });
      return { ...result, quotaBlocked };
    })
  );

  const freshTargets = await db.postTarget.findMany({ where: { postId } });
  const published = freshTargets.filter((t) => t.status === "published").length;
  const failed = freshTargets.filter((t) => t.status === "failed").length;
  const publishing = freshTargets.filter((t) => t.status === "publishing").length;
  const pending = freshTargets.filter((t) => t.status === "pending").length;
  const quotaBlocked = results.some((result) => result.quotaBlocked === true);
  const finalStatus = publishing > 0
    ? "publishing"
    : pending > 0
      ? "scheduled"
      : published > 0
        ? "published"
        : failed > 0
          ? "failed"
          : "scheduled";

  const nextRetryAt = quotaBlocked && pending > 0
    ? new Date(Date.now() + INSTAGRAM_QUOTA_RETRY_MS)
    : undefined;

  await db.post.update({
    where: { id: postId },
    data: {
      status: finalStatus,
      publishedAt: published > 0 && pending === 0 ? new Date() : null,
      ...(nextRetryAt ? { scheduledAt: nextRetryAt } : {}),
    },
  });

  return { postId, status: finalStatus, published, failed, pending, quotaBlocked, nextRetryAt, results };
}

export async function publishDuePosts(limit = 20) {
  const due = await db.post.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { lte: new Date() },
      approvalState: { in: ["none", "approved"] },
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
    select: { id: true },
  });

  const results: Array<{ status: string; [key: string]: unknown }> = [];
  for (const post of due) {
    try {
      results.push(await publishPostById(post.id));
    } catch (error) {
      await db.post.update({ where: { id: post.id }, data: { status: "failed" } }).catch(() => undefined);
      results.push({ postId: post.id, status: "failed", error: error instanceof Error ? error.message : "Unknown error" });
    }
  }
  return results;
}

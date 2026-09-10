/**
 * Compatibility publish endpoint for one connected account.
 * New post publishing should prefer POST /api/v1/posts/:id/publish so
 * status updates happen transactionally on the persisted post targets.
 */
import { z } from "zod";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireAccountAccess } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { publishToInstagram, publishInstagramCarousel } from "@/lib/instagram-publisher";
import { decryptSecret } from "@/lib/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  accountId: z.string(),
  content: z.string().min(1).max(5000),
  media: z.array(z.object({ url: z.string().url(), type: z.enum(["image", "video"]) })).default([]),
  hashtags: z.array(z.string()).default([]),
});

export const POST = withHandler(schema, async ({ req, body }) => {
  const { accountId, content, media, hashtags } = body!;
  await requireAccountAccess(req, accountId, "post.publish");
  const account = await db.socialAccount.findUnique({ where: { id: accountId } });
  if (!account) throw ApiError.notFound("Account not found");
  if (account.platform !== "instagram") throw ApiError.badRequest(`${account.platform} publishing adapter is not configured`);
  if (!account.accessToken || account.accessToken === "demo-token") throw ApiError.badRequest("Connect this channel with real OAuth first");
  if (!account.externalUserId) throw ApiError.badRequest("Instagram external account ID is missing. Reconnect the channel.");

  const igPost = {
    id: accountId,
    content,
    hashtags,
    media: media.map((m, i) => ({ id: `m_${i}`, type: m.type, url: m.url, alt: "" })),
    platforms: ["instagram" as const],
    status: "publishing" as const,
    targets: [],
    author: { name: "", initials: "", gradient: "" },
  };
  const accessToken = decryptSecret(account.accessToken);
  const result = media.length > 1
    ? await publishInstagramCarousel(accessToken, account.externalUserId, igPost as any)
    : await publishToInstagram(accessToken, account.externalUserId, igPost as any);
  return ok({
    accountId,
    status: result.success ? "published" : "failed",
    externalId: result.externalId,
    externalUrl: result.externalUrl,
    errorMessage: result.errorMessage,
  });
});

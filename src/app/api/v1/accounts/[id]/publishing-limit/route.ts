import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { requireAccountAccess } from "@/lib/server-auth";
import { getUsableSocialAccessToken } from "@/lib/social-publisher";
import { getInstagramPublishingLimit } from "@/lib/instagram-publisher";

export const runtime = "nodejs";

export const GET = withHandler(null, async ({ req, ctx }) => {
  const id = String(ctx.params.id);
  await requireAccountAccess(req, id);

  const account = await db.socialAccount.findUnique({ where: { id } });
  if (!account) throw ApiError.notFound("Account not found");
  if (account.platform !== "instagram") {
    throw ApiError.badRequest("Publishing limit is only available for Instagram accounts.");
  }
  if (!account.externalUserId) {
    throw ApiError.badRequest("Instagram account ID is missing. Reconnect this account first.");
  }
  if (!account.accessToken || account.accessToken === "demo-token") {
    throw ApiError.badRequest("Connect this Instagram account with a real token first.");
  }

  const token = await getUsableSocialAccessToken(account);
  const limit = await getInstagramPublishingLimit(token, account.externalUserId);

  return ok({
    ...limit,
    accountId: account.id,
    handle: account.handle,
  });
});

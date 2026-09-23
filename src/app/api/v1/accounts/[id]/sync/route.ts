import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { requireAccountAccess } from "@/lib/server-auth";
import { syncInstagramAnalytics } from "@/lib/analytics-service";
import { getUsableSocialAccessToken } from "@/lib/social-publisher";
import { decryptSecret } from "@/lib/secrets";
import { instagramConnectionMethod, instagramGraphBase } from "@/lib/instagram-connection";

export const runtime = "nodejs";

const META_VERSION = process.env.META_GRAPH_API_VERSION ?? "v26.0";

async function jsonOrThrow<T>(res: Response, label: string): Promise<T> {
  const text = await res.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) throw new Error(`${label}: ${body?.error?.message ?? body?.message ?? text ?? res.statusText}`);
  return body as T;
}

export const POST = withHandler(null, async ({ req, ctx }) => {
  const id = String(ctx.params.id);
  await requireAccountAccess(req, id);
  const account = await db.socialAccount.findUnique({ where: { id } });
  if (!account) throw ApiError.notFound("Account not found");
  if (!account.accessToken || account.accessToken === "demo-token") throw ApiError.badRequest("Connect this account with real OAuth first");

  const token = account.platform === "instagram" && instagramConnectionMethod(account.providerData) === "facebook_login"
    ? decryptSecret(account.accessToken)
    : await getUsableSocialAccessToken(account);
  let profileUpdated = false;
  let analyticsSynced = 0;

  if (account.platform === "instagram") {
    const method = instagramConnectionMethod(account.providerData);
    const base = instagramGraphBase(account.providerData);
    const profileEndpoint = method === "facebook_login" && account.externalUserId
      ? `${base}/${encodeURIComponent(account.externalUserId)}`
      : `${base}/me`;
    const profile = await jsonOrThrow<any>(
      await fetch(`${profileEndpoint}?${new URLSearchParams({
        fields: method === "facebook_login"
          ? "id,username,followers_count,profile_picture_url,media_count"
          : "user_id,username,followers_count,profile_picture_url,account_type,media_count",
        access_token: token,
      })}`),
      "Instagram profile refresh"
    );
    await db.socialAccount.update({ where: { id }, data: {
      handle: profile.username ? `@${profile.username}` : account.handle,
      displayName: profile.username ?? account.displayName,
      avatarUrl: profile.profile_picture_url ?? account.avatarUrl,
      followers: Number(profile.followers_count ?? account.followers) || 0,
      status: "connected",
    }});
    profileUpdated = true;
    const results = await syncInstagramAnalytics(100, id);
    analyticsSynced = results.filter((r) => r.status === "synced").length;
  } else if (account.platform === "facebook") {
    if (!account.externalUserId) throw ApiError.badRequest("Facebook Page ID is missing; reconnect the Page");
    const page = await jsonOrThrow<any>(
      await fetch(`https://graph.facebook.com/${META_VERSION}/${account.externalUserId}?${new URLSearchParams({
        fields: "id,name,followers_count,fan_count,picture{url}",
        access_token: token,
      })}`),
      "Facebook Page refresh"
    );
    await db.socialAccount.update({ where: { id }, data: {
      handle: page.name ?? account.handle,
      displayName: page.name ?? account.displayName,
      avatarUrl: page.picture?.data?.url ?? account.avatarUrl,
      followers: Number(page.followers_count ?? page.fan_count ?? account.followers) || 0,
      status: "connected",
    }});
    profileUpdated = true;
  } else if (account.platform === "twitter") {
    const profile = await jsonOrThrow<any>(
      await fetch("https://api.x.com/2/users/me?user.fields=profile_image_url,public_metrics,name,username", { headers: { Authorization: `Bearer ${token}` } }),
      "X profile refresh"
    );
    const u = profile.data;
    await db.socialAccount.update({ where: { id }, data: {
      handle: u?.username ? `@${u.username}` : account.handle,
      displayName: u?.name ?? account.displayName,
      avatarUrl: u?.profile_image_url ?? account.avatarUrl,
      followers: Number(u?.public_metrics?.followers_count ?? account.followers) || 0,
      status: "connected",
    }});
    profileUpdated = true;
  } else if (account.platform === "pinterest") {
    const profile = await jsonOrThrow<any>(
      await fetch("https://api.pinterest.com/v5/user_account", { headers: { Authorization: `Bearer ${token}` } }),
      "Pinterest profile refresh"
    );
    await db.socialAccount.update({ where: { id }, data: {
      handle: profile.username ? `@${profile.username}` : account.handle,
      displayName: profile.username ?? account.displayName,
      avatarUrl: profile.profile_image ?? account.avatarUrl,
      followers: Number(profile.follower_count ?? account.followers) || 0,
      status: "connected",
    }});
    profileUpdated = true;
  } else if (account.platform === "threads") {
    const profile = await jsonOrThrow<any>(
      await fetch(`https://graph.threads.com/v1.0/me?${new URLSearchParams({ fields: "id,username,threads_profile_picture_url", access_token: token })}`),
      "Threads profile refresh"
    );
    await db.socialAccount.update({ where: { id }, data: {
      handle: profile.username ? `@${profile.username}` : account.handle,
      displayName: profile.username ?? account.displayName,
      avatarUrl: profile.threads_profile_picture_url ?? account.avatarUrl,
      status: "connected",
    }});
    profileUpdated = true;
  } else if (account.platform === "linkedin") {
    const profile = await jsonOrThrow<any>(
      await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${token}` } }),
      "LinkedIn profile refresh"
    );
    await db.socialAccount.update({ where: { id }, data: {
      displayName: profile.name ?? account.displayName,
      avatarUrl: profile.picture ?? account.avatarUrl,
      status: "connected",
    }});
    profileUpdated = true;
  }

  return ok({ accountId: id, profileUpdated, analyticsSynced });
});

import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { providerCredentials } from "@/lib/social-provider-oauth";

export type AccountLike = {
  id: string;
  workspaceId: string;
  platform: string;
  handle: string;
  accessToken: string;
  refreshToken: string | null;
  externalUserId: string | null;
  providerData: string | null;
  tokenExpiresAt: Date | null;
};

type MediaLike = { type: string; url: string; altText?: string | null };
export type SocialPublishResult = { success: boolean; externalId?: string; externalUrl?: string; errorMessage?: string };

const META_VERSION = process.env.META_GRAPH_API_VERSION ?? "v26.0";
const LINKEDIN_VERSION = process.env.LINKEDIN_API_VERSION ?? "202607";

function providerData(account: AccountLike): Record<string, any> {
  if (!account.providerData) return {};
  try { return JSON.parse(account.providerData); } catch { return {}; }
}

async function jsonOrThrow<T>(res: Response, label: string): Promise<T> {
  const text = await res.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) throw new Error(`${label}: ${body?.error?.message ?? body?.detail ?? body?.message ?? text ?? res.statusText}`);
  return body as T;
}

async function refreshTokenIfNeeded(account: AccountLike): Promise<string> {
  const current = decryptSecret(account.accessToken);
  const expiresSoon = account.tokenExpiresAt && account.tokenExpiresAt.getTime() < Date.now() + 5 * 60_000;
  if (!expiresSoon) return current;

  if (account.platform === "twitter" && account.refreshToken) {
    const credentials = await providerCredentials("twitter", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000", account.workspaceId);
    if (!credentials) throw new Error("X token expired and provider credentials are missing");
    const clientId = credentials.clientId;
    const secret = credentials.clientSecret;
    const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
    if (secret) headers.Authorization = `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`;
    const token = await jsonOrThrow<{ access_token: string; refresh_token?: string; expires_in?: number }>(
      await fetch("https://api.x.com/2/oauth2/token", {
        method: "POST", headers,
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: decryptSecret(account.refreshToken), client_id: clientId }),
      }), "X token refresh"
    );
    await db.socialAccount.update({ where: { id: account.id }, data: {
      accessToken: encryptSecret(token.access_token),
      refreshToken: token.refresh_token ? encryptSecret(token.refresh_token) : account.refreshToken,
      tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
      status: "connected",
    }});
    return token.access_token;
  }

  if (account.platform === "pinterest" && account.refreshToken) {
    const credentials = await providerCredentials("pinterest", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000", account.workspaceId);
    const clientId = credentials?.clientId;
    const clientSecret = credentials?.clientSecret;
    if (!clientId || !clientSecret) throw new Error("Pinterest token expired and provider credentials are missing");
    const token = await jsonOrThrow<{ access_token: string; refresh_token?: string; expires_in?: number }>(
      await fetch("https://api.pinterest.com/v5/oauth/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: decryptSecret(account.refreshToken) }),
      }), "Pinterest token refresh"
    );
    await db.socialAccount.update({ where: { id: account.id }, data: {
      accessToken: encryptSecret(token.access_token),
      refreshToken: token.refresh_token ? encryptSecret(token.refresh_token) : account.refreshToken,
      tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
      status: "connected",
    }});
    return token.access_token;
  }

  if (account.platform === "linkedin" && account.refreshToken) {
    const credentials = await providerCredentials("linkedin", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000", account.workspaceId);
    const clientId = credentials?.clientId;
    const clientSecret = credentials?.clientSecret;
    if (!clientId || !clientSecret) throw new Error("LinkedIn token expired and provider credentials are missing");
    const token = await jsonOrThrow<{ access_token: string; refresh_token?: string; expires_in?: number }>(
      await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token", refresh_token: decryptSecret(account.refreshToken),
          client_id: clientId, client_secret: clientSecret,
        }),
      }), "LinkedIn token refresh"
    );
    await db.socialAccount.update({ where: { id: account.id }, data: {
      accessToken: encryptSecret(token.access_token),
      refreshToken: token.refresh_token ? encryptSecret(token.refresh_token) : account.refreshToken,
      tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
      status: "connected",
    }});
    return token.access_token;
  }

  if (account.platform === "threads") {
    const res = await fetch(`https://graph.threads.com/refresh_access_token?${new URLSearchParams({ grant_type: "th_refresh_token", access_token: current })}`);
    if (res.ok) {
      const token = await jsonOrThrow<{ access_token: string; expires_in?: number }>(res, "Threads token refresh");
      await db.socialAccount.update({ where: { id: account.id }, data: {
        accessToken: encryptSecret(token.access_token),
        tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
        status: "connected",
      }});
      return token.access_token;
    }
  }

  throw new Error(`${account.platform} access token expired. Reconnect the channel.`);
}

function composeText(content: string, hashtags: string[]) {
  const cleanContent = content.trim();
  const existing = new Set(
    (cleanContent.match(/#[A-Za-z0-9_]+/g) ?? []).map((tag) => tag.toLowerCase())
  );
  const tags = hashtags
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => h.startsWith("#") ? h : `#${h}`)
    .filter((tag, index, all) =>
      !existing.has(tag.toLowerCase()) &&
      all.findIndex((candidate) => candidate.toLowerCase() === tag.toLowerCase()) === index
    )
    .join(" ");
  return [cleanContent, tags].filter(Boolean).join("\n\n");
}

async function publishFacebook(account: AccountLike, token: string, text: string, media: MediaLike[], linkUrl?: string | null): Promise<SocialPublishResult> {
  const pageId = account.externalUserId;
  if (!pageId) throw new Error("Facebook Page ID is missing. Reconnect the Page.");
  if (media.length > 1) throw new Error("Facebook adapter currently supports one media item per post.");
  let endpoint = `https://graph.facebook.com/${META_VERSION}/${pageId}/feed`;
  let body: Record<string, string> = { message: text, access_token: token };
  if (linkUrl) body.link = linkUrl;
  if (media[0]) {
    if (media[0].type !== "image") throw new Error("Facebook video upload requires a provider-native upload session and is not enabled in this build.");
    endpoint = `https://graph.facebook.com/${META_VERSION}/${pageId}/photos`;
    body = { url: media[0].url, caption: text, access_token: token };
  }
  const out = await jsonOrThrow<{ id?: string; post_id?: string }>(await fetch(endpoint, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body),
  }), "Facebook publish");
  const id = out.post_id ?? out.id;
  return { success: true, externalId: id, externalUrl: id ? `https://www.facebook.com/${id.replace("_", "/posts/")}` : undefined };
}

async function threadsContainer(userId: string, token: string, params: Record<string, string>) {
  return jsonOrThrow<{ id: string }>(await fetch(`https://graph.threads.com/v1.0/${userId}/threads`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, access_token: token }),
  }), "Threads container");
}

async function publishThreads(account: AccountLike, token: string, text: string, media: MediaLike[]): Promise<SocialPublishResult> {
  const userId = account.externalUserId;
  if (!userId) throw new Error("Threads user ID is missing. Reconnect Threads.");
  let creationId: string;
  if (media.length === 0) {
    creationId = (await threadsContainer(userId, token, { media_type: "TEXT", text })).id;
  } else if (media.length === 1) {
    const m = media[0];
    creationId = (await threadsContainer(userId, token, {
      media_type: m.type === "video" ? "VIDEO" : "IMAGE",
      text,
      ...(m.type === "video" ? { video_url: m.url } : { image_url: m.url }),
    })).id;
  } else {
    if (media.length > 20) throw new Error("Threads carousels support at most 20 media items.");
    const children: string[] = [];
    for (const m of media) {
      const child = await threadsContainer(userId, token, {
        media_type: m.type === "video" ? "VIDEO" : "IMAGE",
        is_carousel_item: "true",
        ...(m.type === "video" ? { video_url: m.url } : { image_url: m.url }),
      });
      children.push(child.id);
    }
    creationId = (await threadsContainer(userId, token, { media_type: "CAROUSEL", text, children: children.join(",") })).id;
  }
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const out = await jsonOrThrow<{ id: string }>(await fetch(`https://graph.threads.com/v1.0/${userId}/threads_publish`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: creationId, access_token: token }),
  }), "Threads publish");
  return { success: true, externalId: out.id, externalUrl: `https://www.threads.net/@${account.handle.replace(/^@/, "")}/post/${out.id}` };
}

async function uploadLinkedInImage(token: string, authorUrn: string, media: MediaLike) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Linkedin-Version": LINKEDIN_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
  const init = await jsonOrThrow<{ value: { uploadUrl: string; image: string } }>(await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
    method: "POST", headers,
    body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
  }), "LinkedIn image initialize");
  const source = await fetch(media.url);
  if (!source.ok) throw new Error(`LinkedIn image fetch failed: ${source.status}`);
  const bytes = await source.arrayBuffer();
  const upload = await fetch(init.value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": source.headers.get("content-type") ?? "application/octet-stream" },
    body: bytes,
  });
  if (!upload.ok) throw new Error(`LinkedIn image upload failed: ${upload.status} ${await upload.text().catch(() => "")}`);
  return init.value.image;
}

async function publishLinkedIn(account: AccountLike, token: string, text: string, media: MediaLike[]): Promise<SocialPublishResult> {
  const data = providerData(account);
  const author = data.authorUrn ?? account.externalUserId;
  if (!author) throw new Error("LinkedIn author URN is missing. Reconnect LinkedIn.");
  if (media.length > 1) throw new Error("LinkedIn adapter currently publishes one media item per post; use a text post or one image.");
  if (media[0]?.type === "video") throw new Error("LinkedIn video upload is not enabled in this build.");
  let content: any = undefined;
  if (media[0]) {
    const image = await uploadLinkedInImage(token, author, media[0]);
    content = { media: { id: image, altText: media[0].altText || "" } };
  }
  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Linkedin-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      author, commentary: text, visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false,
      ...(content ? { content } : {}),
    }),
  });
  if (!res.ok) throw new Error(`LinkedIn publish: ${await res.text()}`);
  const id = res.headers.get("x-restli-id") ?? undefined;
  return { success: true, externalId: id, externalUrl: id ? `https://www.linkedin.com/feed/update/${encodeURIComponent(id)}` : undefined };
}

async function publishX(account: AccountLike, token: string, text: string, media: MediaLike[]): Promise<SocialPublishResult> {
  if (media.length) throw new Error("X media upload is not enabled in this build; text posts publish normally.");
  const out = await jsonOrThrow<{ data: { id: string } }>(await fetch("https://api.x.com/2/tweets", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ text }),
  }), "X publish");
  const username = account.handle.replace(/^@/, "");
  return { success: true, externalId: out.data.id, externalUrl: `https://x.com/${username}/status/${out.data.id}` };
}

async function publishPinterest(account: AccountLike, token: string, text: string, media: MediaLike[], linkUrl?: string | null): Promise<SocialPublishResult> {
  const data = providerData(account);
  if (!data.defaultBoardId) throw new Error("Pinterest needs a default board. Create at least one board, then reconnect Pinterest.");
  if (media.length !== 1 || media[0].type !== "image") throw new Error("Pinterest publishing in this build requires exactly one image.");
  const out = await jsonOrThrow<{ id: string; link?: string }>(await fetch("https://api.pinterest.com/v5/pins", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      board_id: data.defaultBoardId,
      description: text.slice(0, 500),
      ...(linkUrl ? { link: linkUrl } : {}),
      media_source: { source_type: "image_url", url: media[0].url },
    }),
  }), "Pinterest publish");
  return { success: true, externalId: out.id, externalUrl: out.link ?? `https://www.pinterest.com/pin/${out.id}/` };
}

export async function publishViaProvider(input: {
  account: AccountLike;
  content: string;
  hashtags: string[];
  media: MediaLike[];
  linkUrl?: string | null;
}): Promise<SocialPublishResult> {
  try {
    const token = await refreshTokenIfNeeded(input.account);
    const text = composeText(input.content, input.hashtags);
    switch (input.account.platform) {
      case "facebook": return await publishFacebook(input.account, token, text, input.media, input.linkUrl);
      case "threads": return await publishThreads(input.account, token, text, input.media);
      case "linkedin": return await publishLinkedIn(input.account, token, text, input.media);
      case "twitter": return await publishX(input.account, token, text, input.media);
      case "pinterest": return await publishPinterest(input.account, token, text, input.media, input.linkUrl);
      default: return { success: false, errorMessage: `${input.account.platform} publishing is not handled by this adapter.` };
    }
  } catch (error) {
    return { success: false, errorMessage: error instanceof Error ? error.message : "Provider publishing failed" };
  }
}

/** Server-side helper for account profile/analytics refresh routes. */
export async function getUsableSocialAccessToken(account: AccountLike): Promise<string> {
  return refreshTokenIfNeeded(account);
}

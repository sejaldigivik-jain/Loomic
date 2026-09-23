/**
 * Instagram Graph API publisher for Instagram API with Instagram Login.
 *
 * Supported in this build:
 *   • Single-image feed posts
 *   • Reels (single video)
 *   • Stories (single image or video)
 *   • Carousels (2-10 images/videos)
 *   • Reel "Share to Feed" flag
 *
 * Reel/video publishing is asynchronous on Meta's side. A successful /media
 * call returns a CONTAINER id, not the final published media id. We therefore
 * wait for the container to reach FINISHED before calling /media_publish and
 * surface the real Graph API error when processing fails.
 */
import type { InstagramOptions, Post } from "@/lib/mock-data";

const IG_GRAPH_VERSION = process.env.META_GRAPH_API_VERSION ?? "v26.0";
const INSTAGRAM_LOGIN_GRAPH_BASE = `https://graph.instagram.com/${IG_GRAPH_VERSION}`;
const FACEBOOK_LOGIN_GRAPH_BASE = `https://graph.facebook.com/${IG_GRAPH_VERSION}`;

export type InstagramPublishContext = {
  connectionMethod?: "instagram_login" | "facebook_login" | "meta_developer_token" | "unknown";
};

function graphBase(context?: InstagramPublishContext): string {
  return context?.connectionMethod === "facebook_login"
    ? FACEBOOK_LOGIN_GRAPH_BASE
    : INSTAGRAM_LOGIN_GRAPH_BASE;
}

const VIDEO_PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;
const IMAGE_PROCESSING_TIMEOUT_MS = 90 * 1000;

export interface InstagramPublishResult {
  success: boolean;
  externalId?: string;
  externalUrl?: string;
  errorMessage?: string;
}

export interface InstagramPublishingLimit {
  used: number;
  total: number;
  remaining: number;
  durationSeconds: number;
}

export async function getInstagramPublishingLimit(
  accessToken: string,
  igUserId: string,
  context?: InstagramPublishContext
): Promise<InstagramPublishingLimit> {
  const base = graphBase(context);
  const res = await fetch(
    `${base}/${encodeURIComponent(igUserId)}/content_publishing_limit?fields=quota_usage,config&access_token=${encodeURIComponent(accessToken)}`,
    { cache: "no-store" }
  );

  const payload = (await res.json().catch(() => ({}))) as {
    data?: Array<{
      quota_usage?: number;
      config?: { quota_total?: number; quota_duration?: number };
    }>;
    error?: InstagramErrorPayload["error"];
  };

  if (!res.ok) {
    throw new Error(
      instagramErrorMessage(
        payload as InstagramErrorPayload,
        `Could not check Instagram publishing limit (${res.status}).`
      )
    );
  }

  const item = payload.data?.[0];
  if (!item) {
    throw new Error("Instagram did not return publishing-limit information.");
  }

  const used = Math.max(0, Number(item.quota_usage ?? 0));
  const total = Math.max(0, Number(item.config?.quota_total ?? 100));
  const durationSeconds = Math.max(1, Number(item.config?.quota_duration ?? 86_400));

  return {
    used,
    total,
    remaining: Math.max(0, total - used),
    durationSeconds,
  };
}

async function assertInstagramPublishingQuota(accessToken: string, igUserId: string, context?: InstagramPublishContext): Promise<void> {
  try {
    const limit = await getInstagramPublishingLimit(accessToken, igUserId, context);
    console.log(`[Instagram] Publishing usage: ${limit.used}/${limit.total}`);
    if (limit.total > 0 && limit.remaining <= 0) {
      throw new Error(
        `Instagram publishing limit reached. ${limit.used}/${limit.total} API posts were published in the current rolling 24-hour window.`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("Instagram publishing limit reached.")) throw error;
    // Do not break an otherwise valid publish if Meta's quota endpoint is temporarily unavailable.
    console.warn(`[Instagram] Could not read publishing quota; continuing publish: ${message}`);
  }
}

export type ResolvedInstagramPostType = "feed" | "reel" | "story" | "carousel";

type InstagramErrorPayload = {
  error?: {
    message?: string;
    error_user_title?: string;
    error_user_msg?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
  status?: string;
  status_code?: string;
  id?: string;
};

type ContainerStatus = {
  statusCode?: string;
  status?: string;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function instagramErrorMessage(payload: InstagramErrorPayload | null | undefined, fallback: string): string {
  const error = payload?.error;
  const userMessage = error?.error_user_msg?.trim();
  const title = error?.error_user_title?.trim();
  const apiMessage = error?.message?.trim();
  const status = payload?.status?.trim();

  const main = userMessage || apiMessage || status || fallback;
  const details = [
    title && !main.toLowerCase().includes(title.toLowerCase()) ? title : "",
    typeof error?.code === "number" ? `code ${error.code}` : "",
    typeof error?.error_subcode === "number" ? `subcode ${error.error_subcode}` : "",
  ].filter(Boolean);

  return details.length > 0 ? `${main} (${details.join(", ")})` : main;
}

function isTransientPublishError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("media id is not available") ||
    normalized.includes("media id not available") ||
    normalized.includes("media is not ready") ||
    normalized.includes("still processing") ||
    normalized.includes("not ready")
  );
}

function assertPublicMediaUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) {
      return "Instagram media must use a public HTTP/HTTPS URL.";
    }
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return "Instagram cannot download media from localhost. Start Loomic with RUN-SOCIALFLOW.bat so the public HTTPS tunnel is active, then retry.";
    }
    return null;
  } catch {
    return "Instagram media URL is invalid. Re-upload the media and try again.";
  }
}

function normalizeHashtag(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function captionFor(post: Post, options?: InstagramOptions, includeCaption = true, nativeLocationActive = false): string {
  if (!includeCaption) return "";

  const content = post.content.trim();
  const existingHashtags = new Set(
    (content.match(/#[A-Za-z0-9_]+/g) ?? []).map((tag) => tag.toLowerCase())
  );
  const extraHashtags = post.hashtags
    .map(normalizeHashtag)
    .filter((tag, index, all) =>
      !existingHashtags.has(tag.toLowerCase()) &&
      all.findIndex((candidate) => candidate.toLowerCase() === tag.toLowerCase()) === index
    );

  const location = options?.nativeFinish?.location?.trim();
  const locationLine = !nativeLocationActive && location && !content.toLowerCase().includes(location.toLowerCase())
    ? `📍 ${location}`
    : "";

  return [content, locationLine, extraHashtags.join(" ")].filter(Boolean).join("\n\n");
}

export function resolveInstagramPostType(post: Post, options?: InstagramOptions): ResolvedInstagramPostType {
  const requested = options?.postType ?? "auto";
  if (requested !== "auto") return requested;
  if (post.media.length > 1) return "carousel";
  return post.media[0]?.type === "video" ? "reel" : "feed";
}

function validateInstagramPost(post: Post, type: ResolvedInstagramPostType): string | null {
  if (post.media.length === 0) return "Instagram requires at least one image or video.";
  if (type === "feed") {
    if (post.media.length !== 1 || post.media[0]?.type !== "image") {
      return "Instagram Feed in this API flow requires exactly one image. Use Reel for video or Carousel for multiple media.";
    }
  }
  if (type === "reel") {
    if (post.media.length !== 1 || post.media[0]?.type !== "video") {
      return "Instagram Reel requires exactly one video.";
    }
  }
  if (type === "story" && post.media.length !== 1) {
    return "Instagram Story requires exactly one image or video.";
  }
  if (type === "carousel" && (post.media.length < 2 || post.media.length > 10)) {
    return "Instagram Carousel requires 2 to 10 media items.";
  }

  for (const media of post.media) {
    const urlError = assertPublicMediaUrl(media.url);
    if (urlError) return urlError;
  }

  return null;
}

async function createContainer(
  accessToken: string,
  igUserId: string,
  params: URLSearchParams,
  context?: InstagramPublishContext
): Promise<{ id?: string; error?: string }> {
  params.set("access_token", accessToken);
  const res = await fetch(`${graphBase(context)}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const json = (await res.json().catch(() => ({}))) as InstagramErrorPayload;
  if (!res.ok) {
    return { error: instagramErrorMessage(json, `Instagram container creation failed (${res.status})`) };
  }
  if (!json.id) {
    return { error: instagramErrorMessage(json, "Instagram did not return a media container ID.") };
  }
  return { id: json.id };
}

async function getContainerStatus(accessToken: string, containerId: string, context?: InstagramPublishContext): Promise<ContainerStatus> {
  const res = await fetch(
    `${graphBase(context)}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`,
    { cache: "no-store" }
  );
  const data = (await res.json().catch(() => ({}))) as InstagramErrorPayload;
  if (!res.ok) {
    throw new Error(instagramErrorMessage(data, `Could not check Instagram media processing (${res.status}).`));
  }
  return { statusCode: data.status_code, status: data.status };
}

/**
 * Poll a Meta media container until it is actually publishable.
 *
 * Important: the old implementation silently returned after a short timeout.
 * That caused /media_publish to run against an IN_PROGRESS Reel and Meta then
 * returned messages such as "Media ID is not available". We now wait up to
 * five minutes for videos and throw an actionable error if processing never
 * reaches FINISHED.
 */
async function waitForContainerReady(
  accessToken: string,
  containerId: string,
  maxWaitMs = IMAGE_PROCESSING_TIMEOUT_MS,
  context?: InstagramPublishContext
): Promise<void> {
  const startedAt = Date.now();
  let attempt = 0;
  let lastStatusCode = "UNKNOWN";
  let lastStatus = "";

  while (Date.now() - startedAt < maxWaitMs) {
    const data = await getContainerStatus(accessToken, containerId, context);
    lastStatusCode = data.statusCode ?? "UNKNOWN";
    lastStatus = data.status ?? "";

    if (lastStatusCode === "FINISHED" || lastStatusCode === "PUBLISHED") return;

    if (lastStatusCode === "ERROR" || lastStatusCode === "EXPIRED") {
      throw new Error(
        `Instagram media processing ${lastStatusCode.toLowerCase()}${lastStatus ? `: ${lastStatus}` : "."}`
      );
    }

    // Adaptive polling: quick checks first, then ease off while Meta transcodes.
    const delayMs = attempt === 0 ? 5_000 : attempt === 1 ? 10_000 : attempt < 5 ? 15_000 : 20_000;
    attempt += 1;
    const remaining = maxWaitMs - (Date.now() - startedAt);
    if (remaining <= 0) break;
    await sleep(Math.min(delayMs, remaining));
  }

  throw new Error(
    `Instagram is still processing this media after ${Math.round(maxWaitMs / 1000)} seconds` +
    `${lastStatusCode !== "UNKNOWN" ? ` (status: ${lastStatusCode}${lastStatus ? ` — ${lastStatus}` : ""})` : ""}. ` +
    "Keep Loomic and the public tunnel running, then use Retry failed."
  );
}

async function publishContainer(
  accessToken: string,
  igUserId: string,
  creationId: string,
  context?: InstagramPublishContext
): Promise<InstagramPublishResult> {
  // FINISHED can occasionally race Meta's publish endpoint by a few seconds.
  // Retry only the known transient "media id not available/not ready" case.
  const maxPublishAttempts = 3;

  for (let attempt = 1; attempt <= maxPublishAttempts; attempt += 1) {
    const publishRes = await fetch(`${graphBase(context)}/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ access_token: accessToken, creation_id: creationId }),
    });

    const published = (await publishRes.json().catch(() => ({}))) as InstagramErrorPayload;

    if (publishRes.ok && published.id) {
      const permalinkRes = await fetch(
        `${graphBase(context)}/${published.id}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`,
        { cache: "no-store" }
      );
      let permalink: string | undefined;
      if (permalinkRes.ok) {
        const data = await permalinkRes.json().catch(() => ({}));
        permalink = data.permalink;
      }
      return { success: true, externalId: published.id, externalUrl: permalink };
    }

    const message = instagramErrorMessage(
      published,
      publishRes.ok
        ? "Instagram accepted the publish request but did not return the final Media ID."
        : `Instagram publish failed (${publishRes.status}).`
    );

    if (attempt < maxPublishAttempts && isTransientPublishError(message)) {
      await sleep(attempt * 7_500);
      // Confirm the same container has not moved into ERROR/EXPIRED before retry.
      const status = await getContainerStatus(accessToken, creationId, context);
      if (status.statusCode === "ERROR" || status.statusCode === "EXPIRED") {
        return {
          success: false,
          errorMessage: `Instagram media processing ${status.statusCode.toLowerCase()}${status.status ? `: ${status.status}` : "."}`,
        };
      }
      continue;
    }

    return { success: false, errorMessage: message };
  }

  return { success: false, errorMessage: "Instagram publishing failed after retrying the media container." };
}

function nativeUserTags(handles: string[]): string | undefined {
  const cleaned = handles
    .map((value) => value.trim().replace(/^@+/, ""))
    .filter(Boolean)
    .slice(0, 20);
  if (!cleaned.length) return undefined;
  return JSON.stringify(cleaned.map((username, index) => ({
    username,
    x: Math.min(0.94, 0.15 + (index % 4) * 0.22),
    y: Math.min(0.94, 0.22 + Math.floor(index / 4) * 0.18),
  })));
}

export async function publishToInstagram(
  accessToken: string,
  igUserId: string,
  post: Post,
  options?: InstagramOptions,
  context?: InstagramPublishContext
): Promise<InstagramPublishResult> {
  const type = resolveInstagramPostType(post, options);
  if (type === "carousel") return publishInstagramCarousel(accessToken, igUserId, post, options, context);

  const invalid = validateInstagramPost(post, type);
  if (invalid) return { success: false, errorMessage: invalid };

  const media = post.media[0];
  try {
    await assertInstagramPublishingQuota(accessToken, igUserId, context);
    const params = new URLSearchParams();
    const facebookLinked = context?.connectionMethod === "facebook_login";
    const nativeLocationId = facebookLinked ? options?.nativeFinish?.locationId?.trim() : "";

    if (type !== "story") {
      params.set("caption", captionFor(post, options, true, Boolean(nativeLocationId)));
      if (nativeLocationId) params.set("location_id", nativeLocationId);
    }

    if (media.type === "image") {
      params.set("image_url", media.url);
      if (type === "story") {
        params.set("media_type", "STORIES");
      } else if (facebookLinked) {
        const userTags = nativeUserTags(options?.nativeFinish?.taggedPeople ?? []);
        if (userTags) params.set("user_tags", userTags);
      }
    } else {
      params.set("video_url", media.url);
      params.set("media_type", type === "story" ? "STORIES" : "REELS");
      if (type === "reel") params.set("share_to_feed", String(options?.shareToFeed ?? true));
    }

    const container = await createContainer(accessToken, igUserId, params, context);
    if (!container.id) {
      return { success: false, errorMessage: `Container creation failed: ${container.error ?? "Unknown Instagram API error"}` };
    }

    const timeout = media.type === "video" ? VIDEO_PROCESSING_TIMEOUT_MS : IMAGE_PROCESSING_TIMEOUT_MS;
    await waitForContainerReady(accessToken, container.id, timeout, context);
    return publishContainer(accessToken, igUserId, container.id, context);
  } catch (err) {
    return { success: false, errorMessage: err instanceof Error ? err.message : "Network error during Instagram publish" };
  }
}

/** Publish a carousel post (2-10 images/videos). */
export async function publishInstagramCarousel(
  accessToken: string,
  igUserId: string,
  post: Post,
  options?: InstagramOptions,
  context?: InstagramPublishContext
): Promise<InstagramPublishResult> {
  const invalid = validateInstagramPost(post, "carousel");
  if (invalid) return { success: false, errorMessage: invalid };

  try {
    await assertInstagramPublishingQuota(accessToken, igUserId, context);
    const childIds: string[] = [];
    const facebookLinked = context?.connectionMethod === "facebook_login";
    const carouselMedia = post.media.slice(0, 10);
    for (const [mediaIndex, media] of carouselMedia.entries()) {
      const params = new URLSearchParams({ is_carousel_item: "true" });
      if (media.type === "image") {
        params.set("image_url", media.url);
        // Loomic has one global tag list today, so apply native carousel tags
        // to the first image only instead of tagging the same users on every slide.
        if (facebookLinked && mediaIndex === 0) {
          const userTags = nativeUserTags(options?.nativeFinish?.taggedPeople ?? []);
          if (userTags) params.set("user_tags", userTags);
        }
      } else {
        params.set("video_url", media.url);
        params.set("media_type", "VIDEO");
      }
      const child = await createContainer(accessToken, igUserId, params, context);
      if (!child.id) {
        return { success: false, errorMessage: `Carousel item failed: ${child.error ?? "Unknown Instagram API error"}` };
      }
      if (media.type === "video") {
        await waitForContainerReady(accessToken, child.id, VIDEO_PROCESSING_TIMEOUT_MS, context);
      }
      childIds.push(child.id);
    }

    const nativeLocationId = facebookLinked ? options?.nativeFinish?.locationId?.trim() : "";
    const parentParams = new URLSearchParams({
      media_type: "CAROUSEL",
      caption: captionFor(post, options, true, Boolean(nativeLocationId)),
      children: childIds.join(","),
    });
    if (nativeLocationId) parentParams.set("location_id", nativeLocationId);
    const parent = await createContainer(accessToken, igUserId, parentParams, context);
    if (!parent.id) {
      return { success: false, errorMessage: `Carousel container failed: ${parent.error ?? "Unknown Instagram API error"}` };
    }
    await waitForContainerReady(accessToken, parent.id, IMAGE_PROCESSING_TIMEOUT_MS, context);
    return publishContainer(accessToken, igUserId, parent.id, context);
  } catch (err) {
    return { success: false, errorMessage: err instanceof Error ? err.message : "Network error during carousel publish" };
  }
}

/** Refresh a long-lived Instagram token. */
export async function refreshLongLivedToken(currentToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(
    `${INSTAGRAM_LOGIN_GRAPH_BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(currentToken)}`
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as InstagramErrorPayload;
    throw new Error(instagramErrorMessage(data, "Token refresh failed"));
  }
  return res.json();
}

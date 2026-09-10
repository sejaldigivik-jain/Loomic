import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/secrets";

const IG_GRAPH_VERSION = process.env.META_GRAPH_API_VERSION ?? "v26.0";
const IG_GRAPH_BASE = `https://graph.instagram.com/${IG_GRAPH_VERSION}`;

interface GraphErrorPayload {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number };
}

interface InsightValue {
  value?: number | string | Record<string, unknown>;
  end_time?: string;
}

interface InsightBreakdownResult {
  dimension_values?: string[];
  value?: number | string;
}

interface InsightBreakdown {
  dimension_keys?: string[];
  results?: InsightBreakdownResult[];
}

interface InsightItem {
  name?: string;
  values?: InsightValue[];
  value?: number | string;

  total_value?: {
    value?: number | string | Record<string, unknown>;
    breakdowns?: InsightBreakdown[];
  };
}

interface InsightPayload extends GraphErrorPayload {
  data?: InsightItem[];
}

export interface InstagramAnalyticsSyncResult {
  accountId: string;
  handle: string;
  status: "synced" | "failed" | "skipped";
  accountDays: number;
  mediaSynced: number;
  needsReconnect?: boolean;
  error?: string;
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function metricValue(payload: InsightPayload, name: string): number {
  const item = payload?.data?.find((m) => m.name === name);
  const value = item?.values?.[0]?.value ?? item?.value ?? item?.total_value?.value;
  return numberValue(value);
}

function nullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function metricNullable(
  payload: InsightPayload | null | undefined,
  name: string,
): number | null {
  const item = payload?.data?.find(
    (metric) => metric.name === name,
  );

  if (!item) return null;

  const raw =
    item.values?.[0]?.value ??
    item.value ??
    item.total_value?.value;

  return nullableNumber(raw);
}

async function graphOptional<T>(
  url: string,
): Promise<T | null> {
  try {
    return await graphJson<T>(url);
  } catch {
    return null;
  }
}

function dayStart(input: Date | string) {
  const date = new Date(input);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function dayKey(input: Date | string) {
  return dayStart(input).toISOString().slice(0, 10);
}

function isInsightsPermissionError(message: string) {
  return /manage_insights|permission|permissions|oauth|access token|insufficient/i.test(message);
}

async function graphJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const message = body?.error?.message || body?.raw || `Instagram API request failed (${res.status})`;
    const error = new Error(String(message));
    (error as any).status = res.status;
    (error as any).payload = body;
    throw error;
  }
  return body as T;
}

async function fetchAccountProfile(externalUserId: string, token: string) {
  const params = new URLSearchParams({
    fields: "id,username,followers_count,media_count,profile_picture_url",
    access_token: token,
  });
  return graphJson<{
    id?: string;
    username?: string;
    followers_count?: number;
    media_count?: number;
    profile_picture_url?: string;
  }>(`${IG_GRAPH_BASE}/${externalUserId}?${params.toString()}`);
}

async function fetchAccountInsights(externalUserId: string, token: string, days: number) {
  const until = Math.floor(Date.now() / 1000);
  const since = until - Math.min(90, Math.max(7, days)) * 24 * 60 * 60;
  const metrics = [
    "reach",
    "profile_views",
    "accounts_engaged",
    "total_interactions",
    "likes",
    "comments",
    "shares",
    "saves",
    "views",
    "follower_count",
  ];

  const params = new URLSearchParams({
    metric: metrics.join(","),
    period: "day",
    since: String(since),
    until: String(until),
    access_token: token,
  });

  try {
    return await graphJson<InsightPayload>(`${IG_GRAPH_BASE}/${externalUserId}/insights?${params.toString()}`);
  } catch (groupError) {
    // Meta occasionally changes which metrics can be combined. Preserve useful
    // data by retrying metrics individually instead of failing the whole sync.
    const data: InsightItem[] = [];
    let firstError: Error | null = groupError instanceof Error ? groupError : new Error("Instagram insights request failed");
    for (const metric of metrics) {
      const single = new URLSearchParams({
        metric,
        period: "day",
        since: String(since),
        until: String(until),
        access_token: token,
      });
      try {
        const response = await graphJson<InsightPayload>(`${IG_GRAPH_BASE}/${externalUserId}/insights?${single.toString()}`);
        if (response.data?.length) data.push(...response.data);
      } catch (error) {
        if (!firstError && error instanceof Error) firstError = error;
      }
    }
    if (!data.length) throw firstError ?? new Error("Instagram did not return account insights");
    return { data } satisfies InsightPayload;
  }
}

function insightSeries(payload: InsightPayload) {
  const days = new Map<string, Record<string, number>>();
  for (const metric of payload.data ?? []) {
    if (!metric.name) continue;
    for (const point of metric.values ?? []) {
      if (!point.end_time) continue;
      const key = dayKey(point.end_time);
      const bucket = days.get(key) ?? {};
      bucket[metric.name] = numberValue(point.value);
      days.set(key, bucket);
    }
  }
  return days;
}

interface InstagramMediaRow {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  timestamp?: string;
  thumbnail_url?: string;
  media_url?: string;
  like_count?: number;
  comments_count?: number;
}

async function fetchOwnedMedia(
  externalUserId: string,
  token: string,
  maxMedia = 60,
  mediaSince?: Date,
  mediaUntil?: Date,
) {
  const fields = [
    "id",
    "caption",
    "media_type",
    "media_product_type",
    "permalink",
    "timestamp",
    "thumbnail_url",
    "media_url",
    "like_count",
    "comments_count",
  ].join(",");
  const collected: InstagramMediaRow[] = [];
  let next: string | undefined = `${IG_GRAPH_BASE}/${externalUserId}/media?${new URLSearchParams({ fields, limit: "50", access_token: token }).toString()}`;

  while (next && collected.length < maxMedia) {
    const page: { data?: InstagramMediaRow[]; paging?: { next?: string } } = await graphJson(next);
    const rows = page.data ?? [];
    collected.push(...rows);

    if (mediaSince && rows.some((row) => {
      if (!row.timestamp) return false;
      const published = new Date(row.timestamp);
      return !Number.isNaN(published.getTime()) && published.getTime() <= mediaSince.getTime();
    })) {
      break;
    }

    next = page.paging?.next;
  }
  return collected
    .filter((row) => {
      if (!row.timestamp) return !mediaSince && !mediaUntil;
      const published = new Date(row.timestamp);
      if (Number.isNaN(published.getTime())) return false;
      if (mediaSince && published.getTime() < mediaSince.getTime()) return false;
      if (mediaUntil && published.getTime() > mediaUntil.getTime()) return false;
      return true;
    })
    .slice(0, maxMedia);
}

async function fetchMediaMetricGroup(
  mediaId: string,
  token: string,
  metrics: string[],
  metricType?: "total_value",
) {
  if (!metrics.length) {
    return { data: [] } satisfies InsightPayload;
  }

  const requestMetric = async (
    metric: string,
  ): Promise<InsightItem[]> => {
    const single = new URLSearchParams({
      metric,
      access_token: token,
    });

    if (metricType) {
      single.set("metric_type", metricType);
    }

    const response =
      await graphOptional<InsightPayload>(
        `${IG_GRAPH_BASE}/${mediaId}/insights?${single.toString()}`,
      );

    return response?.data ?? [];
  };

  const params = new URLSearchParams({
    metric: metrics.join(","),
    access_token: token,
  });

  if (metricType) {
    params.set("metric_type", metricType);
  }

  let groupedData: InsightItem[] = [];

  try {
    const grouped =
      await graphJson<InsightPayload>(
        `${IG_GRAPH_BASE}/${mediaId}/insights?${params.toString()}`,
      );

    groupedData =
      grouped.data ?? [];
  } catch {
    /*
     * If the grouped request itself fails, recover every metric
     * independently so one unsupported/temporarily unavailable
     * metric cannot hide the valid ones.
     */
    groupedData = [];
  }

  /*
   * IMPORTANT:
   *
   * Meta can return HTTP 200 for a grouped request while omitting
   * one or more requested metrics from data[].
   *
   * Previously SocialFlow treated that as a complete success and
   * never retried the omitted metric. That can make values such as
   * facebook_views, crossposted_views, profile_activity, follows,
   * or watch-time remain N/A even when an individual request works.
   *
   * Retry only the missing metric names one-by-one.
   */
  const returnedNames =
    new Set(
      groupedData
        .map((item) => item.name)
        .filter(
          (name): name is string =>
            typeof name === "string" &&
            name.length > 0,
        ),
    );

  const missingMetrics =
    metrics.filter(
      (metric) =>
        !returnedNames.has(metric),
    );

  const recovered: InsightItem[] = [];

  for (const metric of missingMetrics) {
    const items =
      await requestMetric(metric);

    if (items.length) {
      recovered.push(...items);
    }
  }

  /*
   * De-duplicate by metric name. Prefer the individually recovered
   * response for a metric if both grouped and individual requests
   * somehow returned it.
   */
  const byName =
    new Map<string, InsightItem>();

  for (const item of groupedData) {
    if (item.name) {
      byName.set(item.name, item);
    }
  }

  for (const item of recovered) {
    if (item.name) {
      byName.set(item.name, item);
    }
  }

  return {
    data: Array.from(
      byName.values(),
    ),
  } satisfies InsightPayload;
}

async function fetchMediaBreakdown(
  mediaId: string,
  token: string,
  metric: string,
  breakdown: string,
): Promise<InsightPayload | null> {
  const params = new URLSearchParams({
    metric,
    metric_type: "total_value",
    breakdown,
    access_token: token,
  });

  return graphOptional<InsightPayload>(
    `${IG_GRAPH_BASE}/${mediaId}/insights?${params.toString()}`,
  );
}

type MediaBreakdownEntry = {
  key: string;
  value: number;
};

function normalizeBreakdownKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function breakdownEntries(
  payload: InsightPayload | null | undefined,
  metricName: string,
): MediaBreakdownEntry[] {
  const item =
    payload?.data?.find(
      (metric) => metric.name === metricName,
    );

  if (!item) return [];

  const entries: MediaBreakdownEntry[] = [];

  for (
    const breakdown of
    item.total_value?.breakdowns ?? []
  ) {
    for (const row of breakdown.results ?? []) {
      const rawKey =
        row.dimension_values?.[0];

      const number =
        nullableNumber(row.value);

      if (!rawKey || number === null) {
        continue;
      }

      entries.push({
        key: normalizeBreakdownKey(rawKey),
        value: number,
      });
    }
  }

  return entries;
}

function findBreakdownValue(
  entries: MediaBreakdownEntry[],
  names: string[],
): number | null {
  const wanted =
    names.map(normalizeBreakdownKey);

  const matches =
    entries.filter((entry) =>
      wanted.includes(entry.key),
    );

  if (!matches.length) return null;

  return matches.reduce(
    (total, row) => total + row.value,
    0,
  );
}

async function fetchMediaInsights(
  mediaId: string,
  token: string,
  isReel: boolean,
) {
  /*
   * Core media metrics. These are exact values returned by Meta.
   */
  const corePayload =
    await fetchMediaMetricGroup(
      mediaId,
      token,
      [
        "reach",
        "views",
        "likes",
        "comments",
        "saved",
        "shares",
        "total_interactions",
      ],
    );

  /*
   * Aggregate totals are queried with metric_type=total_value.
   * Meta SDK v26 exposes these specifically for cross-surface dashboard totals.
   */
  const totalPayload =
    await fetchMediaMetricGroup(
      mediaId,
      token,
      [
        "total_views",
        "total_likes",
        "total_comments",
      ],
      "total_value",
    );

  /*
   * Profile metrics are isolated from the core request because Meta can
   * support them differently by media type. Unsupported metrics stay null.
   */
  const profilePayload =
    await fetchMediaMetricGroup(
      mediaId,
      token,
      [
        "profile_activity",
        "profile_visits",
        "follows",
      ],
    );

  /*
   * Media-level profile activity can expose an action_type breakdown on
   * supported media. Other follower/source breakdowns shown inside the
   * Instagram app are not treated as public media-level Graph metrics.
   */
  const profileActivityBreakdownPayload =
    await fetchMediaBreakdown(
      mediaId,
      token,
      "profile_activity",
      "action_type",
    );

  /*
   * Instagram Professional Dashboard breakdowns.
   *
   * Meta SDK v26 exposes follow_type and surface_type breakdown enums.
   * These calls are best-effort: unsupported combinations simply return null
   * through graphOptional() and do not break the media sync.
   */
  const viewFollowBreakdownPayload =
    await fetchMediaBreakdown(
      mediaId,
      token,
      "views",
      "follow_type",
    );

  const viewSurfaceBreakdownPayload =
    await fetchMediaBreakdown(
      mediaId,
      token,
      "views",
      "surface_type",
    );

  const interactionFollowBreakdownPayload =
    await fetchMediaBreakdown(
      mediaId,
      token,
      "total_interactions",
      "follow_type",
    );

  /*
   * Facebook/cross-posted views are kept separate so unsupported Facebook
   * metrics never break the Instagram metrics request.
   */
  const facebookPayload =
    await fetchMediaMetricGroup(
      mediaId,
      token,
      [
        "facebook_views",
        "crossposted_views",
      ],
      "total_value",
    );

  /*
   * Reel-only analytics.
   */
  let reelPayload: InsightPayload = {
    data: [],
  };

  if (isReel) {
    reelPayload =
      await fetchMediaMetricGroup(
        mediaId,
        token,
        [
          "reels_skip_rate",
          "ig_reels_avg_watch_time",
          "ig_reels_video_view_total_time",
        ],
      );
  }

  const metaReach =
    metricNullable(
      corePayload,
      "reach",
    );

  const metaViews =
    metricNullable(
      corePayload,
      "views",
    );

  const metaTotalViews =
    metricNullable(
      totalPayload,
      "total_views",
    );

  const directFacebookViews =
    metricNullable(
      facebookPayload,
      "facebook_views",
    );

  const metaCrosspostedViews =
    metricNullable(
      facebookPayload,
      "crossposted_views",
    );

  /*
   * Prefer Meta's direct facebook_views.
   *
   * If Meta returns a combined total (total_views or crossposted_views) but
   * omits facebook_views, recover the Facebook component from that total.
   * This mirrors Instagram Professional Dashboard presentation:
   * total views = Instagram views + Facebook/cross-posted views.
   */
  const combinedMetaViews =
    metaTotalViews ??
    metaCrosspostedViews;

  const derivedFacebookViews =
    directFacebookViews === null &&
      combinedMetaViews !== null &&
      metaViews !== null &&
      combinedMetaViews >= metaViews
      ? combinedMetaViews - metaViews
      : null;

  const metaFacebookViews =
    directFacebookViews ??
    derivedFacebookViews;


  if (process.env.NODE_ENV !== "production") {
    const facebookNames =
      new Set(
        (facebookPayload.data ?? [])
          .map((item) => item.name)
          .filter(Boolean),
      );

    const stillMissing =
      [
        "facebook_views",
        "crossposted_views",
      ].filter(
        (metric) =>
          !facebookNames.has(metric),
      );

    if (stillMissing.length) {
      console.info(
        "[SocialFlow Meta Missing Media Metrics]",
        JSON.stringify({
          mediaId,
          missing: stillMissing,
        }),
      );
    }
  }

  /*
   * Total Views follows Meta's aggregate first:
   * 1. total_views
   * 2. crossposted_views
   * 3. Instagram + Facebook when both components are available
   */
  const metaDisplayViews =
    metaTotalViews ??
    metaCrosspostedViews ??
    (
      metaViews !== null &&
      metaFacebookViews !== null
        ? metaViews +
          metaFacebookViews
        : null
    );

  const metaLikes =
    metricNullable(
      corePayload,
      "likes",
    );

  const metaTotalLikes =
    metricNullable(
      totalPayload,
      "total_likes",
    );

  const metaComments =
    metricNullable(
      corePayload,
      "comments",
    );

  const metaTotalComments =
    metricNullable(
      totalPayload,
      "total_comments",
    );

  const metaShares =
    metricNullable(
      corePayload,
      "shares",
    );

  const metaSaves =
    metricNullable(
      corePayload,
      "saved",
    );

  const metaTotalInteractions =
    metricNullable(
      corePayload,
      "total_interactions",
    );

  /*
   * Followers / non-followers and view source breakdowns.
   *
   * Meta returns exact counts in total_value.breakdowns when the media type
   * and account support these breakdowns.
   */
  const viewFollowEntries =
    breakdownEntries(
      viewFollowBreakdownPayload,
      "views",
    );

  const interactionFollowEntries =
    breakdownEntries(
      interactionFollowBreakdownPayload,
      "total_interactions",
    );

  const viewSurfaceEntries =
    breakdownEntries(
      viewSurfaceBreakdownPayload,
      "views",
    );

  const metaFollowerViews =
    findBreakdownValue(
      viewFollowEntries,
      [
        "follower",
        "followers",
      ],
    );

  const metaNonFollowerViews =
    findBreakdownValue(
      viewFollowEntries,
      [
        "non_follower",
        "non_followers",
        "nonfollower",
        "nonfollowers",
      ],
    );

  const metaFollowerInteractions =
    findBreakdownValue(
      interactionFollowEntries,
      [
        "follower",
        "followers",
      ],
    );

  const metaNonFollowerInteractions =
    findBreakdownValue(
      interactionFollowEntries,
      [
        "non_follower",
        "non_followers",
        "nonfollower",
        "nonfollowers",
      ],
    );

  const metaFromHome =
    findBreakdownValue(
      viewSurfaceEntries,
      [
        "home",
        "feed",
      ],
    );

  const metaFromProfile =
    findBreakdownValue(
      viewSurfaceEntries,
      [
        "profile",
      ],
    );

  /*
   * Instagram groups remaining returned view surfaces under "Other".
   */
  const otherSurfaceRows =
    viewSurfaceEntries.filter(
      (entry) =>
        ![
          "home",
          "feed",
          "profile",
        ].includes(entry.key),
    );

  const metaFromOther =
    otherSurfaceRows.length
      ? otherSurfaceRows.reduce(
        (sum, row) => sum + row.value,
        0,
      )
      : null;

  /*
   * Profile activity total + exact action_type breakdowns when Meta exposes
   * them. We only map explicit returned action names; no subtraction or
   * estimation is used.
   */
  const profileActionEntries =
    breakdownEntries(
      profileActivityBreakdownPayload,
      "profile_activity",
    );

  const metaProfileActivity =
    metricNullable(
      profileActivityBreakdownPayload,
      "profile_activity",
    ) ??
    metricNullable(
      profilePayload,
      "profile_activity",
    );

  const metaProfileVisits =
    metricNullable(
      profilePayload,
      "profile_visits",
    ) ??
    findBreakdownValue(
      profileActionEntries,
      [
        "profile_visit",
        "profile_visits",
      ],
    );

  const metaFollows =
    metricNullable(
      profilePayload,
      "follows",
    ) ??
    findBreakdownValue(
      profileActionEntries,
      [
        "follow",
        "follows",
      ],
    );

  const metaExternalLinkTaps =
    findBreakdownValue(
      profileActionEntries,
      [
        "bio_link_clicked",
        "external_link_tap",
        "external_link_taps",
        "website_click",
        "website_clicks",
      ],
    );

  const metaBusinessAddressTaps =
    findBreakdownValue(
      profileActionEntries,
      [
        "direction",
        "directions",
        "get_directions",
        "business_address_tap",
        "business_address_taps",
      ],
    );

  /*
   * Development-only raw Meta diagnostics.
   *
   * This is intentionally server-side and is never returned to the browser.
   * On localhost it lets us compare the exact Meta payload for a media ID
   * with the Instagram app without inventing values.
   */
  if (process.env.NODE_ENV !== "production") {
    const compact = (payload: InsightPayload | null | undefined) =>
      (payload?.data ?? []).map((item) => ({
        name: item.name ?? null,
        value:
          item.values?.[0]?.value ??
          item.value ??
          item.total_value?.value ??
          null,
        breakdowns:
          item.total_value?.breakdowns ?? [],
      }));

    console.info(
      "[SocialFlow Meta Media Insights]",
      JSON.stringify(
        {
          mediaId,
          isReel,
          core: compact(corePayload),
          totals: compact(totalPayload),
          profile: compact(profilePayload),
          profileActivityBreakdown:
            compact(profileActivityBreakdownPayload),
          viewFollowBreakdown:
            compact(viewFollowBreakdownPayload),
          viewSurfaceBreakdown:
            compact(viewSurfaceBreakdownPayload),
          interactionFollowBreakdown:
            compact(interactionFollowBreakdownPayload),
          facebook: compact(facebookPayload),
          reel: compact(reelPayload),
        },
        null,
        2,
      ),
    );
  }

  /*
   * Reel performance.
   */
  const metaReelsSkipRate =
    metricNullable(
      reelPayload,
      "reels_skip_rate",
    );

  const avgWatchTimeMs =
    metricNullable(
      reelPayload,
      "ig_reels_avg_watch_time",
    );

  const totalWatchTimeMs =
    metricNullable(
      reelPayload,
      "ig_reels_video_view_total_time",
    );

  return {
    metaReach,

    metaViews,
    metaFacebookViews,
    metaCrosspostedViews,
    metaDisplayViews,
    metaTotalViews,

    metaLikes,
    metaTotalLikes,

    metaComments,
    metaTotalComments,

    metaShares,
    metaSaves,
    metaTotalInteractions,

    /*
     * There is no verified distinct public media "Viewers" or
     * "Accounts engaged" metric in this pipeline, so do not manufacture it.
     */
    metaAccountsEngaged: null,

    metaProfileActivity,
    metaProfileVisits,
    metaFollows,

    metaFollowerViews,
    metaNonFollowerViews,
    metaFollowerInteractions,
    metaNonFollowerInteractions,

    metaFromHome,
    metaFromProfile,
    metaFromOther,

    metaExternalLinkTaps,
    metaBusinessAddressTaps,

    metaReelsSkipRate,
    avgWatchTimeMs,
    totalWatchTimeMs,
  };
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const results: R[] = [];
  let index = 0;
  const run = async () => {
    while (true) {
      const current = index++;
      if (current >= items.length) return;
      results[current] = await worker(items[current]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

export async function syncInstagramAccountAnalytics(
  accountId: string,
  days = 90,
  maxMedia = 60,
  mediaSince?: Date,
  mediaUntil?: Date,
): Promise<InstagramAnalyticsSyncResult> {
  const account = await db.socialAccount.findUnique({ where: { id: accountId } });
  if (!account || account.platform !== "instagram") {
    return { accountId, handle: account?.handle ?? "Instagram", status: "skipped", accountDays: 0, mediaSynced: 0, error: "Instagram account not found" };
  }
  if (account.status !== "connected" || account.accessToken === "demo-token" || !account.externalUserId) {
    return { accountId, handle: account.handle, status: "skipped", accountDays: 0, mediaSynced: 0, error: "Instagram account is not connected with a real access token" };
  }

  try {
    const token = decryptSecret(account.accessToken);
    const [profile, accountInsights, media] = await Promise.all([
      fetchAccountProfile(account.externalUserId, token),
      fetchAccountInsights(account.externalUserId, token, days),
      fetchOwnedMedia(account.externalUserId, token, maxMedia, mediaSince, mediaUntil),
    ]);

    const today = dayStart(new Date());
    const series = insightSeries(accountInsights);
    let accountDays = 0;
    for (const [dateString, values] of series.entries()) {
      const date = dayStart(dateString);
      await db.accountAnalyticsSnapshot.upsert({
        where: { socialAccountId_date: { socialAccountId: account.id, date } },
        update: {
          newFollowers: values.follower_count ?? 0,
          reach: values.reach ?? 0,
          profileViews: values.profile_views ?? 0,
          accountsEngaged: values.accounts_engaged ?? 0,
          totalInteractions: values.total_interactions ?? 0,
          likes: values.likes ?? 0,
          comments: values.comments ?? 0,
          shares: values.shares ?? 0,
          saves: values.saves ?? 0,
          views: values.views ?? 0,
          syncedAt: new Date(),
        },
        create: {
          socialAccountId: account.id,
          date,
          newFollowers: values.follower_count ?? 0,
          reach: values.reach ?? 0,
          profileViews: values.profile_views ?? 0,
          accountsEngaged: values.accounts_engaged ?? 0,
          totalInteractions: values.total_interactions ?? 0,
          likes: values.likes ?? 0,
          comments: values.comments ?? 0,
          shares: values.shares ?? 0,
          saves: values.saves ?? 0,
          views: values.views ?? 0,
          syncedAt: new Date(),
        },
      });
      accountDays += 1;
    }

    // Store the observed point-in-time follower total separately from Meta's
    // daily follower_count metric (which represents new followers for a day).
    await db.accountAnalyticsSnapshot.upsert({
      where: { socialAccountId_date: { socialAccountId: account.id, date: today } },
      update: { followers: numberValue(profile.followers_count), syncedAt: new Date() },
      create: {
        socialAccountId: account.id,
        date: today,
        followers: numberValue(profile.followers_count),
        syncedAt: new Date(),
      },
    });

    await db.socialAccount.update({
      where: { id: account.id },
      data: {
        followers: numberValue(profile.followers_count),
        avatarUrl: profile.profile_picture_url ?? account.avatarUrl,
        status: "connected",
      },
    });

    let mediaSynced = 0;

    await mapWithConcurrency(media, 2, async (item) => {
      const isReel =
        (item.media_product_type ?? "").toUpperCase() === "REELS";

      const insights = await fetchMediaInsights(
        item.id,
        token,
        isReel,
      );

      const fallbackLikes =
        numberValue(item.like_count);

      const fallbackComments =
        numberValue(item.comments_count);

      const likes =
        insights.metaTotalLikes ??
        insights.metaLikes ??
        fallbackLikes;

      const comments =
        insights.metaTotalComments ??
        insights.metaComments ??
        fallbackComments;

      const shares =
        insights.metaShares ?? 0;

      const saves =
        insights.metaSaves ?? 0;

      const totalInteractions =
        insights.metaTotalInteractions ??
        (
          likes +
          comments +
          shares +
          saves
        );

      const legacyReach =
        insights.metaReach ?? 0;

      const legacyViews =
        insights.metaDisplayViews ??
        insights.metaViews ??
        0;

      const engagementRate =
        legacyReach > 0
          ? (
            totalInteractions /
            legacyReach
          ) * 100
          : 0;

      const publishedAt =
        item.timestamp
          ? new Date(item.timestamp)
          : null;

      /*
       * Store both legacy SocialFlow fields and the
       * exact nullable Meta insight values.
       */
      await db.instagramMediaInsight.upsert({
        where: {
          socialAccountId_externalMediaId: {
            socialAccountId: account.id,
            externalMediaId: item.id,
          },
        },

        update: {
          caption: item.caption ?? null,
          mediaType: item.media_type ?? null,
          mediaProductType:
            item.media_product_type ?? null,
          permalink: item.permalink ?? null,
          thumbnailUrl:
            item.thumbnail_url ??
            item.media_url ??
            null,
          publishedAt,

          /*
           * Existing SocialFlow fields.
           */
          reach: legacyReach,
          views: legacyViews,
          likes,
          comments,
          shares,
          saves,
          totalInteractions,
          engagementRate,

          avgWatchTimeMs:
            insights.avgWatchTimeMs,

          totalWatchTimeMs:
            insights.totalWatchTimeMs,

          /*
           * Exact Meta fields.
           * null means Meta did not return that metric.
           */
          metaReach:
            insights.metaReach,

          metaViews:
            insights.metaViews,

          metaTotalViews:
            insights.metaTotalViews,

          metaDisplayViews:
            insights.metaDisplayViews,

          metaFacebookViews:
            insights.metaFacebookViews,

          metaCrosspostedViews:
            insights.metaCrosspostedViews,

          metaLikes:
            insights.metaLikes,

          metaTotalLikes:
            insights.metaTotalLikes,

          metaComments:
            insights.metaComments,

          metaTotalComments:
            insights.metaTotalComments,

          metaShares:
            insights.metaShares,

          metaSaves:
            insights.metaSaves,

          metaTotalInteractions:
            insights.metaTotalInteractions,

          metaAccountsEngaged:
            insights.metaAccountsEngaged,

          metaProfileActivity:
            insights.metaProfileActivity,

          metaProfileVisits:
            insights.metaProfileVisits,

          metaFollows:
            insights.metaFollows,

          metaFollowerViews:
            insights.metaFollowerViews,

          metaNonFollowerViews:
            insights.metaNonFollowerViews,

          metaFollowerInteractions:
            insights.metaFollowerInteractions,

          metaNonFollowerInteractions:
            insights.metaNonFollowerInteractions,

          metaFromHome:
            insights.metaFromHome,

          metaFromProfile:
            insights.metaFromProfile,

          metaFromOther:
            insights.metaFromOther,

          metaExternalLinkTaps:
            insights.metaExternalLinkTaps,

          metaBusinessAddressTaps:
            insights.metaBusinessAddressTaps,

          metaReelsSkipRate:
            insights.metaReelsSkipRate,

          syncedAt: new Date(),
        },

        create: {
          socialAccountId: account.id,
          externalMediaId: item.id,

          caption: item.caption ?? null,
          mediaType: item.media_type ?? null,
          mediaProductType:
            item.media_product_type ?? null,
          permalink: item.permalink ?? null,
          thumbnailUrl:
            item.thumbnail_url ??
            item.media_url ??
            null,
          publishedAt,

          /*
           * Existing SocialFlow fields.
           */
          reach: legacyReach,
          views: legacyViews,
          likes,
          comments,
          shares,
          saves,
          totalInteractions,
          engagementRate,

          avgWatchTimeMs:
            insights.avgWatchTimeMs,

          totalWatchTimeMs:
            insights.totalWatchTimeMs,

          /*
           * Exact Meta fields.
           */
          metaReach:
            insights.metaReach,

          metaViews:
            insights.metaViews,

          metaTotalViews:
            insights.metaTotalViews,

          metaDisplayViews:
            insights.metaDisplayViews,

          metaFacebookViews:
            insights.metaFacebookViews,

          metaCrosspostedViews:
            insights.metaCrosspostedViews,

          metaLikes:
            insights.metaLikes,

          metaTotalLikes:
            insights.metaTotalLikes,

          metaComments:
            insights.metaComments,

          metaTotalComments:
            insights.metaTotalComments,

          metaShares:
            insights.metaShares,

          metaSaves:
            insights.metaSaves,

          metaTotalInteractions:
            insights.metaTotalInteractions,

          metaAccountsEngaged:
            insights.metaAccountsEngaged,

          metaProfileActivity:
            insights.metaProfileActivity,

          metaProfileVisits:
            insights.metaProfileVisits,

          metaFollows:
            insights.metaFollows,

          metaFollowerViews:
            insights.metaFollowerViews,

          metaNonFollowerViews:
            insights.metaNonFollowerViews,

          metaFollowerInteractions:
            insights.metaFollowerInteractions,

          metaNonFollowerInteractions:
            insights.metaNonFollowerInteractions,

          metaFromHome:
            insights.metaFromHome,

          metaFromProfile:
            insights.metaFromProfile,

          metaFromOther:
            insights.metaFromOther,

          metaExternalLinkTaps:
            insights.metaExternalLinkTaps,

          metaBusinessAddressTaps:
            insights.metaBusinessAddressTaps,

          metaReelsSkipRate:
            insights.metaReelsSkipRate,

          syncedAt: new Date(),
        },
      });

      /*
       * Keep legacy Analytics rows working for media that
       * was originally published through SocialFlow.
       */
      const target =
        await db.postTarget.findFirst({
          where: {
            socialAccountId: account.id,
            externalId: item.id,
          },
          select: {
            postId: true,
          },
        });

      if (target) {
        await db.analytics.upsert({
          where: {
            postId_socialAccountId_date: {
              postId: target.postId,
              socialAccountId: account.id,
              date: today,
            },
          },

          update: {
            reach: legacyReach,
            impressions: legacyViews,
            likes,
            comments,
            shares,
            saves,
            engagementRate,
          },

          create: {
            postId: target.postId,
            socialAccountId: account.id,
            date: today,
            reach: legacyReach,
            impressions: legacyViews,
            likes,
            comments,
            shares,
            saves,
            engagementRate,
          },
        });
      }

      /*
       * IMPORTANT:
       * This must stay INSIDE the mapWithConcurrency callback.
       */
      mediaSynced += 1;
    });

    return {
      accountId: account.id,
      handle: account.handle,
      status: "synced",
      accountDays,
      mediaSynced,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Instagram analytics sync failed";
    return {
      accountId: account.id,
      handle: account.handle,
      status: "failed",
      accountDays: 0,
      mediaSynced: 0,
      needsReconnect: isInsightsPermissionError(message),
      error: message,
    };
  }
}

/**
 * Backward-compatible cron entry point. It now syncs real account insights and
 * all recent Instagram-owned media, not only posts created inside SocialFlow.
 */
export async function syncInstagramAnalytics(limit = 100, accountId?: string) {
  const accounts = await db.socialAccount.findMany({
    where: {
      ...(accountId ? { id: accountId } : {}),
      platform: "instagram",
      status: "connected",
      accessToken: { not: "demo-token" },
      externalUserId: { not: null },
    },
    select: { id: true },
    take: accountId ? 1 : Math.max(1, Math.min(25, limit)),
  });

  const results: InstagramAnalyticsSyncResult[] = [];
  for (const account of accounts) {
    results.push(await syncInstagramAccountAnalytics(account.id, 90, 60));
  }
  return results;
}

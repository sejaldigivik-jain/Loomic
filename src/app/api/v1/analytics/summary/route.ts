/**
 * GET /api/v1/analytics/summary?workspaceId=...&range=30d
 *
 * Real Instagram analytics for connected professional accounts. Data is read
 * from snapshots populated by the Meta Instagram Insights API sync job.
 */
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireWorkspace } from "@/lib/server-auth";
import { resolveAccountScope } from "@/lib/account-access";

export const runtime = "nodejs";

const RANGES: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setUTCHours(23, 59, 59, 999);
  return copy;
}

function parseDateOnly(value: string | null, end = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1));
}

function nullablePct(
  part: number | null | undefined,
  other: number | null | undefined,
) {
  if (
    part === null ||
    part === undefined ||
    other === null ||
    other === undefined
  ) {
    return null;
  }

  const total = part + other;

  if (total <= 0) return 0;

  return Number(
    (
      (part / total) *
      100
    ).toFixed(1),
  );
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function sum<T>(rows: T[], pick: (row: T) => number) {
  return rows.reduce((total, row) => total + (pick(row) || 0), 0);
}

function localDateParts(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      weekday: "long",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(date);
    return {
      weekday: parts.find((p) => p.type === "weekday")?.value ?? "Unknown",
      hour: Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24,
    };
  } catch {
    return { weekday: date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }), hour: date.getUTCHours() };
  }
}

function formatName(mediaType?: string | null, productType?: string | null) {
  const product = (productType ?? "").toUpperCase();
  const media = (mediaType ?? "").toUpperCase();
  if (product === "REELS") return "Reel";
  if (media === "CAROUSEL_ALBUM") return "Carousel";
  if (product === "STORY") return "Story";
  if (media === "VIDEO") return "Video";
  return "Post";
}

function themeForCaption(caption?: string | null) {
  const text = (caption ?? "").toLowerCase();
  const rules: Array<[string, RegExp]> = [
    ["Offers", /\b(offer|sale|discount|off|deal|buy one|1\+1|2\+1|mrp|free)\b/],
    ["Events", /\b(live|dj|night|friday|saturday|sunday|event|party|karaoke|brunch|sundowner|music)\b/],
    ["Food & Drink", /\b(food|dish|menu|cocktail|beer|drink|wine|rum|vodka|restaurant|chef|dining)\b/],
    ["Education", /\b(course|learn|training|student|career|class|academy|skill|education|bim|gis)\b/],
    ["Product", /\b(product|launch|shop|collection|new arrival|feature|buy|order)\b/],
    ["Tips & Education", /\b(tip|guide|how to|did you know|learn|save this|steps|mistake|ideas)\b/],
    ["Community", /\b(community|together|celebrate|memory|friends|family|people|join us)\b/],
  ];
  return rules.find(([, regex]) => regex.test(text))?.[0] ?? "General";
}

function buildIntelligence(media: any[], timezone: string) {
  if (!media.length) {
    return {
      bestDay: null,
      bestTime: null,
      bestFormat: null,
      topTheme: null,
      weakTheme: null,
      recommendations: ["Sync Instagram insights to generate recommendations from real account data."],
    };
  }

  const dayMap = new Map<string, { reach: number; engagement: number; count: number }>();
  const timeMap = new Map<string, { reach: number; engagement: number; count: number }>();
  const formatMap = new Map<string, { reach: number; engagement: number; count: number }>();
  const themeMap = new Map<string, { reach: number; engagement: number; count: number }>();

  for (const item of media) {
    if (!item.publishedAt) continue;
    const { weekday, hour } = localDateParts(item.publishedAt, timezone);
    const start = Math.floor(hour / 3) * 3;
    const timeKey = `${String(start).padStart(2, "0")}:00–${String((start + 3) % 24).padStart(2, "0")}:00`;
    const format = formatName(item.mediaType, item.mediaProductType);
    const theme = themeForCaption(item.caption);
    const engagement = item.totalInteractions ?? item.likes + item.comments + item.shares + item.saves;

    for (const [map, key] of [[dayMap, weekday], [timeMap, timeKey], [formatMap, format], [themeMap, theme]] as const) {
      const bucket = map.get(key) ?? { reach: 0, engagement: 0, count: 0 };
      bucket.reach += item.reach ?? 0;
      bucket.engagement += engagement ?? 0;
      bucket.count += 1;
      map.set(key, bucket);
    }
  }

  const rank = (map: Map<string, { reach: number; engagement: number; count: number }>, desc = true) =>
    Array.from(map.entries())
      .map(([name, v]) => ({
        name,
        count: v.count,
        avgReach: v.count ? Math.round(v.reach / v.count) : 0,
        avgEngagement: v.count ? Number((v.engagement / v.count).toFixed(1)) : 0,
        score: v.count ? v.reach / v.count + (v.engagement / v.count) * 5 : 0,
      }))
      .sort((a, b) => desc ? b.score - a.score : a.score - b.score);

  const days = rank(dayMap);
  const times = rank(timeMap);
  const formats = rank(formatMap);
  const themes = rank(themeMap);
  const weakThemes = rank(themeMap, false);
  const recommendations: string[] = [];

  if (formats[0]) recommendations.push(`${formats[0].name}s are your strongest format in this period. Keep them prominent in the content mix.`);
  if (days[0] && times[0]) recommendations.push(`Your strongest publishing window is ${days[0].name}, around ${times[0].name} (${timezone}).`);
  if (themes[0]) recommendations.push(`${themes[0].name} content is currently your strongest theme by average reach and interactions.`);
  if (weakThemes[0] && weakThemes[0].name !== themes[0]?.name) recommendations.push(`${weakThemes[0].name} content is underperforming relative to your other themes; test a different hook, creative or CTA.`);

  const saveHeavy = media.filter((m) => (m.saves ?? 0) > (m.shares ?? 0) && (m.saves ?? 0) > 0).length;
  if (saveHeavy >= Math.max(2, Math.ceil(media.length * 0.25))) recommendations.push("A meaningful share of your content is save-heavy. Repeat useful, reference-style content that people want to revisit.");

  return {
    bestDay: days[0] ?? null,
    bestTime: times[0] ?? null,
    bestFormat: formats[0] ?? null,
    topTheme: themes[0] ?? null,
    weakTheme: weakThemes[0] ?? null,
    dayRanking: days,
    formatRanking: formats,
    themeRanking: themes,
    recommendations: recommendations.slice(0, 5),
  };
}

export const GET = withHandler(null, async ({ req }) => {
  const url = new URL(req.url);
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

  const requestedPlatform = url.searchParams.get("platform");
  const rangeKey = url.searchParams.get("range") ?? "30d";
  const realNow = new Date();

  let since: Date;
  let until: Date;
  let days: number;

  if (rangeKey === "custom") {
    const from = parseDateOnly(url.searchParams.get("from"));
    const to = parseDateOnly(url.searchParams.get("to"), true);
    if (!from || !to) throw ApiError.badRequest("Custom analytics requires valid from and to dates");
    if (from.getTime() > to.getTime()) throw ApiError.badRequest("From date must be before or equal to To date");
    if (to.getTime() > endOfDay(realNow).getTime()) throw ApiError.badRequest("To date cannot be in the future");

    since = startOfDay(from);
    until = endOfDay(to);
    days = Math.floor((startOfDay(to).getTime() - since.getTime()) / 86400000) + 1;
  } else {
    days = RANGES[rangeKey] ?? 30;
    until = realNow;
    since = startOfDay(new Date(until.getTime() - (days - 1) * 86400000));
  }

  const previousUntil = new Date(since.getTime() - 1);
  const previousSince = startOfDay(new Date(since.getTime() - days * 86400000));

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId }, select: { timezone: true } });
  const accounts = await db.socialAccount.findMany({
    where: {
      workspaceId,
      platform: "instagram",
      ...(accountScope ? { id: { in: accountScope } } : {}),
      ...(requestedPlatform && requestedPlatform !== "instagram" ? { id: "__no_instagram_for_selected_platform__" } : {}),
    },
    select: { id: true, handle: true, displayName: true, avatarUrl: true, followers: true, status: true },
  });
  const accountIds = accounts.map((a) => a.id);

  const [currentSnapshots, previousSnapshots, currentMedia, previousMedia, latestSnapshot, latestMedia] = accountIds.length
    ? await Promise.all([
      db.accountAnalyticsSnapshot.findMany({ where: { socialAccountId: { in: accountIds }, date: { gte: since, lte: until } }, orderBy: { date: "asc" } }),
      db.accountAnalyticsSnapshot.findMany({ where: { socialAccountId: { in: accountIds }, date: { gte: previousSince, lte: previousUntil } }, orderBy: { date: "asc" } }),
      db.instagramMediaInsight.findMany({ where: { socialAccountId: { in: accountIds }, publishedAt: { gte: since, lte: until } }, orderBy: { publishedAt: "desc" } }),
      db.instagramMediaInsight.findMany({ where: { socialAccountId: { in: accountIds }, publishedAt: { gte: previousSince, lte: previousUntil } }, orderBy: { publishedAt: "desc" } }),
      db.accountAnalyticsSnapshot.findFirst({ where: { socialAccountId: { in: accountIds } }, orderBy: { syncedAt: "desc" }, select: { syncedAt: true } }),
      db.instagramMediaInsight.findFirst({ where: { socialAccountId: { in: accountIds } }, orderBy: { syncedAt: "desc" }, select: { syncedAt: true } }),
    ])
    : [[], [], [], [], null, null] as any;

  const aggregateSnapshots = (rows: any[]) => ({
    reach: sum(rows, (r) => r.reach),
    profileViews: sum(rows, (r) => r.profileViews),
    views: sum(rows, (r) => r.views),
    accountsEngaged: sum(rows, (r) => r.accountsEngaged),
    totalInteractions: sum(rows, (r) => r.totalInteractions),
    likes: sum(rows, (r) => r.likes),
    comments: sum(rows, (r) => r.comments),
    shares: sum(rows, (r) => r.shares),
    saves: sum(rows, (r) => r.saves),
    newFollowers: sum(rows, (r) => r.newFollowers),
  });

  const current = aggregateSnapshots(currentSnapshots as any[]);
  const previous = aggregateSnapshots(previousSnapshots as any[]);
  const followers = accounts.reduce((total, account) => total + account.followers, 0);

  /*
   * Follower Growth
   *
   * Use Meta's follower_count insight accumulated
   * across the selected period.
   *
   * Do not calculate this card from two stored
   * point-in-time follower totals because identical
   * snapshots can incorrectly show growth as 0.
   */
  const followerGrowth =
    current.newFollowers;

  const startingFollowers =
    Math.max(
      0,
      followers - followerGrowth,
    );

  const followerGrowthPct =
    startingFollowers > 0
      ? Number(
        (
          (
            followerGrowth /
            startingFollowers
          ) *
          100
        ).toFixed(2),
      )
      : null;

  const seriesMap = new Map<string, { date: string; reach: number; engagement: number; profileViews: number; views: number; newFollowers: number }>();
  for (const row of currentSnapshots as any[]) {
    const key = row.date.toISOString().slice(0, 10);
    const bucket = seriesMap.get(key) ?? { date: key, reach: 0, engagement: 0, profileViews: 0, views: 0, newFollowers: 0 };
    bucket.reach += row.reach;
    bucket.engagement += row.totalInteractions || row.likes + row.comments + row.shares + row.saves;
    bucket.profileViews += row.profileViews;
    bucket.views += row.views;
    bucket.newFollowers += row.newFollowers;
    seriesMap.set(key, bucket);
  }

  const content =
    (currentMedia as any[])
      .map((item) => {
        const numberOrNull = (
          value: unknown,
        ): number | null => {
          if (
            value === null ||
            value === undefined
          ) {
            return null;
          }

          const numeric = Number(value);

          return Number.isFinite(numeric)
            ? numeric
            : null;
        };


        /*
         * ==================================================
         * REACH
         * ==================================================
         */

        const displayReach =
          numberOrNull(
            item.metaReach,
          ) ??
          numberOrNull(
            item.reach,
          );


        /*
         * ==================================================
         * VIEWS
         * ==================================================
         *
         * Instagram Views
         * Facebook Views
         * Total Views
         */

        const instagramViews =
          numberOrNull(
            item.metaViews,
          );

        /*
         * Facebook Views is exact Meta facebook_views only.
         * Missing stays null/N/A; a literal Meta 0 stays 0.
         */
        const facebookViews =
          numberOrNull(
            item.metaFacebookViews,
          );

        const crosspostedViews =
          numberOrNull(
            item.metaCrosspostedViews,
          );

        /*
         * Total Views:
         * 1. exact Meta crossposted_views when present
         * 2. Instagram + Facebook only when BOTH platform values exist
         * Otherwise null/N/A.
         */
        const calculatedCombinedViews =
          instagramViews !== null &&
            facebookViews !== null
            ? instagramViews +
              facebookViews
            : null;

        const totalViews =
          crosspostedViews ??
          calculatedCombinedViews;

        /*
         * Backward-compatible generic "views" can still represent the best
         * available viewing signal without changing the strict Total Views field.
         */
        const displayViews =
          totalViews ??
          instagramViews ??
          numberOrNull(
            item.views,
          );


        /*
         * ==================================================
         * LIKES / COMMENTS / SHARES / SAVES
         * ==================================================
         */

        const displayLikes =
          numberOrNull(
            item.metaTotalLikes,
          ) ??
          numberOrNull(
            item.metaLikes,
          ) ??
          numberOrNull(
            item.likes,
          );


        const displayComments =
          numberOrNull(
            item.metaTotalComments,
          ) ??
          numberOrNull(
            item.metaComments,
          ) ??
          numberOrNull(
            item.comments,
          );


        /*
         * Shares/Saves are exact nullable Meta insight fields.
         * Do not fall back to legacy default-zero columns.
         */
        const displayShares =
          numberOrNull(
            item.metaShares,
          );

        const displaySaves =
          numberOrNull(
            item.metaSaves,
          );


        /*
         * ==================================================
         * INTERACTIONS
         * ==================================================
         */

        const metaInteractions =
          numberOrNull(
            item.metaTotalInteractions,
          );


        const calculatedInteractions =
          displayLikes !== null &&
            displayComments !== null &&
            displayShares !== null &&
            displaySaves !== null
            ? displayLikes +
              displayComments +
              displayShares +
              displaySaves
            : null;


        const displayInteractions =
          metaInteractions ??
          calculatedInteractions;


        /*
         * Loomic-derived ER.
         */
        const derivedEr =
          displayReach !== null &&
            displayReach > 0 &&
            displayInteractions !== null
            ? Number(
              (
                (
                  displayInteractions! /
                  displayReach
                ) *
                100
              ).toFixed(2),
            )
            : null;


        /*
         * ==================================================
         * FOLLOWER / NON-FOLLOWER VIEW BREAKDOWN
         * ==================================================
         */

        const followerViews =
          numberOrNull(
            item.metaFollowerViews,
          );

        const nonFollowerViews =
          numberOrNull(
            item.metaNonFollowerViews,
          );


        /*
         * ==================================================
         * FOLLOWER / NON-FOLLOWER INTERACTIONS
         * ==================================================
         */

        const followerInteractions =
          numberOrNull(
            item.metaFollowerInteractions,
          );

        const nonFollowerInteractions =
          numberOrNull(
            item.metaNonFollowerInteractions,
          );


        return {
          id:
            item.id,

          externalMediaId:
            item.externalMediaId,

          accountId:
            item.socialAccountId,

          caption:
            item.caption,

          format:
            formatName(
              item.mediaType,
              item.mediaProductType,
            ),

          permalink:
            item.permalink,

          thumbnailUrl:
            item.thumbnailUrl,

          publishedAt:
            item.publishedAt,


          /*
           * ==================================================
           * MAIN CONTENT ANALYTICS
           * ==================================================
           */

          reach:
            displayReach,

          views:
            displayViews,

          instagramViews,

          facebookViews,

          totalViews,

          crosspostedViews,


          likes:
            displayLikes,

          comments:
            displayComments,

          shares:
            displayShares,

          saves:
            displaySaves,

          interactions:
            displayInteractions,

          totalInteractions:
            displayInteractions,

          engagementRate:
            derivedEr,


          /*
           * ==================================================
           * VIEWS DETAILS
           * ==================================================
           */

          followerViews,

          nonFollowerViews,

          followerViewPct:
            nullablePct(
              followerViews,
              nonFollowerViews,
            ),

          nonFollowerViewPct:
            nullablePct(
              nonFollowerViews,
              followerViews,
            ),


          /*
           * Do not substitute Reach for Viewers.
           *
           * This will automatically start returning
           * a value later if the sync/schema stores
           * metaViewers.
           */
          viewers:
            null,


          /*
           * Instagram source breakdown.
           */
          fromHome:
            numberOrNull(
              item.metaFromHome,
            ),

          fromOther:
            numberOrNull(
              item.metaFromOther,
            ),

          fromProfile:
            numberOrNull(
              item.metaFromProfile,
            ),


          /*
           * ==================================================
           * INTERACTION DETAILS
           * ==================================================
           */

          followerInteractions,

          nonFollowerInteractions,

          followerInteractionPct:
            nullablePct(
              followerInteractions,
              nonFollowerInteractions,
            ),

          nonFollowerInteractionPct:
            nullablePct(
              nonFollowerInteractions,
              followerInteractions,
            ),

          accountsEngaged:
            numberOrNull(
              item.metaAccountsEngaged,
            ),

          postInteractions:
            null,

          reelsInteractions:
            null,


          /*
           * ==================================================
           * PROFILE
           * ==================================================
           */

          profileActivity:
            numberOrNull(
              item.metaProfileActivity,
            ),

          profileVisits:
            numberOrNull(
              item.metaProfileVisits,
            ),

          externalLinkTaps:
            numberOrNull(
              item.metaExternalLinkTaps,
            ),

          businessAddressTaps:
            numberOrNull(
              item.metaBusinessAddressTaps,
            ),

          follows:
            numberOrNull(
              item.metaFollows,
            ),


          /*
           * ==================================================
           * FACEBOOK
           * ==================================================
           */

          facebookReactions:
            null,

          facebookComments:
            null,


          /*
           * ==================================================
           * REEL PERFORMANCE
           * ==================================================
           */

          reelsSkipRate:
            numberOrNull(
              item.metaReelsSkipRate,
            ),

          avgWatchTimeMs:
            numberOrNull(
              item.avgWatchTimeMs,
            ),

          totalWatchTimeMs:
            numberOrNull(
              item.totalWatchTimeMs,
            ),


          /*
           * ==================================================
           * LOCAL CLASSIFICATION
           * ==================================================
           */

          theme:
            themeForCaption(
              item.caption,
            ),
        };
      })

      /*
       * Performance ranking by Reach.
       */
      .sort(
        (a, b) =>
          Number(
            b.reach ?? 0,
          ) -
          Number(
            a.reach ?? 0,
          ),
      )

      .map(
        (item, index) => ({
          ...item,
          rank:
            index + 1,
        }),
      );

  const currentContentTotals = {
    published: (currentMedia as any[]).length,
    reach: sum(currentMedia as any[], (r) => r.reach),
    interactions: sum(currentMedia as any[], (r) => r.totalInteractions),
  };
  const previousContentTotals = {
    published: (previousMedia as any[]).length,
    reach: sum(previousMedia as any[], (r) => r.reach),
    interactions: sum(previousMedia as any[], (r) => r.totalInteractions),
  };

  const accountBreakdown = accounts.map((account) => {
    const rows = (currentSnapshots as any[]).filter((r) => r.socialAccountId === account.id);
    const mediaRows = (currentMedia as any[]).filter((r) => r.socialAccountId === account.id);
    const agg = aggregateSnapshots(rows);
    return {
      id: account.id,
      handle: account.handle,
      displayName: account.displayName,
      avatarUrl: account.avatarUrl,
      followers: account.followers,
      reach: agg.reach,
      profileViews: agg.profileViews,
      views: agg.views,
      engagement: agg.totalInteractions || agg.likes + agg.comments + agg.shares + agg.saves,
      engagementRate: agg.reach > 0 ? Number((((agg.totalInteractions || agg.likes + agg.comments + agg.shares + agg.saves) / agg.reach) * 100).toFixed(2)) : 0,
      contentPublished: mediaRows.length,
      status: account.status,
    };
  });

  const engagement =
    current.totalInteractions ||
    current.likes +
    current.comments +
    current.shares +
    current.saves;

  const previousEngagement =
    previous.totalInteractions ||
    previous.likes +
    previous.comments +
    previous.shares +
    previous.saves;

  /*
   * Account-level engagement is preferred when Meta returned it.
   *
   * If Meta account interactions are unavailable but real
   * media-level Reach/interactions exist, use Content Engagement Rate.
   */
  const accountEngagementRate =
    current.reach > 0 && engagement > 0
      ? Number(
        (
          (engagement / current.reach) *
          100
        ).toFixed(2),
      )
      : null;

  const previousAccountEngagementRate =
    previous.reach > 0 &&
      previousEngagement > 0
      ? Number(
        (
          (previousEngagement /
            previous.reach) *
          100
        ).toFixed(2),
      )
      : null;

  const contentEngagementRate =
    currentContentTotals.reach > 0
      ? Number(
        (
          (currentContentTotals.interactions /
            currentContentTotals.reach) *
          100
        ).toFixed(2),
      )
      : null;

  const previousContentEngagementRate =
    previousContentTotals.reach > 0
      ? Number(
        (
          (previousContentTotals.interactions /
            previousContentTotals.reach) *
          100
        ).toFixed(2),
      )
      : null;

  const engagementRateSource =
    accountEngagementRate !== null
      ? "account"
      : contentEngagementRate !== null
        ? "content"
        : "unavailable";

  const engagementRate =
    engagementRateSource === "account"
      ? accountEngagementRate
      : engagementRateSource === "content"
        ? contentEngagementRate
        : null;

  /*
   * Compare like-for-like data only.
   * Never compare Content Engagement Rate against Account Engagement Rate.
   */
  const comparablePreviousEngagementRate =
    engagementRateSource === "account"
      ? previousAccountEngagementRate
      : engagementRateSource === "content"
        ? previousContentEngagementRate
        : null;

  /*
   * The existing sync stores an unavailable profile_views response
   * as 0. Until availability itself is stored separately, treat a
   * zero account total as unavailable rather than claiming there
   * were definitely zero profile visits.
   */
  const profileViewsAvailable =
    current.profileViews > 0;

  const previousProfileViewsAvailable =
    previous.profileViews > 0;

  const lastSyncedAt = [
    latestSnapshot?.syncedAt,
    latestMedia?.syncedAt,
  ]
    .filter(Boolean)
    .sort(
      (a: any, b: any) =>
        b.getTime() - a.getTime(),
    )[0] ?? null;

  return ok({
    source: "instagram_insights",
    range: rangeKey,
    days,
    from: since.toISOString().slice(0, 10),
    to: until.toISOString().slice(0, 10),
    lastSyncedAt,
    accountCount: accounts.length,
    accounts: accountBreakdown,
    totals: {
      followers,
      followerGrowth,
      followerGrowthPct,
      followerGrowthSource:
        "new_followers",
      reach: current.reach,
      views: current.views,
      profileViews: current.profileViews,
      profileViewsAvailable,

      engagement,

      engagementRate,
      engagementRateSource,
      engagementRateAvailable:
        engagementRate !== null,

      accountsEngaged: current.accountsEngaged,
      likes: current.likes,
      comments: current.comments,
      shares: current.shares,
      saves: current.saves,
      contentPublished: currentContentTotals.published,
    },
    comparisons: {
      reach: pctChange(current.reach, previous.reach),
      views: pctChange(current.views, previous.views),
      profileViews:
        profileViewsAvailable &&
          previousProfileViewsAvailable
          ? pctChange(
            current.profileViews,
            previous.profileViews,
          )
          : null,

      engagement:
        pctChange(
          engagement,
          previousEngagement,
        ),

      engagementRate:
        engagementRate !== null &&
          comparablePreviousEngagementRate !== null
          ? pctChange(
            engagementRate,
            comparablePreviousEngagementRate,
          )
          : null,
      contentPublished: pctChange(currentContentTotals.published, previousContentTotals.published),
      contentReach: pctChange(currentContentTotals.reach, previousContentTotals.reach),
      contentInteractions: pctChange(currentContentTotals.interactions, previousContentTotals.interactions),
    },
    series: Array.from(seriesMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    content,
    intelligence: buildIntelligence(currentMedia as any[], workspace?.timezone ?? "UTC"),
    meta: {
      timezone:
        workspace?.timezone ??
        "UTC",

      historyNote:
        "Follower growth uses Meta's follower_count insight accumulated across the selected period.",

      reachNote:
        "Range totals are derived from Meta's stored daily account insight snapshots; individual day values are direct Instagram Insights data.",

      customRangeNote:
        rangeKey === "custom" &&
          days > 90
          ? "Meta retains account-level User Insights for up to 90 days. Older custom ranges can still include Instagram media that Loomic synced, but account profile activity may be unavailable unless Loomic had already stored snapshots for those dates."
          : null,
    },
  });
});

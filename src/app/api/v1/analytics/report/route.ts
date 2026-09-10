import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/secrets";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireWorkspace } from "@/lib/server-auth";
import { resolveAccountScope } from "@/lib/account-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IG_GRAPH_VERSION = process.env.META_GRAPH_API_VERSION ?? "v26.0";
const IG_GRAPH_BASE = `https://graph.instagram.com/${IG_GRAPH_VERSION}`;

const RANGE_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

type GraphPayload = {
  data?: Array<{
    name?: string;
    value?: unknown;
    values?: Array<{
      value?: unknown;
    }>;
    total_value?: {
      value?: unknown;
      breakdowns?: Array<{
        dimension_keys?: string[];
        results?: Array<{
          dimension_values?: string[];
          value?: number;
        }>;
      }>;
    };
  }>;
};

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setUTCHours(23, 59, 59, 999);
  return copy;
}

function parseDateOnly(value: string | null, end = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(
    `${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`,
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function metricValue(payload: GraphPayload | null): number | null {
  const item = payload?.data?.[0];

  if (!item) {
    return null;
  }

  const raw =
    item.values?.[0]?.value ??
    item.value ??
    item.total_value?.value;

  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }

  const parsed = Number(raw);

  return Number.isFinite(parsed) ? parsed : null;
}

function breakdownRows(payload: GraphPayload | null) {
  const result: Array<{
    label: string;
    value: number;
  }> = [];

  for (const item of payload?.data ?? []) {
    for (const breakdown of item.total_value?.breakdowns ?? []) {
      for (const row of breakdown.results ?? []) {
        const label = (row.dimension_values ?? [])
          .filter(Boolean)
          .join(" / ");

        const value = Number(row.value ?? 0);

        if (label && Number.isFinite(value)) {
          result.push({
            label,
            value,
          });
        }
      }
    }
  }

  return result.sort((a, b) => b.value - a.value);
}

async function graphOptional(
  url: string,
): Promise<GraphPayload | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as GraphPayload;
  } catch {
    return null;
  }
}

function selectedWindow(url: URL) {
  const range = url.searchParams.get("range") ?? "30d";

  if (range === "custom") {
    const from = parseDateOnly(url.searchParams.get("from"));
    const to = parseDateOnly(
      url.searchParams.get("to"),
      true,
    );

    if (!from || !to) {
      throw ApiError.badRequest(
        "Custom report requires valid from and to dates",
      );
    }

    if (from.getTime() > to.getTime()) {
      throw ApiError.badRequest(
        "From date must be before or equal to To date",
      );
    }

    return {
      from: startOfDay(from),
      to: endOfDay(to),
      days:
        Math.floor(
          (startOfDay(to).getTime() -
            startOfDay(from).getTime()) /
            86400000,
        ) + 1,
    };
  }

  const days = RANGE_DAYS[range] ?? 30;

  const to = new Date();

  const from = startOfDay(
    new Date(
      to.getTime() -
        (days - 1) * 86400000,
    ),
  );

  return {
    from,
    to,
    days,
  };
}

function demographicTimeframe(days: number) {
  if (days <= 14) {
    return "last_14_days";
  }

  if (days <= 30) {
    return "last_30_days";
  }

  return "last_90_days";
}

function normalizePercent(value: number | null) {
  if (value === null) {
    return null;
  }

  const percentage =
    Math.abs(value) <= 1
      ? value * 100
      : value;

  return Number(
    percentage.toFixed(2),
  );
}

export const GET = withHandler(null, async ({ req }) => {
  const url = new URL(req.url);

  const workspaceId =
    url.searchParams.get("workspaceId");

  if (!workspaceId) {
    throw ApiError.badRequest(
      "workspaceId is required",
    );
  }

  const auth = await requireWorkspace(
    req,
    workspaceId,
  );

  const accountScope =
    await resolveAccountScope({
      workspaceId,
      userId: auth.userId,
      role: auth.role,
      requestedMemberId:
        url.searchParams.get("memberId"),
      requestedAccountId:
        url.searchParams.get("accountId") ??
        url.searchParams.get("clientId"),
    });

  const requestedPlatform =
    url.searchParams.get("platform");

  if (
    requestedPlatform &&
    requestedPlatform !== "instagram"
  ) {
    return ok({
      available: false,
      reason:
        "Insights Report currently supports Instagram analytics only.",
      demographics: {
        available: false,
        age: [],
        gender: [],
        city: [],
      },
      followerNonFollower: {
        available: false,
      },
      skipRate: {
        available: false,
        averagePct: null,
        items: [],
      },
      adReach: {
        available: false,
        value: null,
        reason:
          "Ad Reach requires Meta Marketing API access.",
      },
    });
  }

  const accounts =
    await db.socialAccount.findMany({
      where: {
        workspaceId,
        platform: "instagram",
        status: "connected",
        ...(accountScope
          ? {
              id: {
                in: accountScope,
              },
            }
          : {}),
      },
      select: {
        id: true,
        handle: true,
        displayName: true,
        externalUserId: true,
        accessToken: true,
      },
    });

  if (accounts.length !== 1) {
    return ok({
      available: false,
      reason:
        accounts.length === 0
          ? "No connected Instagram account is available."
          : "Select one Instagram client to load demographics, follower/non-follower data and Reel skip rate.",

      demographics: {
        available: false,
        age: [],
        gender: [],
        city: [],
      },

      followerNonFollower: {
        available: false,
      },

      skipRate: {
        available: false,
        averagePct: null,
        items: [],
      },

      adReach: {
        available: false,
        value: null,
        reason:
          "Meta Marketing API / ads_read connection is not configured in the current Instagram analytics connection.",
      },
    });
  }

  const account = accounts[0];

  if (
    !account.externalUserId ||
    !account.accessToken ||
    account.accessToken === "demo-token"
  ) {
    return ok({
      available: false,

      reason:
        "The selected Instagram account does not have a real Insights connection.",

      demographics: {
        available: false,
        age: [],
        gender: [],
        city: [],
      },

      followerNonFollower: {
        available: false,
      },

      skipRate: {
        available: false,
        averagePct: null,
        items: [],
      },

      adReach: {
        available: false,
        value: null,
        reason:
          "Meta Marketing API / ads_read connection is not configured.",
      },
    });
  }

  const token = decryptSecret(
    account.accessToken,
  );

  const {
    from,
    to,
    days,
  } = selectedWindow(url);

  const sinceUnix = Math.floor(
    from.getTime() / 1000,
  );

  const untilUnix = Math.floor(
    to.getTime() / 1000,
  );

  const timeframe =
    demographicTimeframe(days);

  async function demographic(
    breakdown:
      | "age"
      | "gender"
      | "city",
  ) {
    const params = new URLSearchParams({
      metric: "follower_demographics",
      period: "lifetime",
      metric_type: "total_value",
      breakdown,
      timeframe,
      access_token: token,
    });

    return graphOptional(
      `${IG_GRAPH_BASE}/${account.externalUserId}/insights?${params.toString()}`,
    );
  }

  const [
    agePayload,
    genderPayload,
    cityPayload,
  ] = await Promise.all([
    demographic("age"),
    demographic("gender"),
    demographic("city"),
  ]);

  const age =
    breakdownRows(agePayload);

  const gender =
    breakdownRows(genderPayload);

  const city =
    breakdownRows(cityPayload);

  const followerParams =
    new URLSearchParams({
      metric: "reach",
      period: "total_over_range",
      metric_type: "total_value",
      breakdown: "follow_type",
      since: String(sinceUnix),
      until: String(untilUnix),
      access_token: token,
    });

  const followerPayload =
    await graphOptional(
      `${IG_GRAPH_BASE}/${account.externalUserId}/insights?${followerParams.toString()}`,
    );

  const followerRows =
    breakdownRows(
      followerPayload,
    );

  const followerReach =
    followerRows.find((row) => {
      const label = row.label
        .toUpperCase()
        .replace(/\s+/g, "_");

      return (
        label.includes("FOLLOWER") &&
        !label.includes(
          "NON_FOLLOWER",
        ) &&
        !label.includes(
          "NONFOLLOWER",
        )
      );
    })?.value ?? null;

  const nonFollowerReach =
    followerRows.find((row) => {
      const label = row.label
        .toUpperCase()
        .replace(/\s+/g, "_");

      return (
        label.includes(
          "NON_FOLLOWER",
        ) ||
        label.includes(
          "NONFOLLOWER",
        )
      );
    })?.value ?? null;

  const followerSplitTotal =
    (followerReach ?? 0) +
    (nonFollowerReach ?? 0);

  const media =
    await db.instagramMediaInsight.findMany({
      where: {
        socialAccountId: account.id,
        publishedAt: {
          gte: from,
          lte: to,
        },
      },

      select: {
        externalMediaId: true,
        caption: true,
        thumbnailUrl: true,
        mediaProductType: true,
        mediaType: true,
        publishedAt: true,
      },

      orderBy: {
        publishedAt: "desc",
      },
    });

  const reels = media
    .filter(
      (item) =>
        String(
          item.mediaProductType ?? "",
        ).toUpperCase() === "REELS",
    )
    .slice(0, 30);

  const skipItems: Array<{
    externalMediaId: string;
    caption: string | null;
    thumbnailUrl: string | null;
    publishedAt: Date | null;
    ratePct: number;
  }> = [];

  for (const reel of reels) {
    const params =
      new URLSearchParams({
        metric: "reels_skip_rate",
        access_token: token,
      });

    const payload =
      await graphOptional(
        `${IG_GRAPH_BASE}/${reel.externalMediaId}/insights?${params.toString()}`,
      );

    const raw =
      metricValue(payload);

    const ratePct =
      normalizePercent(raw);

    if (ratePct !== null) {
      skipItems.push({
        externalMediaId:
          reel.externalMediaId,

        caption:
          reel.caption,

        thumbnailUrl:
          reel.thumbnailUrl,

        publishedAt:
          reel.publishedAt,

        ratePct,
      });
    }
  }

  const averageSkipRate =
    skipItems.length > 0
      ? Number(
          (
            skipItems.reduce(
              (total, item) =>
                total +
                item.ratePct,
              0,
            ) /
            skipItems.length
          ).toFixed(2),
        )
      : null;

  return ok({
    available: true,

    account: {
      id: account.id,
      handle: account.handle,
      displayName:
        account.displayName,
    },

    source:
      "instagram_meta_insights",

    selectedPeriod: {
      from: from.toISOString(),
      to: to.toISOString(),
      days,
    },

    demographics: {
      available:
        age.length > 0 ||
        gender.length > 0 ||
        city.length > 0,

      timeframe,

      note:
        days > 90
          ? "Meta follower demographics are shown from the latest supported 90-day demographic window."
          : "Follower demographics use Meta's supported audience demographic window closest to the selected report period.",

      age,
      gender,
      city,
    },

    followerNonFollower: {
      available:
        followerReach !== null ||
        nonFollowerReach !== null,

      followerReach,
      nonFollowerReach,

      followerPct:
        followerSplitTotal > 0 &&
        followerReach !== null
          ? Number(
              (
                (followerReach /
                  followerSplitTotal) *
                100
              ).toFixed(2),
            )
          : null,

      nonFollowerPct:
        followerSplitTotal > 0 &&
        nonFollowerReach !== null
          ? Number(
              (
                (nonFollowerReach /
                  followerSplitTotal) *
                100
              ).toFixed(2),
            )
          : null,
    },

    skipRate: {
      available:
        averageSkipRate !== null,

      averagePct:
        averageSkipRate,

      items:
        skipItems,
    },

    adReach: {
      available: false,

      value: null,

      reason:
        "Ad Reach requires a Meta Marketing API connection with the required ads permission. Loomic will not substitute organic Instagram reach for Ad Reach.",
    },
  });
});
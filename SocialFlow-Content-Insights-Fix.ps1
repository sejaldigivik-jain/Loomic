# ============================================================
# SocialFlow Content Analytics Fix V3
#
# Changes ONLY:
# src\lib\analytics-service.ts
# src\components\app\views\analytics.tsx
#
# Does NOT change:
# Account Analytics
# Follower Growth
# summary route
# Prisma
# database schema
# publishing
# auth
# queue/calendar
# ============================================================

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

$ServiceFile =
    Join-Path $Root "src\lib\analytics-service.ts"

$AnalyticsFile =
    Join-Path $Root "src\components\app\views\analytics.tsx"

Write-Host ""
Write-Host "SocialFlow Content Analytics Patch V3" -ForegroundColor Cyan
Write-Host "Project: $Root"
Write-Host ""

if (-not (Test-Path $ServiceFile)) {
    throw "Missing: $ServiceFile"
}

if (-not (Test-Path $AnalyticsFile)) {
    throw "Missing: $AnalyticsFile"
}

$service =
    [System.IO.File]::ReadAllText($ServiceFile)

$analytics =
    [System.IO.File]::ReadAllText($AnalyticsFile)


# ============================================================
# 1. REPLACE fetchMediaInsights COMPLETELY
# ============================================================

Write-Host "[1/2] Updating Instagram media insight sync..."

$functionStart =
    $service.IndexOf(
        "async function fetchMediaInsights("
    )

$nextFunction =
    $service.IndexOf(
        "async function mapWithConcurrency",
        $functionStart
    )

if (
    $functionStart -lt 0 -or
    $nextFunction -lt 0
) {
    throw @"
Could not locate fetchMediaInsights function boundaries.

NO FILES CHANGED.
"@
}

$newFetchMediaInsights = @'
async function fetchMediaInsights(
  mediaId: string,
  token: string,
  isReel: boolean,
) {
  /*
   * Content Analytics
   *
   * Instagram Views = Meta views
   * Facebook Views  = Meta facebook_views
   *                   OR crossposted total - Instagram Views
   * Total Views     = crossposted total
   *                   OR Instagram + Facebook
   */

  const corePayload =
    await fetchMediaMetricGroup(
      mediaId,
      token,
      [
        "reach",
        "views",
        "saved",
        "shares",
        "total_interactions",

        "profile_activity",
        "profile_visits",
        "follows",
      ],
    );

  /*
   * Keep cross-platform views separate from the
   * normal Instagram insight request.
   */
  const facebookPayload =
    await fetchMediaMetricGroup(
      mediaId,
      token,
      [
        "facebook_views",
        "crossposted_views",
      ],
    );

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


  /*
   * INSTAGRAM VIEWS
   */
  const metaViews =
    metricNullable(
      corePayload,
      "views",
    );


  /*
   * FACEBOOK VIEWS returned directly by Meta.
   */
  const directFacebookViews =
    metricNullable(
      facebookPayload,
      "facebook_views",
    );


  /*
   * CROSS-PLATFORM TOTAL
   */
  const metaCrosspostedViews =
    metricNullable(
      facebookPayload,
      "crossposted_views",
    );


  /*
   * If Meta's facebook_views is missing or zero,
   * but crossposted total exists, derive Facebook:
   *
   * Total - Instagram
   *
   * Example:
   *
   * 583 - 419 = 164
   */
  const derivedFacebookViews =
    metaCrosspostedViews !== null &&
    metaViews !== null &&
    metaCrosspostedViews >= metaViews
      ? metaCrosspostedViews -
        metaViews
      : null;


  const metaFacebookViews =
    directFacebookViews !== null &&
    directFacebookViews > 0
      ? directFacebookViews
      : derivedFacebookViews ??
        directFacebookViews;


  /*
   * TOTAL VIEWS
   *
   * Prefer Meta's crossposted total.
   *
   * Otherwise:
   *
   * Instagram + Facebook
   */
  const metaDisplayViews =
    metaCrosspostedViews ??
    (
      metaViews !== null &&
      metaFacebookViews !== null
        ? metaViews +
          metaFacebookViews
        : metaViews
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
   * PROFILE
   */
  const metaProfileActivity =
    metricNullable(
      corePayload,
      "profile_activity",
    );

  const metaProfileVisits =
    metricNullable(
      corePayload,
      "profile_visits",
    );

  const metaFollows =
    metricNullable(
      corePayload,
      "follows",
    );


  /*
   * REEL PERFORMANCE
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

    metaTotalViews:
      null,

    metaDisplayViews,

    metaFacebookViews,

    metaCrosspostedViews,

    /*
     * Likes/comments continue using the existing
     * real media-object fallback.
     */
    metaLikes:
      null,

    metaTotalLikes:
      null,

    metaComments:
      null,

    metaTotalComments:
      null,

    metaShares,

    metaSaves,

    metaTotalInteractions,

    metaAccountsEngaged:
      null,

    metaProfileActivity,

    metaProfileVisits,

    metaFollows,

    metaFollowerViews:
      null,

    metaNonFollowerViews:
      null,

    metaFollowerInteractions:
      null,

    metaNonFollowerInteractions:
      null,

    metaReelsSkipRate,

    avgWatchTimeMs,

    totalWatchTimeMs,
  };
}


'@

$service =
    $service.Substring(
        0,
        $functionStart
    ) +
    $newFetchMediaInsights +
    $service.Substring(
        $nextFunction
    )


# ============================================================
# 2. COMPACT EXPANDED UI
# ============================================================

Write-Host "[2/2] Compacting Instagram insight details..."

$marker =
    "View Instagram Insight Details"

$markerIndex =
    $analytics.IndexOf($marker)

if ($markerIndex -lt 0) {
    throw @"
Could not find:
View Instagram Insight Details

NO FILES CHANGED.
"@
}

$detailsStart =
    $analytics.LastIndexOf(
        "<details",
        $markerIndex
    )

$detailsEnd =
    $analytics.IndexOf(
        "</details>",
        $markerIndex
    )

if (
    $detailsStart -lt 0 -or
    $detailsEnd -lt 0
) {
    throw @"
Could not locate the complete details section.

NO FILES CHANGED.
"@
}

$detailsEnd =
    $detailsEnd +
    "</details>".Length


$compactDetails = @'
<details className="mt-4 overflow-hidden rounded-lg border border-border">
  <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground">
    View Instagram Insight Details
  </summary>

  <div className="border-t border-border px-4 py-3">

    <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">

      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Profile Activity
        </p>

        <p className="mt-1 text-sm font-semibold">
          {item.profileActivity ?? "N/A"}
        </p>
      </div>


      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Profile Visits
        </p>

        <p className="mt-1 text-sm font-semibold">
          {item.profileVisits ?? "N/A"}
        </p>
      </div>


      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Follows
        </p>

        <p className="mt-1 text-sm font-semibold">
          {item.follows ?? "N/A"}
        </p>
      </div>


      {item.format === "Reel" && (
        <>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Skip Rate
            </p>

            <p className="mt-1 text-sm font-semibold">
              {item.reelsSkipRate == null
                ? "N/A"
                : `${Number(
                    Math.abs(
                      item.reelsSkipRate
                    ) <= 1
                      ? item.reelsSkipRate *
                        100
                      : item.reelsSkipRate
                  ).toFixed(1)}%`}
            </p>
          </div>


          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Avg Watch Time
            </p>

            <p className="mt-1 text-sm font-semibold">
              {item.avgWatchTimeMs == null
                ? "N/A"
                : `${(
                    item.avgWatchTimeMs /
                    1000
                  ).toFixed(1)}s`}
            </p>
          </div>

        </>
      )}

    </div>

  </div>
</details>
'@


$analytics =
    $analytics.Substring(
        0,
        $detailsStart
    ) +
    $compactDetails +
    $analytics.Substring(
        $detailsEnd
    )


# ============================================================
# VALIDATE BEFORE SAVING
# ============================================================

if (
    $service -notmatch
    'directFacebookViews'
) {
    throw "Facebook Views validation failed."
}

if (
    $service -notmatch
    'derivedFacebookViews'
) {
    throw "Facebook derivation validation failed."
}

if (
    $service -notmatch
    'metaDisplayViews'
) {
    throw "Total Views validation failed."
}

if (
    $analytics -notmatch
    'Avg Watch Time'
) {
    throw "Compact UI validation failed."
}


# ============================================================
# BACKUPS
# ============================================================

$Stamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

Copy-Item `
    $ServiceFile `
    "$ServiceFile.backup-$Stamp"

Copy-Item `
    $AnalyticsFile `
    "$AnalyticsFile.backup-$Stamp"


# ============================================================
# WRITE
# ============================================================

$Utf8NoBom =
    New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
    $ServiceFile,
    $service,
    $Utf8NoBom
)

[System.IO.File]::WriteAllText(
    $AnalyticsFile,
    $analytics,
    $Utf8NoBom
)


Write-Host ""
Write-Host "PATCH V3 APPLIED SUCCESSFULLY" -ForegroundColor Green
Write-Host ""
Write-Host "Changed:"
Write-Host "  src\lib\analytics-service.ts"
Write-Host "  src\components\app\views\analytics.tsx"
Write-Host ""
Write-Host "Not changed:"
Write-Host "  Account Analytics"
Write-Host "  Follower Growth"
Write-Host "  summary route"
Write-Host "  Prisma"
Write-Host "  database schema"
Write-Host ""
Write-Host "Backup suffix:"
Write-Host "  .backup-$Stamp"
Write-Host ""
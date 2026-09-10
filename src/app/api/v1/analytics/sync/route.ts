import {
  withHandler,
  ok,
  ApiError,
} from "@/lib/api-utils";

import {
  requireWorkspace,
} from "@/lib/server-auth";

import {
  resolveAccountScope,
} from "@/lib/account-access";

import {
  db,
} from "@/lib/db";

import {
  syncInstagramAccountAnalytics,
} from "@/lib/analytics-service";


export const runtime = "nodejs";

export const dynamic = "force-dynamic";


export const POST = withHandler(
  null,

  async ({ req }) => {
    const url =
      new URL(req.url);

    const workspaceId =
      url.searchParams.get(
        "workspaceId",
      );

    if (!workspaceId) {
      throw ApiError.badRequest(
        "workspaceId is required",
      );
    }


    /*
     * Authenticate current workspace.
     */
    const auth =
      await requireWorkspace(
        req,
        workspaceId,
      );


    /*
     * Resolve the selected Team Member /
     * Instagram Account scope.
     */
    const accountScope =
      await resolveAccountScope({
        workspaceId,

        userId:
          auth.userId,

        role:
          auth.role,

        requestedMemberId:
          url.searchParams.get(
            "memberId",
          ),

        requestedAccountId:
          url.searchParams.get(
            "accountId",
          ) ??
          url.searchParams.get(
            "clientId",
          ),
      });


    const requestedPlatform =
      url.searchParams.get(
        "platform",
      );

    const rangeKey =
      url.searchParams.get(
        "range",
      ) ?? "30d";


    /*
     * Custom Content Analytics range.
     */
    const customFromRaw =
      rangeKey === "custom"
        ? url.searchParams.get(
          "from",
        )
        : null;

    const customToRaw =
      rangeKey === "custom"
        ? url.searchParams.get(
          "to",
        )
        : null;


    const customFrom =
      customFromRaw &&
        /^\d{4}-\d{2}-\d{2}$/.test(
          customFromRaw,
        )
        ? new Date(
          `${customFromRaw}T00:00:00.000Z`,
        )
        : null;


    const customTo =
      customToRaw &&
        /^\d{4}-\d{2}-\d{2}$/.test(
          customToRaw,
        )
        ? new Date(
          `${customToRaw}T23:59:59.999Z`,
        )
        : null;

    /*
     * Limit media syncing to the currently
     * selected Analytics date range.
     *
     * This prevents a normal 7 / 30 / 90 day
     * sync from processing unnecessary media.
     */
    const normalRangeDays =
      rangeKey === "7d"
        ? 7
        : rangeKey === "90d"
          ? 90
          : 30;

    const mediaFrom =
      customFrom ??
      new Date(
        Date.now() -
        normalRangeDays *
        24 *
        60 *
        60 *
        1000,
      );

    const mediaTo =
      customTo ??
      new Date();

    /*
     * Instagram Analytics only.
     */
    if (
      requestedPlatform &&
      requestedPlatform !==
      "instagram"
    ) {
      return ok({
        processed: 0,
        synced: 0,
        failed: 0,
        skipped: 0,

        message:
          "Instagram analytics sync only applies to Instagram accounts.",

        needsReconnect: [],

        results: [],
      });
    }


    /*
     * Find the selected connected
     * Instagram account(s).
     */
    const accounts =
      await db.socialAccount.findMany({
        where: {
          workspaceId,

          platform:
            "instagram",

          status:
            "connected",

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
        },

        take: 25,
      });


    /*
     * This is the ONLY situation where
     * "No eligible Instagram account"
     * should be shown.
     */
    if (
      accounts.length === 0
    ) {
      return ok({
        processed: 0,
        synced: 0,
        failed: 0,
        skipped: 0,

        message:
          "No connected Instagram account matched the selected Analytics scope.",

        needsReconnect: [],

        results: [],
      });
    }


    const results: Awaited<
      ReturnType<
        typeof syncInstagramAccountAnalytics
      >
    >[] = [];


    /*
     * Sync each account.
     */
    for (
      const account of
      accounts
    ) {
      /*
       * Meta account-level history is
       * limited, but custom historical
       * Content Analytics can still walk
       * older owned media.
       */
      const result =
        await syncInstagramAccountAnalytics(
          account.id,

          90,

          rangeKey === "custom"
            ? 500
            : 200,

          mediaFrom,

          mediaTo,
        );

      results.push(
        result,
      );
    }


    /*
     * Build accurate sync status.
     */
    const synced =
      results.filter(
        (result) =>
          result.status ===
          "synced",
      ).length;


    const failed =
      results.filter(
        (result) =>
          result.status ===
          "failed",
      ).length;


    const skipped =
      results.filter(
        (result) =>
          result.status ===
          "skipped",
      ).length;


    const needsReconnect =
      results.filter(
        (result) =>
          result.needsReconnect,
      );


    /*
     * Return the REAL failure reason
     * instead of pretending no account
     * was selected.
     */
    let message:
      | string
      | null = null;


    if (
      failed > 0
    ) {
      const firstFailure =
        results.find(
          (result) =>
            result.status ===
            "failed",
        );

      message =
        firstFailure?.error ??
        "Instagram analytics sync failed.";
    } else if (
      synced === 0 &&
      skipped > 0
    ) {
      const firstSkipped =
        results.find(
          (result) =>
            result.status ===
            "skipped",
        );

      message =
        firstSkipped?.error ??
        "The selected Instagram account was skipped.";
    }


    return ok({
      processed:
        results.length,

      synced,

      failed,

      skipped,

      message,

      needsReconnect:
        needsReconnect.map(
          (result) => ({
            accountId:
              result.accountId,

            handle:
              result.handle,

            error:
              result.error,
          }),
        ),

      results,
    });
  },
);
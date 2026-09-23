/**
 * GET /api/v1/accounts?workspaceId=...
 *   List all connected social accounts for a workspace.
 *
 * POST /api/v1/accounts
 *   Persist a connected social account (demo or real OAuth).
 *   In production with real OAuth, the callback handler would call this
 *   internally. For demo accounts the frontend calls this directly.
 */
import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireWorkspace } from "@/lib/server-auth";
import { resolveAccountScope } from "@/lib/account-access";
import { consumeAccountConnectionGrant } from "@/lib/account-connection-lock";
import { instagramConnectionMethod, parseInstagramProviderData, supportsInstagramNativeLocation, supportsInstagramNativeTags } from "@/lib/instagram-connection";

export const runtime = "nodejs";

export const GET = withHandler(null, async ({ req }) => {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) throw ApiError.badRequest("workspaceId is required");
  const auth = await requireWorkspace(req, workspaceId);
  const platform = url.searchParams.get("platform");
  const scope = await resolveAccountScope({
    workspaceId,
    userId: auth.userId,
    role: auth.role,
    requestedMemberId: url.searchParams.get("memberId"),
    requestedAccountId: url.searchParams.get("accountId") ?? url.searchParams.get("clientId"),
  });

  const accounts = await db.socialAccount.findMany({
    where: { workspaceId, ...(scope ? { id: { in: scope } } : {}), ...(platform ? { platform } : {}) },

    orderBy: { connectedAt: "desc" },
  });

  return ok(
    accounts.map((a) => {
      const instagramData = a.platform === "instagram" ? parseInstagramProviderData(a.providerData) : {};
      const method = a.platform === "instagram" ? instagramConnectionMethod(a.providerData) : undefined;
      return {
        id: a.id,
        platform: a.platform,
        handle: a.handle,
        displayName: a.displayName,
        avatarUrl: a.avatarUrl,
        avatarGradient: a.avatarGradient ?? undefined,
        followers: a.followers,
        status: a.status,
        tokenExpiresAt: a.tokenExpiresAt ?? undefined,
        isReal: a.accessToken !== "" && a.accessToken !== "demo-token" ? true : false,
        externalUserId: a.externalUserId ?? undefined,
        connectedAt: a.connectedAt,
        ...(a.platform === "instagram" ? {
          instagramConnectionMethod: method,
          instagramPageId: instagramData.pageId,
          instagramPageName: instagramData.pageName,
          supportsNativeInstagramTags: supportsInstagramNativeTags(a.providerData),
          supportsNativeInstagramLocation: supportsInstagramNativeLocation(a.providerData),
        } : {}),
        // Agency workflow: the connected account itself is the client.
        clientId: a.id,
        clientName: a.displayName || a.handle,
      };
    })
  );
});

const connectSchema = z.object({
  workspaceId: z.string(),
  platform: z.enum(["linkedin", "twitter", "instagram", "facebook", "threads", "pinterest"]),
  handle: z.string().min(1).max(100),
  displayName: z.string().min(1).max(120).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  avatarGradient: z.string().max(120).optional(),
  followers: z.number().int().min(0).optional(),
  status: z.enum(["connected", "expired", "error"]).optional(),
  tokenExpiresAt: z.string().nullable().optional(),
});

export const POST = withHandler(connectSchema, async ({ req, body }) => {
  const {
    workspaceId,
    platform,
    handle,
    displayName,
    avatarUrl,
    avatarGradient,
    followers = 0,
    status = "connected",
    tokenExpiresAt,
  } = body!;

  const auth = await requireWorkspace(req, workspaceId, "account.connect");
  await consumeAccountConnectionGrant(req, workspaceId, auth.userId);

  const demosAllowed = process.env.ALLOW_DEMO_SOCIAL_CONNECTIONS === "true";
  if (!demosAllowed) {
    throw ApiError.forbidden("Direct account creation is disabled in production. Connect accounts through a provider OAuth flow.");
  }

  // Verify workspace exists
  const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws) throw ApiError.notFound("Workspace not found");

  // Check for duplicate (workspaceId + platform + handle)
  const existing = await db.socialAccount.findUnique({
    where: {
      workspaceId_platform_handle: { workspaceId, platform, handle },
    },
  });
  if (existing) {
    throw ApiError.conflict("This account is already connected");
  }

  const account = await db.socialAccount.create({
    data: {
      workspaceId,
      platform,
      handle,
      displayName: displayName ?? handle,
      avatarUrl: avatarUrl ?? null,
      avatarGradient: avatarGradient ?? "from-rose-500 to-orange-500",
      followers,
      accessToken: "demo-token",
      refreshToken: null,
      externalUserId: null,
      tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : null,
      status,
    },
  });

  return ok(
    {
      id: account.id,
      platform: account.platform,
      handle: account.handle,
      displayName: account.displayName,
      avatarUrl: account.avatarUrl,
      avatarGradient: account.avatarGradient,
      followers: account.followers,
      status: account.status,
      tokenExpiresAt: account.tokenExpiresAt ?? undefined,
      isReal: false,
      connectedAt: account.connectedAt,
    },
    {},
    201
  );
});

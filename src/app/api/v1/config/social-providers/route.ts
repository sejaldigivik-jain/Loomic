import { ok, withHandler, ApiError } from "@/lib/api-utils";
import { PLATFORM_LIST } from "@/lib/platforms";
import { providerCredentials, defaultRedirectUri } from "@/lib/social-provider-oauth";
import { requireUser, requireWorkspace } from "@/lib/server-auth";

export const runtime = "nodejs";

export const GET = withHandler(null, async ({ req }) => {
  const auth = requireUser(req);
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId") || auth.workspaceId;
  if (!workspaceId) throw ApiError.badRequest("No active workspace");
  await requireWorkspace(req, workspaceId);

  const providers = Object.fromEntries(
    await Promise.all(
      PLATFORM_LIST.map(async (p) => {
        const credentials = await providerCredentials(p.id, url.origin, workspaceId);
        return [p.id, {
          configured: Boolean(credentials),
          redirectUri: credentials?.redirectUri ?? defaultRedirectUri(p.id, url.origin),
          source: credentials?.source ?? null,
        }];
      })
    )
  );

  return ok({
    providers,
    // Demo connections are opt-in only. This avoids a fake account looking like
    // a real connected client channel during local development.
    demoConnectionsEnabled: process.env.ALLOW_DEMO_SOCIAL_CONNECTIONS === "true",
  });
});

import { ok, withHandler, ApiError } from "@/lib/api-utils";
import { providerCredentials, defaultRedirectUri } from "@/lib/social-provider-oauth";
import { requireUser, requireWorkspace } from "@/lib/server-auth";

export const runtime = "nodejs";

export const GET = withHandler(null, async ({ req }) => {
  const auth = requireUser(req);
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId") || auth.workspaceId;
  if (!workspaceId) throw ApiError.badRequest("No active workspace");
  await requireWorkspace(req, workspaceId);
  const credentials = await providerCredentials("instagram", url.origin, workspaceId);
  return ok({
    configured: Boolean(credentials),
    redirectUri: credentials?.redirectUri ?? defaultRedirectUri("instagram", url.origin),
    demoConnectionsEnabled: process.env.ALLOW_DEMO_SOCIAL_CONNECTIONS === "true",
  });
});

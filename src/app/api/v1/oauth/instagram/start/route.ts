import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireUser, requireWorkspace } from "@/lib/server-auth";
import { signOAuthState } from "@/lib/auth";
import { providerCredentials } from "@/lib/social-provider-oauth";
import { consumeAccountConnectionGrant } from "@/lib/account-connection-lock";

export const runtime = "nodejs";

export const GET = withHandler(null, async ({ req }) => {
  const auth = requireUser(req);
  const workspaceId = new URL(req.url).searchParams.get("workspaceId") || auth.workspaceId;
  if (!workspaceId) throw ApiError.badRequest("No active workspace");
  const workspaceAuth = await requireWorkspace(req, workspaceId, "account.connect");
  await consumeAccountConnectionGrant(req, workspaceId, workspaceAuth.userId);

  const origin = new URL(req.url).origin;
  const credentials = await providerCredentials("instagram", origin, workspaceId);
  if (!credentials) throw ApiError.badRequest("Instagram OAuth is not configured. Open Settings → Integrations and add your Meta/Instagram app credentials.");

  const state = signOAuthState({ userId: auth.userId, workspaceId, provider: "instagram" });
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: credentials.redirectUri,
    response_type: "code",
    scope: "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights",
    enable_fb_login: "0",
    force_authentication: "1",
    state,
  });
  return ok({ authorizeUrl: `https://www.instagram.com/oauth/authorize?${params.toString()}` });
});

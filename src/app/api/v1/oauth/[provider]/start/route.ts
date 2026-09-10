import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireUser, requireWorkspace } from "@/lib/server-auth";
import { signOAuthState } from "@/lib/auth";
import { buildAuthorizeUrl, makePkce, providerCredentials, type OAuthProvider } from "@/lib/social-provider-oauth";
import { PLATFORM_LIST } from "@/lib/platforms";
import { consumeAccountConnectionGrant } from "@/lib/account-connection-lock";

export const runtime = "nodejs";

export const GET = withHandler(null, async ({ req, ctx }) => {
  const raw = String(ctx.params.provider);
  if (raw === "instagram") throw ApiError.badRequest("Use the Instagram OAuth start route");
  if (!PLATFORM_LIST.some((p) => p.id === raw)) throw ApiError.notFound("Unsupported provider");

  const provider = raw as Exclude<OAuthProvider, "instagram">;
  const auth = requireUser(req);
  const workspaceId = new URL(req.url).searchParams.get("workspaceId") || auth.workspaceId;
  if (!workspaceId) throw ApiError.badRequest("No active workspace");
  const workspaceAuth = await requireWorkspace(req, workspaceId, "account.connect");
  await consumeAccountConnectionGrant(req, workspaceId, workspaceAuth.userId);

  const credentials = await providerCredentials(provider, new URL(req.url).origin, workspaceId);
  if (!credentials) throw ApiError.badRequest(`${provider} OAuth is not configured`);

  const state = signOAuthState({ userId: auth.userId, workspaceId, provider });
  const pkce = provider === "twitter" ? makePkce() : null;
  const authorizeUrl = buildAuthorizeUrl(provider, credentials, state, pkce?.challenge);
  const response = ok({ authorizeUrl });
  if (pkce) {
    response.cookies.set("sf_x_pkce", pkce.verifier, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 10 * 60,
      path: "/api/oauth/twitter/callback",
    });
  }
  return response;
});

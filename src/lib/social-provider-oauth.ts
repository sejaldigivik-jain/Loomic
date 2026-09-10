import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/secrets";
import type { PlatformId } from "@/lib/platforms";

export type OAuthProvider = PlatformId;

export type ProviderCredentials = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  source: "workspace" | "environment";
};

const metaVersion = () => process.env.META_GRAPH_API_VERSION ?? "v26.0";

function envKey(provider: OAuthProvider) {
  return provider === "twitter" ? "X" : provider.toUpperCase();
}

export function defaultRedirectUri(provider: OAuthProvider, origin: string) {
  return provider === "instagram"
    ? `${origin}/api/oauth/instagram/callback`
    : `${origin}/api/oauth/${provider}/callback`;
}

function isLocalRedirect(uri?: string | null) {
  if (!uri) return false;
  try {
    const url = new URL(uri);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function isQuickTunnel(uri?: string | null) {
  if (!uri) return false;
  try {
    return new URL(uri).hostname.endsWith(".trycloudflare.com");
  } catch {
    return false;
  }
}

function normalizedBase(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * Return the externally reachable origin for OAuth callbacks.
 *
 * Cloudflare Quick Tunnel terminates HTTPS in front of the local Next server.
 * Depending on the proxy/dev-server combination, req.url can still look like
 * localhost even though the browser is on *.trycloudflare.com. The one-click
 * launcher sets NEXT_PUBLIC_APP_URL to the actual tunnel URL, so that value is
 * the source of truth while public-tunnel mode is active.
 */
export function publicAppOrigin(fallbackOrigin: string) {
  const configured = normalizedBase(process.env.NEXT_PUBLIC_APP_URL);
  if (configured && process.env.SOCIALFLOW_PUBLIC_TUNNEL === "1") return configured;
  return configured && process.env.NODE_ENV === "production" ? configured : normalizedBase(fallbackOrigin) || fallbackOrigin;
}

function effectiveRedirectUri(provider: OAuthProvider, configured: string | null | undefined, origin: string) {
  const publicOrigin = publicAppOrigin(origin);

  // In the one-click tunnel workflow the current tunnel URL MUST win over any
  // localhost or old trycloudflare URL saved in the database. This prevents
  // Meta receiving a stale redirect_uri after the tunnel is restarted.
  if (process.env.SOCIALFLOW_PUBLIC_TUNNEL === "1") {
    return defaultRedirectUri(provider, publicOrigin);
  }

  // Outside explicit tunnel mode, repair old localhost redirects whenever the
  // app is clearly being accessed through a public HTTPS origin.
  if (process.env.NODE_ENV !== "production") {
    try {
      const current = new URL(publicOrigin);
      if (current.protocol === "https:" && !["localhost", "127.0.0.1"].includes(current.hostname)) {
        if (isLocalRedirect(configured) || isQuickTunnel(configured)) return defaultRedirectUri(provider, publicOrigin);
      }
    } catch {
      // Fall through to the configured/default value.
    }
  }

  return configured || defaultRedirectUri(provider, publicOrigin);
}

/**
 * Resolve OAuth developer-app credentials for a workspace.
 *
 * Resolution order:
 *   1. Workspace credentials stored from Settings > Integrations.
 *   2. Environment variables (useful for Docker/managed deployments).
 *
 * Client secrets are decrypted only on the server and are never returned by
 * the public configuration endpoints.
 */
export async function providerCredentials(
  provider: OAuthProvider,
  origin: string,
  workspaceId?: string | null
): Promise<ProviderCredentials | null> {
  if (workspaceId) {
    const row = await db.providerCredential.findUnique({
      where: { workspaceId_provider: { workspaceId, provider } },
    }).catch(() => null);

    if (row?.enabled && row.clientId) {
      const secret = row.clientSecret ? decryptSecret(row.clientSecret) : "";
      if (provider === "twitter" || secret) {
        return {
          clientId: row.clientId,
          clientSecret: secret,
          redirectUri: effectiveRedirectUri(provider, row.redirectUri, origin),
          source: "workspace",
        };
      }
    }
  }

  const key = envKey(provider);
  const clientId = process.env[`${key}_CLIENT_ID`];
  const clientSecret = process.env[`${key}_CLIENT_SECRET`] ?? "";
  const redirectUri = effectiveRedirectUri(provider, process.env[`${key}_REDIRECT_URI`], origin);
  // X supports public clients, so a client secret is optional there.
  if (!clientId || (provider !== "twitter" && !clientSecret)) return null;
  return { clientId, clientSecret, redirectUri, source: "environment" };
}

export async function providerConfigured(provider: OAuthProvider, origin: string, workspaceId?: string | null): Promise<boolean> {
  return Boolean(await providerCredentials(provider, origin, workspaceId));
}

export function makePkce() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthorizeUrl(provider: Exclude<OAuthProvider, "instagram">, credentials: ProviderCredentials, state: string, pkceChallenge?: string) {
  switch (provider) {
    case "facebook": {
      const q = new URLSearchParams({
        client_id: credentials.clientId,
        redirect_uri: credentials.redirectUri,
        response_type: "code",
        scope: "pages_show_list,pages_manage_posts,pages_read_engagement",
        state,
      });
      return `https://www.facebook.com/${metaVersion()}/dialog/oauth?${q}`;
    }
    case "threads": {
      const q = new URLSearchParams({
        client_id: credentials.clientId,
        redirect_uri: credentials.redirectUri,
        response_type: "code",
        scope: "threads_basic,threads_content_publish,threads_manage_insights",
        state,
      });
      return `https://www.threads.com/oauth/authorize?${q}`;
    }
    case "linkedin": {
      const q = new URLSearchParams({
        response_type: "code",
        client_id: credentials.clientId,
        redirect_uri: credentials.redirectUri,
        state,
        scope: "openid profile w_member_social",
      });
      return `https://www.linkedin.com/oauth/v2/authorization?${q}`;
    }
    case "twitter": {
      if (!pkceChallenge) throw new Error("X OAuth requires PKCE");
      const q = new URLSearchParams({
        response_type: "code",
        client_id: credentials.clientId,
        redirect_uri: credentials.redirectUri,
        scope: "tweet.read tweet.write users.read offline.access",
        state,
        code_challenge: pkceChallenge,
        code_challenge_method: "S256",
      });
      return `https://x.com/i/oauth2/authorize?${q}`;
    }
    case "pinterest": {
      const q = new URLSearchParams({
        client_id: credentials.clientId,
        redirect_uri: credentials.redirectUri,
        response_type: "code",
        scope: "user_accounts:read,boards:read,pins:read,pins:write",
        state,
      });
      return `https://www.pinterest.com/oauth/?${q}`;
    }
  }
}

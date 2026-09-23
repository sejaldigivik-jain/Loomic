/**
 * GET /api/oauth/instagram/callback
 * OAuth callback for Instagram API with Instagram Login.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyOAuthState } from "@/lib/auth";
import { encryptSecret } from "@/lib/secrets";
import { providerCredentials, publicAppOrigin, type ProviderCredentials } from "@/lib/social-provider-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IG_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const IG_LONG_LIVED_URL = "https://graph.instagram.com/access_token";
const IG_GRAPH_VERSION = process.env.META_GRAPH_API_VERSION ?? "v26.0";
const IG_ME_URL = `https://graph.instagram.com/${IG_GRAPH_VERSION}/me`;

async function exchangeCodeForToken(code: string, credentials: ProviderCredentials) {
  const body = new FormData();
  body.set("client_id", credentials.clientId);
  body.set("client_secret", credentials.clientSecret);
  body.set("grant_type", "authorization_code");
  body.set("redirect_uri", credentials.redirectUri);
  body.set("code", code);
  const res = await fetch(IG_TOKEN_URL, {
    method: "POST",
    body,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; user_id: number }>;
}

async function getLongLivedToken(shortToken: string, credentials: ProviderCredentials) {
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: credentials.clientSecret,
    access_token: shortToken,
  });
  const res = await fetch(`${IG_LONG_LIVED_URL}?${params}`);
  if (!res.ok) throw new Error(`Long-lived token exchange failed: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; expires_in: number; token_type: string }>;
}

async function fetchProfile(token: string, userId: number) {
  // Keep the first profile request deliberately small. id + username are the
  // stable fields needed to create the SocialFlow account record. Optional
  // counters/profile fields can vary by access level, so they must never make
  // a successful OAuth connection fail.
  const basic = new URLSearchParams({ fields: "id,username", access_token: token });
  const basicRes = await fetch(`${IG_ME_URL}?${basic}`);
  if (!basicRes.ok) throw new Error(`Profile fetch failed: ${await basicRes.text()}`);
  const core = await basicRes.json() as { id?: string; username?: string };
  if (!core.username) throw new Error("Instagram profile response did not include a username");

  let followers = 0;
  let avatar: string | undefined;
  try {
    const extra = new URLSearchParams({
      fields: "id,username,followers_count,profile_picture_url",
      access_token: token,
    });
    const extraRes = await fetch(`${IG_ME_URL}?${extra}`);
    if (extraRes.ok) {
      const value = await extraRes.json() as { followers_count?: number; profile_picture_url?: string };
      followers = Number(value.followers_count || 0);
      avatar = value.profile_picture_url;
    }
  } catch {
    // Optional profile enrichment must not block account connection.
  }

  return {
    user_id: core.id || String(userId),
    username: core.username,
    followers_count: followers,
    profile_picture_url: avatar,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const appOrigin = publicAppOrigin(url.origin);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorReason = url.searchParams.get("error_reason") || url.searchParams.get("error_description");

  if (error) {
    console.error("[oauth/instagram] user denied:", errorReason);
    return NextResponse.redirect(new URL("/?oauth_error=denied", appOrigin));
  }
  if (!code || !state) return NextResponse.redirect(new URL("/?oauth_error=missing_params", appOrigin));

  const oauthState = verifyOAuthState(state);
  if (!oauthState || oauthState.provider !== "instagram") {
    return NextResponse.redirect(new URL("/?oauth_error=invalid_state", appOrigin));
  }

  try {
    const credentials = await providerCredentials("instagram", appOrigin, oauthState.workspaceId);
    if (!credentials) throw new Error("Instagram OAuth credentials are no longer configured for this workspace");

    const shortLived = await exchangeCodeForToken(code, credentials);
    const longLived = await getLongLivedToken(shortLived.access_token, credentials);
    const profile = await fetchProfile(longLived.access_token, shortLived.user_id);

    const workspaceId = oauthState.workspaceId;
    const membership = await db.membership.findUnique({
      where: { userId_workspaceId: { userId: oauthState.userId, workspaceId } },
    });
    if (!membership) throw new Error("OAuth workspace membership no longer exists");

    const expiresAt = new Date(Date.now() + longLived.expires_in * 1000);
    await db.socialAccount.upsert({
      where: { workspaceId_platform_handle: { workspaceId, platform: "instagram", handle: `@${profile.username}` } },
      update: {
        displayName: profile.username,
        accessToken: encryptSecret(longLived.access_token),
        externalUserId: profile.user_id,
        tokenExpiresAt: expiresAt,
        followers: profile.followers_count,
        avatarUrl: profile.profile_picture_url,
        providerData: JSON.stringify({ connectionMethod: "instagram_login", apiHost: "graph.instagram.com" }),
        status: "connected",
      },
      create: {
        workspaceId,
        platform: "instagram",
        handle: `@${profile.username}`,
        displayName: profile.username,
        avatarUrl: profile.profile_picture_url,
        avatarGradient: "from-[#f09433] via-[#e6683c] to-[#dc2743]",
        followers: profile.followers_count,
        accessToken: encryptSecret(longLived.access_token),
        externalUserId: profile.user_id,
        tokenExpiresAt: expiresAt,
        providerData: JSON.stringify({ connectionMethod: "instagram_login", apiHost: "graph.instagram.com" }),
        status: "connected",
      },
    });

    return NextResponse.redirect(new URL("/?oauth_success=instagram", appOrigin));
  } catch (err) {
    console.error("[oauth/instagram] error:", err);
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.redirect(new URL(`/?oauth_error=token_exchange&error_detail=${encodeURIComponent(msg)}`, appOrigin));
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyOAuthState } from "@/lib/auth";
import { encryptSecret } from "@/lib/secrets";
import { avatarGradient, PLATFORM_LIST, type PlatformId } from "@/lib/platforms";
import { providerCredentials, type OAuthProvider, type ProviderCredentials } from "@/lib/social-provider-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const META_VERSION = process.env.META_GRAPH_API_VERSION ?? "v26.0";
const LINKEDIN_VERSION = process.env.LINKEDIN_API_VERSION ?? "202607";

async function readJson<T>(res: Response, label: string): Promise<T> {
  const text = await res.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text }; }
  if (!res.ok) {
    const message = parsed?.error?.message ?? parsed?.message ?? parsed?.title ?? text ?? `${label} failed`;
    throw new Error(`${label}: ${message}`);
  }
  return parsed as T;
}

async function saveAccount(input: {
  workspaceId: string;
  platform: PlatformId;
  handle: string;
  displayName: string;
  accessToken: string;
  refreshToken?: string | null;
  externalUserId?: string | null;
  avatarUrl?: string | null;
  followers?: number;
  expiresIn?: number | null;
  providerData?: unknown;
}) {
  const tokenExpiresAt = input.expiresIn ? new Date(Date.now() + input.expiresIn * 1000) : null;
  return db.socialAccount.upsert({
    where: {
      workspaceId_platform_handle: {
        workspaceId: input.workspaceId,
        platform: input.platform,
        handle: input.handle,
      },
    },
    update: {
      displayName: input.displayName,
      avatarUrl: input.avatarUrl ?? null,
      followers: input.followers ?? 0,
      accessToken: encryptSecret(input.accessToken),
      refreshToken: input.refreshToken ? encryptSecret(input.refreshToken) : null,
      externalUserId: input.externalUserId ?? null,
      providerData: input.providerData ? JSON.stringify(input.providerData) : null,
      tokenExpiresAt,
      status: "connected",
    },
    create: {
      workspaceId: input.workspaceId,
      platform: input.platform,
      handle: input.handle,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl ?? null,
      avatarGradient: avatarGradient(input.handle),
      followers: input.followers ?? 0,
      accessToken: encryptSecret(input.accessToken),
      refreshToken: input.refreshToken ? encryptSecret(input.refreshToken) : null,
      externalUserId: input.externalUserId ?? null,
      providerData: input.providerData ? JSON.stringify(input.providerData) : null,
      tokenExpiresAt,
      status: "connected",
    },
  });
}

async function connectLinkedIn(code: string, workspaceId: string, credentials: ProviderCredentials) {
  const token = await readJson<{ access_token: string; expires_in?: number; refresh_token?: string }>(
    await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code", code,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        redirect_uri: credentials.redirectUri,
      }),
    }), "LinkedIn token exchange"
  );
  const profile = await readJson<{ sub: string; name?: string; given_name?: string; family_name?: string; picture?: string }>(
    await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } }),
    "LinkedIn profile"
  );
  const name = profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(" ") || "LinkedIn member";
  await saveAccount({
    workspaceId, platform: "linkedin", handle: name, displayName: name,
    accessToken: token.access_token, refreshToken: token.refresh_token,
    externalUserId: `urn:li:person:${profile.sub}`, avatarUrl: profile.picture,
    expiresIn: token.expires_in,
    providerData: { authorUrn: `urn:li:person:${profile.sub}`, apiVersion: LINKEDIN_VERSION },
  });
}

async function connectX(code: string, workspaceId: string, credentials: ProviderCredentials, verifier: string) {
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (credentials.clientSecret) headers.Authorization = `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`;
  const token = await readJson<{ access_token: string; refresh_token?: string; expires_in?: number }>(
    await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST", headers,
      body: new URLSearchParams({
        code, grant_type: "authorization_code", client_id: credentials.clientId,
        redirect_uri: credentials.redirectUri, code_verifier: verifier,
      }),
    }), "X token exchange"
  );
  const profile = await readJson<{ data: { id: string; username: string; name: string; profile_image_url?: string; public_metrics?: { followers_count?: number } } }>(
    await fetch("https://api.x.com/2/users/me?user.fields=profile_image_url,public_metrics,name,username", { headers: { Authorization: `Bearer ${token.access_token}` } }),
    "X profile"
  );
  const u = profile.data;
  await saveAccount({
    workspaceId, platform: "twitter", handle: `@${u.username}`, displayName: u.name || u.username,
    accessToken: token.access_token, refreshToken: token.refresh_token, externalUserId: u.id,
    avatarUrl: u.profile_image_url, followers: u.public_metrics?.followers_count ?? 0, expiresIn: token.expires_in,
  });
}

async function connectPinterest(code: string, workspaceId: string, credentials: ProviderCredentials) {
  const token = await readJson<{ access_token: string; refresh_token?: string; expires_in?: number; refresh_token_expires_in?: number }>(
    await fetch("https://api.pinterest.com/v5/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: credentials.redirectUri }),
    }), "Pinterest token exchange"
  );
  const headers = { Authorization: `Bearer ${token.access_token}` };
  const profile = await readJson<{ username: string; id?: string; profile_image?: string; account_type?: string; follower_count?: number }>(
    await fetch("https://api.pinterest.com/v5/user_account", { headers }), "Pinterest profile"
  );
  let defaultBoardId: string | null = null;
  let defaultBoardName: string | null = null;
  try {
    const boards = await readJson<{ items?: Array<{ id: string; name: string }> }>(
      await fetch("https://api.pinterest.com/v5/boards?page_size=1", { headers }), "Pinterest boards"
    );
    defaultBoardId = boards.items?.[0]?.id ?? null;
    defaultBoardName = boards.items?.[0]?.name ?? null;
  } catch {
    // Account can still connect; publishing will ask for a default board.
  }
  await saveAccount({
    workspaceId, platform: "pinterest", handle: `@${profile.username}`, displayName: profile.username,
    accessToken: token.access_token, refreshToken: token.refresh_token,
    externalUserId: profile.id ?? profile.username, avatarUrl: profile.profile_image,
    followers: profile.follower_count ?? 0, expiresIn: token.expires_in,
    providerData: { defaultBoardId, defaultBoardName },
  });
}

async function connectThreads(code: string, workspaceId: string, credentials: ProviderCredentials) {
  const short = await readJson<{ access_token: string; user_id?: string }>(
    await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: credentials.clientId, client_secret: credentials.clientSecret,
        grant_type: "authorization_code", redirect_uri: credentials.redirectUri, code,
      }),
    }), "Threads token exchange"
  );
  let accessToken = short.access_token;
  let expiresIn = 3600;
  try {
    const long = await readJson<{ access_token: string; expires_in?: number }>(
      await fetch(`https://graph.threads.com/access_token?${new URLSearchParams({
        grant_type: "th_exchange_token", client_secret: credentials.clientSecret, access_token: short.access_token,
      })}`), "Threads long-lived token"
    );
    accessToken = long.access_token;
    expiresIn = long.expires_in ?? 60 * 24 * 60 * 60;
  } catch {
    // Keep the valid short-lived token; reconnect/refresh can be attempted later.
  }
  const profile = await readJson<{ id: string; username: string; threads_profile_picture_url?: string }>(
    await fetch(`https://graph.threads.com/v1.0/me?${new URLSearchParams({ fields: "id,username,threads_profile_picture_url", access_token: accessToken })}`),
    "Threads profile"
  );
  await saveAccount({
    workspaceId, platform: "threads", handle: `@${profile.username}`, displayName: profile.username,
    accessToken, externalUserId: profile.id, avatarUrl: profile.threads_profile_picture_url, expiresIn,
  });
}

async function connectFacebook(code: string, workspaceId: string, credentials: ProviderCredentials) {
  const token = await readJson<{ access_token: string; expires_in?: number }>(
    await fetch(`https://graph.facebook.com/${META_VERSION}/oauth/access_token?${new URLSearchParams({
      client_id: credentials.clientId, client_secret: credentials.clientSecret,
      redirect_uri: credentials.redirectUri, code,
    })}`), "Facebook token exchange"
  );

  let userToken = token.access_token;
  let expiresIn = token.expires_in ?? 60 * 24 * 60 * 60;
  try {
    const long = await readJson<{ access_token: string; expires_in?: number }>(
      await fetch(`https://graph.facebook.com/${META_VERSION}/oauth/access_token?${new URLSearchParams({
        grant_type: "fb_exchange_token", client_id: credentials.clientId,
        client_secret: credentials.clientSecret, fb_exchange_token: token.access_token,
      })}`), "Facebook long-lived token"
    );
    userToken = long.access_token;
    expiresIn = long.expires_in ?? expiresIn;
  } catch {
    // The initial token is still usable if the long-lived exchange is unavailable.
  }

  type FacebookPage = {
    id: string;
    name: string;
    access_token: string;
    followers_count?: number;
    fan_count?: number;
    picture?: { data?: { url?: string } };
    tasks?: string[];
    instagram_business_account?: { id?: string };
  };

  const pages = await readJson<{ data?: FacebookPage[] }>(
    await fetch(`https://graph.facebook.com/${META_VERSION}/me/accounts?${new URLSearchParams({
      fields: "id,name,access_token,followers_count,fan_count,picture{url},tasks,instagram_business_account",
      access_token: userToken,
    })}`), "Facebook Pages"
  );

  if (!pages.data?.length) throw new Error("Facebook Pages: no manageable Pages were returned for this account");

  for (const page of pages.data) {
    // Preserve Loomic's existing Facebook Page connection behavior.
    await saveAccount({
      workspaceId,
      platform: "facebook",
      handle: page.name,
      displayName: page.name,
      accessToken: page.access_token,
      externalUserId: page.id,
      avatarUrl: page.picture?.data?.url,
      followers: page.followers_count ?? page.fan_count ?? 0,
      expiresIn,
      providerData: { pageId: page.id, tasks: page.tasks ?? [] },
    });

    const igUserId = page.instagram_business_account?.id;
    if (!igUserId) continue;

    try {
      const profile = await readJson<{
        id?: string;
        username?: string;
        name?: string;
        profile_picture_url?: string;
        followers_count?: number;
      }>(
        await fetch(`https://graph.facebook.com/${META_VERSION}/${encodeURIComponent(igUserId)}?${new URLSearchParams({
          fields: "id,username,name,profile_picture_url,followers_count",
          access_token: page.access_token,
        })}`),
        `Instagram profile linked to ${page.name}`
      );

      if (!profile.username) continue;

      // SocialAccount is unique by workspace/platform/handle. If this Instagram
      // account was previously connected through Instagram Login, this upgrades
      // the SAME row in-place, so scheduled posts, client assignments and
      // analytics relations continue to point to the same account ID.
      await saveAccount({
        workspaceId,
        platform: "instagram",
        handle: `@${profile.username}`,
        displayName: profile.name || profile.username,
        accessToken: page.access_token,
        externalUserId: profile.id || igUserId,
        avatarUrl: profile.profile_picture_url,
        followers: Number(profile.followers_count ?? 0),
        expiresIn,
        providerData: {
          connectionMethod: "facebook_login",
          apiHost: "graph.facebook.com",
          pageId: page.id,
          pageName: page.name,
          pageTasks: page.tasks ?? [],
        },
      });
    } catch (error) {
      // A Facebook Page can still connect even if its linked Instagram account
      // cannot be read with the granted permissions. Do not roll back the Page.
      console.warn(`[oauth/facebook] linked Instagram discovery failed for page ${page.id}`, error);
    }
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider: raw } = await context.params;
  if (raw === "instagram" || !PLATFORM_LIST.some((p) => p.id === raw)) {
    return NextResponse.redirect(new URL("/?oauth_error=unsupported_provider", req.url));
  }
  const provider = raw as Exclude<OAuthProvider, "instagram">;
  const url = new URL(req.url);
  if (url.searchParams.get("error")) return NextResponse.redirect(new URL(`/?oauth_error=${encodeURIComponent(provider)}`, url.origin));
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return NextResponse.redirect(new URL("/?oauth_error=missing_params", url.origin));
  const oauth = verifyOAuthState(state);
  if (!oauth || oauth.provider !== provider) return NextResponse.redirect(new URL("/?oauth_error=invalid_state", url.origin));

  const membership = await db.membership.findUnique({ where: { userId_workspaceId: { userId: oauth.userId, workspaceId: oauth.workspaceId } } });
  if (!membership) return NextResponse.redirect(new URL("/?oauth_error=workspace_access", url.origin));
  const credentials = await providerCredentials(provider, url.origin, oauth.workspaceId);
  if (!credentials) return NextResponse.redirect(new URL("/?oauth_error=provider_not_configured", url.origin));

  try {
    if (provider === "linkedin") await connectLinkedIn(code, oauth.workspaceId, credentials);
    else if (provider === "twitter") {
      const verifier = req.cookies.get("sf_x_pkce")?.value;
      if (!verifier) throw new Error("X PKCE verifier cookie is missing or expired");
      await connectX(code, oauth.workspaceId, credentials, verifier);
    }
    else if (provider === "pinterest") await connectPinterest(code, oauth.workspaceId, credentials);
    else if (provider === "threads") await connectThreads(code, oauth.workspaceId, credentials);
    else if (provider === "facebook") await connectFacebook(code, oauth.workspaceId, credentials);

    const response = NextResponse.redirect(new URL(`/?oauth_success=${provider}`, url.origin));
    if (provider === "twitter") response.cookies.delete("sf_x_pkce");
    return response;
  } catch (error) {
    console.error(`[oauth/${provider}]`, error);
    const detail = error instanceof Error ? error.message : "unknown";
    return NextResponse.redirect(new URL(`/?oauth_error=${provider}&error_detail=${encodeURIComponent(detail)}`, url.origin));
  }
}

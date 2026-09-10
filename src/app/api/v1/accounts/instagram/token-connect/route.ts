import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireWorkspace } from "@/lib/server-auth";
import { encryptSecret } from "@/lib/secrets";
import { providerCredentials } from "@/lib/social-provider-oauth";
import { consumeAccountConnectionGrant } from "@/lib/account-connection-lock";

export const runtime = "nodejs";

const META_VERSION = process.env.META_GRAPH_API_VERSION ?? "v26.0";
const IG_GRAPH_BASE = `https://graph.instagram.com/${META_VERSION}`;

const schema = z.object({
  workspaceId: z.string().min(1),
  accessToken: z.string().trim().min(20).max(10000),
});

type Profile = {
  id?: string;
  user_id?: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
};

async function fetchProfile(accessToken: string): Promise<Profile> {
  const basicParams = new URLSearchParams({
    fields: "id,username,name",
    access_token: accessToken,
  });
  const basicRes = await fetch(`${IG_GRAPH_BASE}/me?${basicParams.toString()}`, { cache: "no-store" });
  const text = await basicRes.text();
  if (!basicRes.ok) {
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.error?.message ?? parsed?.message ?? text;
    } catch {}
    throw ApiError.badRequest(`Instagram token could not be verified: ${message}`);
  }
  const core = JSON.parse(text) as Profile;

  // Optional enrichment must never block a valid account connection.
  try {
    const extraParams = new URLSearchParams({
      fields: "id,username,name,profile_picture_url,followers_count",
      access_token: accessToken,
    });
    const extraRes = await fetch(`${IG_GRAPH_BASE}/me?${extraParams.toString()}`, { cache: "no-store" });
    if (extraRes.ok) return { ...core, ...(await extraRes.json() as Profile) };
  } catch {}

  return core;
}

async function tryLongLivedToken(shortToken: string, clientSecret: string) {
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: clientSecret,
    access_token: shortToken,
  });
  const res = await fetch(`https://graph.instagram.com/access_token?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!res.ok) return null;
  const value = await res.json() as { access_token?: string; expires_in?: number };
  if (!value.access_token) return null;
  return {
    accessToken: value.access_token,
    expiresIn: Number(value.expires_in || 0),
  };
}

export const POST = withHandler(schema, async ({ req, body }) => {
  const { workspaceId, accessToken: pastedToken } = body!;
  const auth = await requireWorkspace(req, workspaceId, "account.connect");
  await consumeAccountConnectionGrant(req, workspaceId, auth.userId);

  // The app secret is needed to turn Meta's short-lived developer token into
  // a 60-day Instagram User token. If the pasted token is already long-lived,
  // we still accept it after profile verification.
  const origin = new URL(req.url).origin;
  const credentials = await providerCredentials("instagram", origin, workspaceId);
  if (!credentials) {
    throw ApiError.badRequest(
      "Add your Instagram App ID and App Secret in Settings → Integrations first, then paste the generated Meta token here."
    );
  }

  const exchanged = await tryLongLivedToken(pastedToken, credentials.clientSecret);
  const tokenToStore = exchanged?.accessToken ?? pastedToken;
  const profile = await fetchProfile(tokenToStore);

  const username = profile.username?.trim();
  const externalUserId = String(profile.user_id || profile.id || "").trim();
  if (!username || !externalUserId) {
    throw ApiError.badRequest("Instagram returned an incomplete profile. Generate a new token in Meta and try again.");
  }

  const expiresAt = exchanged?.expiresIn
    ? new Date(Date.now() + exchanged.expiresIn * 1000)
    : null;

  const account = await db.socialAccount.upsert({
    where: {
      workspaceId_platform_handle: {
        workspaceId,
        platform: "instagram",
        handle: `@${username}`,
      },
    },
    update: {
      displayName: profile.name || username,
      avatarUrl: profile.profile_picture_url ?? null,
      followers: Number(profile.followers_count || 0),
      accessToken: encryptSecret(tokenToStore),
      refreshToken: null,
      externalUserId,
      tokenExpiresAt: expiresAt,
      providerData: JSON.stringify({ connectionMethod: "meta_developer_token" }),
      status: "connected",
    },
    create: {
      workspaceId,
      platform: "instagram",
      handle: `@${username}`,
      displayName: profile.name || username,
      avatarUrl: profile.profile_picture_url ?? null,
      avatarGradient: "from-[#f09433] via-[#e6683c] to-[#dc2743]",
      followers: Number(profile.followers_count || 0),
      accessToken: encryptSecret(tokenToStore),
      refreshToken: null,
      externalUserId,
      tokenExpiresAt: expiresAt,
      providerData: JSON.stringify({ connectionMethod: "meta_developer_token" }),
      status: "connected",
    },
  });

  return ok({
    id: account.id,
    platform: account.platform,
    handle: account.handle,
    displayName: account.displayName,
    avatarUrl: account.avatarUrl,
    followers: account.followers,
    status: account.status,
    externalUserId: account.externalUserId,
    tokenExpiresAt: account.tokenExpiresAt,
    isReal: true,
    connectionMethod: "meta_developer_token",
    tokenWasExchanged: Boolean(exchanged),
  }, {}, 201);
});

import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireUser, requireWorkspace } from "@/lib/server-auth";
import { encryptSecret } from "@/lib/secrets";
import { PLATFORM_LIST, type PlatformId } from "@/lib/platforms";
import { defaultRedirectUri, providerCredentials, publicAppOrigin } from "@/lib/social-provider-oauth";

export const runtime = "nodejs";

const providerEnum = z.enum(["instagram", "facebook", "threads", "linkedin", "twitter", "pinterest"]);

function maskClientId(value?: string | null) {
  if (!value) return null;
  if (value.length <= 8) return `${value.slice(0, 2)}••••${value.slice(-2)}`;
  return `${value.slice(0, 5)}••••••${value.slice(-4)}`;
}

export const GET = withHandler(null, async ({ req }) => {
  const auth = requireUser(req);
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId") || auth.workspaceId;
  if (!workspaceId) throw ApiError.badRequest("No active workspace");
  await requireWorkspace(req, workspaceId, "workspace.update");

  const effectiveOrigin = publicAppOrigin(url.origin);
  const saved = await db.providerCredential.findMany({ where: { workspaceId } });
  const savedByProvider = new Map(saved.map((row) => [row.provider, row]));

  const providers = await Promise.all(PLATFORM_LIST.map(async (p) => {
    const resolved = await providerCredentials(p.id, effectiveOrigin, workspaceId);
    const row = savedByProvider.get(p.id);
    return {
      provider: p.id,
      configured: Boolean(resolved),
      source: resolved?.source ?? null,
      clientId: row?.clientId ?? resolved?.clientId ?? "",
      clientIdMasked: maskClientId(row?.clientId ?? (resolved?.source === "environment" ? resolved.clientId : null)),
      hasSavedSecret: Boolean(row?.clientSecret),
      redirectUri: resolved?.redirectUri || row?.redirectUri || defaultRedirectUri(p.id, effectiveOrigin),
      redirectManaged: process.env.SOCIALFLOW_PUBLIC_TUNNEL === "1",
      requiresSecret: p.id !== "twitter",
      enabled: row?.enabled ?? true,
    };
  }));

  return ok({ workspaceId, providers });
});

const saveSchema = z.object({
  workspaceId: z.string().min(1),
  provider: providerEnum,
  clientId: z.string().trim().min(1).max(500),
  clientSecret: z.string().max(2000).optional(),
  redirectUri: z.string().url().max(2000).optional(),
});

export const PUT = withHandler(saveSchema, async ({ req, body }) => {
  const { workspaceId, provider, clientId, clientSecret, redirectUri } = body!;
  await requireWorkspace(req, workspaceId, "workspace.update");

  const existing = await db.providerCredential.findUnique({
    where: { workspaceId_provider: { workspaceId, provider } },
  });

  if (provider !== "twitter" && !clientSecret?.trim() && !existing?.clientSecret) {
    throw ApiError.badRequest("Client secret is required for this provider");
  }

  const origin = publicAppOrigin(new URL(req.url).origin);
  const resolvedRedirect = process.env.SOCIALFLOW_PUBLIC_TUNNEL === "1"
    ? defaultRedirectUri(provider as PlatformId, origin)
    : (redirectUri?.trim() || defaultRedirectUri(provider as PlatformId, origin));
  const data = {
    clientId: clientId.trim(),
    redirectUri: resolvedRedirect,
    enabled: true,
    ...(clientSecret?.trim() ? { clientSecret: encryptSecret(clientSecret.trim()) } : {}),
  };

  const saved = await db.providerCredential.upsert({
    where: { workspaceId_provider: { workspaceId, provider } },
    update: data,
    create: { workspaceId, provider, ...data },
  });

  return ok({
    provider,
    configured: true,
    source: "workspace",
    clientIdMasked: maskClientId(saved.clientId),
    hasSavedSecret: Boolean(saved.clientSecret),
    redirectUri: saved.redirectUri,
  });
});

const deleteSchema = z.object({
  workspaceId: z.string().min(1),
  provider: providerEnum,
});

export const DELETE = withHandler(null, async ({ req }) => {
  const auth = requireUser(req);
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId") || auth.workspaceId;
  const provider = providerEnum.safeParse(url.searchParams.get("provider"));
  if (!workspaceId) throw ApiError.badRequest("No active workspace");
  if (!provider.success) throw ApiError.badRequest("Invalid provider");
  await requireWorkspace(req, workspaceId, "workspace.update");

  await db.providerCredential.deleteMany({ where: { workspaceId, provider: provider.data } });
  return ok({ removed: true, provider: provider.data });
});

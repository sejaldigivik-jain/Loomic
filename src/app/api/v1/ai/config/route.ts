import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireUser, requireWorkspace } from "@/lib/server-auth";
import { encryptSecret } from "@/lib/secrets";
import {
  aiProviderConfig,
  aiProviderMode,
  DEFAULT_AI_MODEL,
  generateAIText,
  setAIProviderMode,
  type AIMode,
} from "@/lib/ai-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODELS = ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6"] as const;
const modelSchema = z.enum(MODELS);
const modeSchema = z.enum(["local", "openai"]);

function maskKey(value?: string | null) {
  if (!value) return null;
  if (value.length <= 10) return "••••••••";
  return `${value.slice(0, 7)}••••••••${value.slice(-4)}`;
}

export const GET = withHandler(null, async ({ req }) => {
  const auth = requireUser(req);
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId") || auth.workspaceId;
  if (!workspaceId) throw ApiError.badRequest("No active workspace");
  await requireWorkspace(req, workspaceId, "workspace.update");

  const row = await db.providerCredential.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: "openai" } },
  });
  const mode = await aiProviderMode(workspaceId);
  const resolved = await aiProviderConfig(workspaceId);
  const envConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const openaiConfigured = Boolean(row?.clientSecret || envConfigured);

  return ok({
    workspaceId,
    mode,
    configured: mode === "local" ? true : Boolean(resolved),
    openaiConfigured,
    localAssistAvailable: true,
    source: mode === "openai" ? resolved?.source ?? (envConfigured ? "environment" : null) : null,
    model: row?.clientId || process.env.OPENAI_MODEL?.trim() || DEFAULT_AI_MODEL,
    hasSavedKey: Boolean(row?.clientSecret),
    keyMasked: row?.clientSecret ? "Saved securely" : envConfigured ? "Environment key" : null,
    models: MODELS,
  });
});

const saveSchema = z.object({
  workspaceId: z.string().min(1),
  mode: modeSchema.default("local"),
  apiKey: z.string().trim().max(500).optional(),
  model: modelSchema.default(DEFAULT_AI_MODEL),
});

export const PUT = withHandler(saveSchema, async ({ req, body }) => {
  const { workspaceId, mode, apiKey, model } = body!;
  await requireWorkspace(req, workspaceId, "workspace.update");

  if (mode === "local") {
    // Keep any saved OpenAI key untouched so the user can switch back later,
    // but explicitly disable remote API usage for this workspace.
    await setAIProviderMode(workspaceId, "local");
    return ok({
      configured: true,
      mode: "local" satisfies AIMode,
      provider: "local",
      model: "local-assist",
      message: "Local Assist is active. No OpenAI API requests will be made.",
    });
  }

  const existing = await db.providerCredential.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: "openai" } },
  });
  if (!apiKey?.trim() && !existing?.clientSecret && !process.env.OPENAI_API_KEY?.trim()) {
    throw ApiError.badRequest("OpenAI mode requires an API key");
  }

  const data = {
    clientId: model,
    enabled: true,
    ...(apiKey?.trim() ? { clientSecret: encryptSecret(apiKey.trim()) } : {}),
  };

  await db.providerCredential.upsert({
    where: { workspaceId_provider: { workspaceId, provider: "openai" } },
    update: data,
    create: { workspaceId, provider: "openai", ...data },
  });
  await setAIProviderMode(workspaceId, "openai");

  return ok({
    configured: true,
    mode: "openai" satisfies AIMode,
    provider: "openai",
    source: apiKey?.trim() || existing?.clientSecret ? "workspace" : "environment",
    model,
    keyMasked: apiKey?.trim() ? maskKey(apiKey.trim()) : existing?.clientSecret ? "Saved securely" : "Environment key",
  });
});

const testSchema = z.object({ workspaceId: z.string().min(1) });
export const POST = withHandler(testSchema, async ({ req, body }) => {
  const { workspaceId } = body!;
  await requireWorkspace(req, workspaceId);
  const mode = await aiProviderMode(workspaceId);

  if (mode === "local") {
    return ok({
      connected: true,
      provider: "local",
      mode: "local",
      model: "local-assist",
      message: "Local Assist is ready and uses no paid API.",
    });
  }

  const config = await aiProviderConfig(workspaceId);
  if (!config) throw ApiError.badRequest("OpenAI mode is selected but no API key is configured");

  try {
    const result = await generateAIText({
      workspaceId,
      instructions: "You are a connectivity test. Reply with exactly: Loomic AI connected",
      input: "Test the AI connection.",
      maxOutputTokens: 100,
      allowFallback: false,
    });
    return ok({ connected: true, provider: result.provider, mode: "openai", model: result.model, message: result.text });
  } catch (err) {
    throw ApiError.badRequest(err instanceof Error ? err.message : "AI connection test failed");
  }
});

export const DELETE = withHandler(null, async ({ req }) => {
  const auth = requireUser(req);
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId") || auth.workspaceId;
  if (!workspaceId) throw ApiError.badRequest("No active workspace");
  await requireWorkspace(req, workspaceId, "workspace.update");
  await db.providerCredential.deleteMany({ where: { workspaceId, provider: "openai" } });
  await setAIProviderMode(workspaceId, "local");
  return ok({ removed: true, mode: "local" });
});

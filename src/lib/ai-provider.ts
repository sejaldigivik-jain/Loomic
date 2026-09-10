import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/secrets";

export type AIMode = "local" | "openai";

export type AIProviderConfig = {
  apiKey: string;
  model: string;
  source: "workspace" | "environment";
};

export type AITextResult = {
  text: string;
  model: string;
  provider: "openai" | "local";
  fallback: boolean;
  warning?: string;
};

export const DEFAULT_AI_MODEL = "gpt-5.6-luna";
const AI_MODE_PROVIDER = "socialflow_ai_mode";

/**
 * SocialFlow is intentionally Local Assist first. OpenAI is only contacted
 * after a workspace explicitly selects OpenAI mode in Settings.
 *
 * The selected mode is stored in ProviderCredential so this patch does not
 * require a Prisma migration and existing saved OpenAI keys remain untouched.
 */
export async function aiProviderMode(workspaceId?: string | null): Promise<AIMode> {
  if (!workspaceId) return "local";

  const row = await db.providerCredential.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: AI_MODE_PROVIDER } },
  }).catch(() => null);

  return row?.clientId === "openai" ? "openai" : "local";
}

export async function setAIProviderMode(workspaceId: string, mode: AIMode): Promise<void> {
  await db.providerCredential.upsert({
    where: { workspaceId_provider: { workspaceId, provider: AI_MODE_PROVIDER } },
    update: { clientId: mode, clientSecret: null, redirectUri: null, enabled: true },
    create: {
      workspaceId,
      provider: AI_MODE_PROVIDER,
      clientId: mode,
      clientSecret: null,
      redirectUri: null,
      enabled: true,
    },
  });
}

export async function aiProviderConfig(workspaceId?: string | null): Promise<AIProviderConfig | null> {
  if (workspaceId) {
    const mode = await aiProviderMode(workspaceId);
    if (mode !== "openai") return null;

    const row = await db.providerCredential.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "openai" } },
    }).catch(() => null);

    if (row?.enabled && row.clientSecret) {
      try {
        return {
          apiKey: decryptSecret(row.clientSecret),
          model: row.clientId || DEFAULT_AI_MODEL,
          source: "workspace",
        };
      } catch (error) {
        console.error("[AI] Could not decrypt saved workspace key:", error);
      }
    }

    // Environment keys are also opt-in. They are not used until this workspace
    // explicitly switches its AI mode to OpenAI.
    const envKey = process.env.OPENAI_API_KEY?.trim();
    if (!envKey) return null;
    return {
      apiKey: envKey,
      model: row?.clientId || process.env.OPENAI_MODEL?.trim() || DEFAULT_AI_MODEL,
      source: "environment",
    };
  }

  // Internal calls without a workspace keep the old environment behaviour.
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.OPENAI_MODEL?.trim() || DEFAULT_AI_MODEL,
    source: "environment",
  };
}

function responseText(payload: any): string {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const parts: string[] = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if ((content?.type === "output_text" || content?.type === "text") && typeof content?.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n").trim();
}

function localResult(text: string, warning?: string, fallback = true): AITextResult {
  return {
    text,
    model: "local-assist",
    provider: "local",
    fallback,
    ...(warning ? { warning } : {}),
  };
}

/**
 * Generate text using OpenAI only when the workspace explicitly selects it.
 * Local Assist is the free default and does not make an external API request.
 */
export async function generateAIText(args: {
  workspaceId?: string | null;
  instructions: string;
  input: string;
  maxOutputTokens?: number;
  fallbackText?: string;
  allowFallback?: boolean;
}): Promise<AITextResult> {
  const allowFallback = args.allowFallback !== false;
  const mode = await aiProviderMode(args.workspaceId);

  if (mode === "local") {
    if (allowFallback && args.fallbackText) {
      return localResult(args.fallbackText, undefined, false);
    }
    throw new Error("Local Assist mode is active. Switch to OpenAI in Settings if you want to test the OpenAI API.");
  }

  const config = await aiProviderConfig(args.workspaceId);
  if (!config) {
    if (allowFallback && args.fallbackText) {
      return localResult(args.fallbackText, "OpenAI mode is selected but no API key is configured. Local Assist was used instead.");
    }
    throw new Error("OpenAI mode is selected but no API key is configured. Open Settings → AI Provider and add an API key.");
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        instructions: args.instructions,
        input: args.input,
        max_output_tokens: args.maxOutputTokens ?? 900,
        reasoning: { effort: "none" },
      }),
      cache: "no-store",
    });

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      // Keep the error below useful even if an upstream proxy returned non-JSON.
    }

    if (!response.ok) {
      const upstream = payload?.error?.message || `OpenAI request failed with HTTP ${response.status}`;
      let message = upstream;
      if (response.status === 401) message = "OpenAI API key was rejected. Check the key in Settings → AI Provider.";
      if (response.status === 429) message = "OpenAI rate/usage limit reached. Check API billing and limits.";
      if (allowFallback && args.fallbackText) return localResult(args.fallbackText, `${message} Local Assist was used instead.`);
      throw new Error(message);
    }

    const text = responseText(payload);
    if (!text) {
      if (allowFallback && args.fallbackText) return localResult(args.fallbackText, "OpenAI returned an empty response; Local Assist was used.");
      throw new Error("OpenAI returned an empty response. Try again.");
    }
    return { text, model: config.model, provider: "openai", fallback: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI request failed";
    if (allowFallback && args.fallbackText) return localResult(args.fallbackText, `${message} Local Assist was used instead.`);
    throw error;
  }
}

import { z } from "zod";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireUser } from "@/lib/server-auth";
import { generateAIText } from "@/lib/ai-provider";
import { localHashtags } from "@/lib/local-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  topic: z.string().min(3).max(500),
  platform: z.enum(["linkedin", "twitter", "instagram", "facebook", "threads", "pinterest"]).optional(),
  count: z.number().int().min(5).max(30).default(12),
});

export const POST = withHandler(schema, async ({ req, body }) => {
  const auth = requireUser(req);
  if (!auth.workspaceId) throw ApiError.badRequest("No active workspace");
  const { topic, platform, count } = body!;

  const instructions = `You are a social media hashtag strategist. Generate ${count} relevant hashtags for the given topic.
${platform ? `Optimise for ${platform}.` : "Be platform-agnostic."}
Return ONLY valid JSON with this exact shape and no markdown fences:
{"broad":["#hashtag"],"niche":["#hashtag"],"micro":["#hashtag"]}
Use lowercase hashtags, no spaces, and distribute the requested count sensibly across the three arrays. Do not invent claims about exact live post counts.`;

  try {
    const local = localHashtags(topic, count, platform);
    const result = await generateAIText({
      workspaceId: auth.workspaceId,
      instructions,
      input: `Topic: ${topic}`,
      maxOutputTokens: 650,
      fallbackText: JSON.stringify(local),
    });
    const cleaned = result.text.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "").trim();
    let parsed: { broad: string[]; niche: string[]; micro: string[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const all = (result.text.match(/#[\p{L}\p{N}_]+/gu) ?? []).slice(0, count);
      const a = Math.ceil(all.length / 3);
      parsed = { broad: all.slice(0, a), niche: all.slice(a, a * 2), micro: all.slice(a * 2) };
    }
    return ok({
      hashtags: parsed,
      total: parsed.broad.length + parsed.niche.length + parsed.micro.length,
      model: result.model,
      provider: result.provider,
      fallback: result.fallback,
      warning: result.warning ?? null,
    });
  } catch (err) {
    console.error("[ai/hashtag] error:", err);
    throw ApiError.badRequest(err instanceof Error ? err.message : "Failed to generate hashtags. Please try again.");
  }
});

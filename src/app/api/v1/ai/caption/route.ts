import { z } from "zod";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireUser } from "@/lib/server-auth";
import { generateAIText } from "@/lib/ai-provider";
import { localCaptionText } from "@/lib/local-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  topic: z.string().min(3).max(500),
  platform: z.enum(["linkedin", "twitter", "instagram", "facebook", "threads", "pinterest"]).optional(),
  tone: z.enum(["professional", "casual", "witty", "inspirational", "bold", "educational", "empathetic", "persuasive"]).default("professional"),
  length: z.enum(["short", "medium", "long"]).default("medium"),
});

const LENGTH_MAP: Record<string, number> = { short: 120, medium: 280, long: 600 };
const PLATFORM_GUIDE: Record<string, string> = {
  linkedin: "Optimise for LinkedIn: professional hook, 1-2 short paragraphs, end with a question to drive comments.",
  twitter: "Optimise for X/Twitter: punchy opening, max 270 chars, include 1-2 hashtags.",
  instagram: "Optimise for Instagram: emotive opening, readable line breaks, relevant hashtags at the end.",
  facebook: "Optimise for Facebook: conversational, story-driven, end with a CTA.",
  threads: "Optimise for Threads: conversational, short, avoid hashtag stuffing.",
  pinterest: "Optimise for Pinterest: keyword-rich and descriptive with a clear benefit.",
};

export const POST = withHandler(schema, async ({ req, body }) => {
  const auth = requireUser(req);
  if (!auth.workspaceId) throw ApiError.badRequest("No active workspace");
  const { topic, platform, tone, length } = body!;
  const maxChars = LENGTH_MAP[length];

  const instructions = `You are an expert social media copywriter. Generate 3 distinct caption variations for the user's topic.
Each caption MUST:
- Be written in a ${tone} tone
- Stay under ${maxChars} characters
- ${platform ? PLATFORM_GUIDE[platform] : "Be platform-agnostic"}
- Be useful, specific and original
- Not put quotation marks around the whole caption
Return ONLY the 3 captions separated by ---CAPTION--- markers. No preamble and no numbering.`;

  try {
    const fallbackText = localCaptionText({ topic, tone, platform, maxChars });
    const result = await generateAIText({
      workspaceId: auth.workspaceId,
      instructions,
      input: `Topic: ${topic}`,
      maxOutputTokens: 900,
      fallbackText,
    });
    const captions = result.text.split("---CAPTION---").map((c) => c.trim()).filter(Boolean).slice(0, 3);
    if (captions.length === 0) throw new Error("AI returned no captions");
    return ok({
      captions,
      tone,
      platform: platform ?? "general",
      model: result.model,
      provider: result.provider,
      fallback: result.fallback,
      warning: result.warning ?? null,
    });
  } catch (err) {
    console.error("[ai/caption] error:", err);
    throw ApiError.badRequest(err instanceof Error ? err.message : "Failed to generate captions. Please try again.");
  }
});

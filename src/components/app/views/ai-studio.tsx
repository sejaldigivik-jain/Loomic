"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Hash,
  RefreshCw,
  Type,
  Lightbulb,
  Wand2,
  Copy,
  Check,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { authenticatedFetch, useSocialFlow } from "@/lib/store";
import { TONE_OPTIONS, type Tone } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ToolId = "caption" | "hashtag" | "rewrite" | "ideas" | "tone";

const TOOLS: { id: ToolId; label: string; desc: string; icon: typeof Sparkles }[] = [
  { id: "caption", label: "Caption generator", desc: "Turn a topic into a ready-to-post caption", icon: Sparkles },
  { id: "hashtag", label: "Hashtag generator", desc: "Find trending, relevant hashtags", icon: Hash },
  { id: "rewrite", label: "AI rewrite", desc: "Get a fresh angle on existing copy", icon: RefreshCw },
  { id: "tone", label: "Tone changer", desc: "Rewrite in a different voice", icon: Type },
  { id: "ideas", label: "Content ideas", desc: "Brainstorm what to post next", icon: Lightbulb },
];

/**
 * AIStudioView — a focused workspace for the AI tools. Users pick a
 * tool, fill in the input, and the studio returns polished output that
 * can be copied to the clipboard or sent straight to the Composer.
 */
export function AIStudioView() {
  const { setComposerContent, setActiveView, accessToken } = useSocialFlow();
  const [activeTool, setActiveTool] = useState<ToolId>("caption");
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const [tone, setTone] = useState<Tone>("Professional");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const run = async () => {
    const source = (activeTool === "rewrite" || activeTool === "tone" ? text : topic).trim();
    if (!source) {
      toast.error(activeTool === "rewrite" || activeTool === "tone" ? "Add some text first" : "Add a topic first");
      return;
    }

    setLoading(true);
    setOutput([]);
    try {
      let responseData: any = null;
      if (activeTool === "hashtag") {
        const res = await authenticatedFetch("/api/v1/ai/hashtag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: source, count: 12 }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "Hashtag generation failed");
        responseData = json.data;
        const tiers = json.data?.hashtags ?? {};
        const rows = [tiers.broad, tiers.niche, tiers.micro]
          .filter(Array.isArray)
          .map((items: string[]) => items.join(" "))
          .filter(Boolean);
        setOutput(rows);
      } else {
        const toneValue = tone.toLowerCase();
        const topicValue =
          activeTool === "rewrite"
            ? `Rewrite this social media copy while preserving its meaning: ${source}`
            : activeTool === "tone"
              ? `Rewrite this social media copy in a ${toneValue} voice: ${source}`
              : activeTool === "ideas"
                ? `Create three distinct social media post ideas about: ${source}`
                : source;
        const res = await authenticatedFetch("/api/v1/ai/caption", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: topicValue.slice(0, 500), tone: toneValue, length: activeTool === "ideas" ? "short" : "medium" }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "AI generation failed");
        responseData = json.data;
        setOutput(json.data?.captions ?? []);
      }
      if (responseData?.provider === "local") {
        toast.info("Generation complete · Local Assist", {
          description: responseData?.warning ?? "Free Local Assist generated this without an external API call.",
        });
      } else {
        toast.success("Generation complete · OpenAI");
      }
    } catch (error) {
      toast.error("AI generation failed", {
        description: error instanceof Error ? error.message : "Check Settings → AI Provider.",
      });
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
    toast.success("Copied to clipboard");
  };

  const sendToComposer = (text: string) => {
    setComposerContent(text);
    setActiveView("composer");
    toast.success("Sent to Composer", { description: "Edit and schedule your post." });
  };

  const activeToolMeta = TOOLS.find((t) => t.id === activeTool)!;

  return (
    <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[280px_1fr] lg:p-8">
      {/* Tool selector */}
      <div className="space-y-2">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white">
            <Wand2 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">AI Studio</div>
            <div className="text-[10px] text-muted-foreground">5 server-side tools</div>
          </div>
        </div>
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => {
              setActiveTool(tool.id);
              setOutput([]);
            }}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all",
              activeTool === tool.id
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/40"
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                activeTool === tool.id
                  ? "bg-gradient-to-br from-primary to-accent text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <tool.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className={cn("text-sm font-medium", activeTool === tool.id && "text-primary")}>
                {tool.label}
              </div>
              <div className="text-[11px] text-muted-foreground">{tool.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Active tool panel */}
      <div className="space-y-4">
        <motion.div
          key={activeTool}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <activeToolMeta.icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg font-semibold">{activeToolMeta.label}</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">{activeToolMeta.desc}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Inputs vary per tool */}
              {(activeTool === "caption" || activeTool === "ideas") && (
                <div className="space-y-1.5">
                  <Label htmlFor="topic">Topic or theme</Label>
                  <Input
                    id="topic"
                    placeholder="e.g. launching a new product feature"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="h-11"
                  />
                </div>
              )}

              {(activeTool === "rewrite" || activeTool === "tone") && (
                <div className="space-y-1.5">
                  <Label htmlFor="text">Your text</Label>
                  <Textarea
                    id="text"
                    placeholder="Paste the copy you want to improve…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
              )}

              {activeTool === "tone" && (
                <div className="space-y-1.5">
                  <Label>Target tone</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {TONE_OPTIONS.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTone(t)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          tone === t
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTool === "hashtag" && (
                <div className="space-y-1.5">
                  <Label htmlFor="topic">Topic or keyword</Label>
                  <Input
                    id="topic"
                    placeholder="e.g. product launch, sustainability, design"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="h-11"
                  />
                </div>
              )}

              <Button
                onClick={run}
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary to-accent text-white shadow-glow sm:w-auto"
              >
                {loading ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Output */}
        <AnimatePresence>
          {output.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">
                  {output.length} result{output.length === 1 ? "" : "s"}
                </span>
                <Button variant="ghost" size="sm" onClick={run} disabled={loading}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Regenerate
                </Button>
              </div>

              {output.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.08 }}
                  className="group relative rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  {activeTool === "hashtag" ? (
                    <div className="flex flex-wrap gap-1.5">
                      {item.split(" ").map((tag, i) => (
                        <Badge key={i} variant="secondary" className="bg-primary/10 text-primary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed">{item}</p>
                  )}

                  <div className="mt-3 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="outline" size="sm" onClick={() => copy(item, idx)}>
                      {copiedIdx === idx ? (
                        <>
                          <Check className="mr-1 h-3.5 w-3.5 text-success" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </Button>
                    {activeTool !== "ideas" && activeTool !== "hashtag" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendToComposer(item)}
                      >
                        Send to Composer
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {output.length === 0 && !loading && (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-sm font-medium">Ready when you are</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Fill in the input above and hit Generate. Your results will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

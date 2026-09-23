"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Image as ImageIcon,
  Video,
  Smile,
  Hash,
  Sparkles,
  Calendar,
  Send,
  Save,
  Wand2,
  RefreshCw,
  Type,
  Lightbulb,
  X,
  Check,
  Clock,
  Music2,
  MapPin,
  UserPlus,
  Users,
  Accessibility,
  Layers3,
  Film,
  Smartphone,
  Info,
  Loader2,
  LockKeyhole,
  Captions,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { authenticatedFetch, useSocialFlow } from "@/lib/store";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import type { InstagramPostType } from "@/lib/mock-data";
import { cn, formatCompact } from "@/lib/utils";
import { PlatformPreview } from "../composer/platform-preview";
import { StoryEditor } from "../composer/story-editor";
import { toast } from "sonner";

const EMOJI_SET = ["🚀", "✨", "🎯", "💡", "🔥", "📈", "💬", "🙌", "⚡", "🌟", "🎉", "❤️", "👀", "✅", "📌", "🎨"];

type LocationSuggestion = {
  id: string;
  name: string;
  formatted: string;
  city?: string;
  state?: string;
  country?: string;
  lat?: number;
  lon?: number;
  resultType?: string;
  nativeId?: string;
  source?: "meta" | "geoapify";
};

type InstagramPublishingLimit = {
  used: number;
  total: number;
  remaining: number;
  durationSeconds: number;
  accountId: string;
  handle: string;
};



const AI_TOOLS = [
  { id: "caption", label: "Generate caption", icon: Sparkles, desc: "Draft from a topic" },
  { id: "rewrite", label: "Rewrite", icon: RefreshCw, desc: "Fresh variation" },
  { id: "tone", label: "Change tone", icon: Type, desc: "Adjust voice" },
  { id: "hashtag", label: "Suggest hashtags", icon: Hash, desc: "Trending tags" },
  { id: "ideas", label: "Content ideas", icon: Lightbulb, desc: "Brainstorm topics" },
] as const;

/**
 * ComposerView — the heart of Loomic. Lets users draft a post once,
 * tailor it per platform, generate AI variations, attach media and either
 * schedule, publish or save as a draft.
 *
 * Publishing workflow:
 *   • Target selection is now account-based (specific handles), not
 *     platform-based. This lets you post the same content to two
 *     different Instagram accounts at once.
 *   • "Publish now" calls the server publishing endpoint after persistence;
 *     scheduled posts are handled by the dedicated server scheduler.
 */
export function ComposerView() {
  const {
    composerContent,
    composerMedia,
    composerScheduledAt,
    composerAccountIds,
    accounts,
    setComposerContent,
    setComposerMedia,
    setComposerScheduledAt,
    setComposerAccountIds,
    setActiveView,
    resetComposer,
    addPost,
    updatePost,
    posts,
    composerEditingId,
    accessToken,
    user,
  } = useSocialFlow();

  // Derive the list of platforms from selected accounts (backwards-compat
  // with the platform-based preview tabs).
  const composerPlatforms = Array.from(
    new Set(
      composerAccountIds
        .map((id) => accounts.find((a) => a.id === id)?.platform)
        .filter(Boolean) as PlatformId[]
    )
  );

  const [activePreview, setActivePreview] = useState<PlatformId>(composerPlatforms[0] ?? "linkedin");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showHashtags, setShowHashtags] = useState(false);
  const [hashtagSuggestions, setHashtagSuggestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [accountOverrides, setAccountOverrides] = useState<Record<string, string>>({});
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("10:00");
  const [instagramPostType, setInstagramPostType] = useState<InstagramPostType>("auto");
  const [instagramShareToFeed, setInstagramShareToFeed] = useState(true);
  const [instagramMusicTitle, setInstagramMusicTitle] = useState("");
  const [instagramMusicArtist, setInstagramMusicArtist] = useState("");
  const [instagramLocation, setInstagramLocation] = useState("");
  const [instagramLocationId, setInstagramLocationId] = useState("");
  const [instagramLocationSuggestions, setInstagramLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [instagramLocationLoading, setInstagramLocationLoading] = useState(false);
  const [instagramLocationSearchEnabled, setInstagramLocationSearchEnabled] = useState(false);
  const [instagramLocationSuggestionsOpen, setInstagramLocationSuggestionsOpen] = useState(false);
  const [instagramLocationSearchConfigured, setInstagramLocationSearchConfigured] = useState<boolean | null>(null);
  const [instagramTagInput, setInstagramTagInput] = useState("");
  const [instagramTaggedPeople, setInstagramTaggedPeople] = useState<string[]>([]);
  const [instagramCollaboratorInput, setInstagramCollaboratorInput] = useState("");
  const [instagramCollaborators, setInstagramCollaborators] = useState<string[]>([]);
  const [instagramFirstComment, setInstagramFirstComment] = useState("");
  const [instagramEffectsNotes, setInstagramEffectsNotes] = useState("");
  const [instagramPublishingLimits, setInstagramPublishingLimits] = useState<Record<string, InstagramPublishingLimit>>({});
  const [instagramLimitLoading, setInstagramLimitLoading] = useState<Record<string, boolean>>({});
  const [instagramLimitErrors, setInstagramLimitErrors] = useState<Record<string, string>>({});

  const hasInstagram = composerPlatforms.includes("instagram");
  const selectedInstagramAccounts = composerAccountIds
    .map((id) => accounts.find((account) => account.id === id))
    .filter((account): account is NonNullable<typeof account> => Boolean(account && account.platform === "instagram"));
  const enhancedInstagramAccount = selectedInstagramAccounts.find((account) => account.instagramConnectionMethod === "facebook_login");
  const hasEnhancedInstagram = Boolean(enhancedInstagramAccount);
  const nativeTaggingAvailable = selectedInstagramAccounts.some((account) => account.supportsNativeInstagramTags);
  const editingPost = composerEditingId ? posts.find((post) => post.id === composerEditingId) ?? null : null;

  // Per-account overrides live on PostTarget rows. Populate the local editor
  // when Queue/Calendar opens an existing draft or scheduled post.
  useEffect(() => {
    if (!editingPost) {
      setAccountOverrides({});
      if (composerEditingId) {
        setInstagramPostType("auto");
        setInstagramShareToFeed(true);
        setInstagramMusicTitle("");
        setInstagramMusicArtist("");
        setInstagramLocation("");
        setInstagramLocationId("");
        setInstagramLocationSuggestions([]);
        setInstagramLocationSearchEnabled(false);
        setInstagramLocationSuggestionsOpen(false);
        setInstagramTaggedPeople([]);
        setInstagramCollaborators([]);
        setInstagramFirstComment("");
        setInstagramEffectsNotes("");
      }
      return;
    }
    const overrides: Record<string, string> = {};
    for (const target of editingPost.targets) {
      if (target.content) overrides[target.accountId] = target.content;
    }
    setAccountOverrides(overrides);
    setInstagramPostType(editingPost.instagramOptions?.postType ?? "auto");
    setInstagramShareToFeed(editingPost.instagramOptions?.shareToFeed ?? true);
    const nativeFinish = editingPost.instagramOptions?.nativeFinish;
    setInstagramMusicTitle(nativeFinish?.musicTitle ?? "");
    setInstagramMusicArtist(nativeFinish?.musicArtist ?? "");
    setInstagramLocation(nativeFinish?.location ?? "");
    setInstagramLocationId(nativeFinish?.locationId ?? "");
    setInstagramLocationSuggestions([]);
    setInstagramLocationSearchEnabled(false);
    setInstagramLocationSuggestionsOpen(false);
    setInstagramTaggedPeople(nativeFinish?.taggedPeople ?? []);
    setInstagramCollaborators(nativeFinish?.collaborators ?? []);
    setInstagramFirstComment(nativeFinish?.firstComment ?? "");
    setInstagramEffectsNotes(nativeFinish?.effectsNotes ?? "");
  }, [composerEditingId, editingPost?.id]);

  // Instagram-style location autocomplete. Facebook-linked Instagram accounts
  // try Meta Pages Search first so a selected place can become a native
  // Instagram location header. If Meta search is unavailable (often until App
  // Review/Business Verification), Loomic falls back to the existing Geoapify
  // text-location suggestions without breaking publishing.
  useEffect(() => {
    const query = instagramLocation.trim();
    if (!hasInstagram || !instagramLocationSearchEnabled || query.length < 2) {
      setInstagramLocationLoading(false);
      if (query.length < 2) setInstagramLocationSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setInstagramLocationLoading(true);
      try {
        if (enhancedInstagramAccount) {
          try {
            const nativeRes = await authenticatedFetch(
              `/api/v1/instagram/locations/search?accountId=${encodeURIComponent(enhancedInstagramAccount.id)}&q=${encodeURIComponent(query)}`,
              { signal: controller.signal }
            );
            const nativeJson = await nativeRes.json();
            const nativeSuggestions = Array.isArray(nativeJson?.data?.suggestions) ? nativeJson.data.suggestions : [];
            if (nativeRes.ok && nativeSuggestions.length > 0) {
              setInstagramLocationSearchConfigured(true);
              setInstagramLocationSuggestions(nativeSuggestions);
              setInstagramLocationSuggestionsOpen(true);
              return;
            }
          } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") return;
          }
        }

        const res = await authenticatedFetch(
          `/api/v1/locations/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? "Location search failed");
        setInstagramLocationSearchConfigured(json?.data?.configured !== false);
        setInstagramLocationSuggestions(
          (Array.isArray(json?.data?.suggestions) ? json.data.suggestions : []).map((item: LocationSuggestion) => ({ ...item, source: "geoapify" as const }))
        );
        setInstagramLocationSuggestionsOpen(true);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.warn("[composer/location] autocomplete failed", error);
        setInstagramLocationSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setInstagramLocationLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [hasInstagram, instagramLocation, instagramLocationSearchEnabled, enhancedInstagramAccount?.id]);

  const loadInstagramPublishingLimit = async (accountId: string) => {
    setInstagramLimitLoading((current) => ({ ...current, [accountId]: true }));
    setInstagramLimitErrors((current) => ({ ...current, [accountId]: "" }));
    try {
      const res = await authenticatedFetch(`/api/v1/accounts/${accountId}/publishing-limit`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Unable to check Instagram publishing limit");
      const value = json.data as InstagramPublishingLimit;
      setInstagramPublishingLimits((current) => ({ ...current, [accountId]: value }));
      return value;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to check Instagram publishing limit";
      setInstagramLimitErrors((current) => ({ ...current, [accountId]: message }));
      return null;
    } finally {
      setInstagramLimitLoading((current) => ({ ...current, [accountId]: false }));
    }
  };

  useEffect(() => {
    const instagramAccountIds = composerAccountIds.filter(
      (id) => accounts.find((account) => account.id === id)?.platform === "instagram"
    );
    for (const accountId of instagramAccountIds) {
      if (!instagramPublishingLimits[accountId] && !instagramLimitLoading[accountId]) {
        void loadInstagramPublishingLimit(accountId);
      }
    }
  }, [composerAccountIds, accounts]);

  const charLimit = useMemo(() => {
    if (composerPlatforms.length === 0) return 280;
    return Math.min(...composerPlatforms.map((p) => PLATFORMS[p].charLimit));
  }, [composerPlatforms]);

  const charCount = composerContent.length;
  const charPct = (charCount / charLimit) * 100;
  const isOverLimit = charCount > charLimit;
  const inferredInstagramType = instagramPostType === "auto"
    ? composerMedia.length > 1
      ? "carousel"
      : composerMedia[0]?.type === "video"
        ? "reel"
        : "feed"
    : instagramPostType;

  const toggleAccount = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return;
    if (composerAccountIds.includes(accountId)) {
      const next = composerAccountIds.filter((id) => id !== accountId);
      setComposerAccountIds(next);
      // Update active preview if we removed the currently-previewed platform's only account
      const remainingPlatforms = Array.from(
        new Set(next.map((id) => accounts.find((a) => a.id === id)?.platform).filter(Boolean))
      ) as PlatformId[];
      if (remainingPlatforms.length > 0 && !remainingPlatforms.includes(activePreview)) {
        setActivePreview(remainingPlatforms[0]);
      }
    } else {
      const next = [...composerAccountIds, accountId];
      setComposerAccountIds(next);
      setActivePreview(account.platform);
    }
  };

  const insertAtCursor = (text: string) => {
    setComposerContent(composerContent ? `${composerContent} ${text}` : text);
  };

  const normalizeInstagramHandle = (value: string) => value.trim().replace(/^@+/, "").replace(/\s+/g, "");

  const addInstagramHandle = (kind: "tag" | "collaborator") => {
    const raw = kind === "tag" ? instagramTagInput : instagramCollaboratorInput;
    const handle = normalizeInstagramHandle(raw);
    if (!handle) return;
    const current = kind === "tag" ? instagramTaggedPeople : instagramCollaborators;
    if (current.some((item) => item.toLowerCase() === handle.toLowerCase())) {
      toast.info(`@${handle} is already added`);
      return;
    }
    if (kind === "tag") {
      setInstagramTaggedPeople([...current, handle]);
      setInstagramTagInput("");
    } else {
      setInstagramCollaborators([...current, handle]);
      setInstagramCollaboratorInput("");
    }
  };

  const clearInstagramFinishingTools = () => {
    setInstagramMusicTitle("");
    setInstagramMusicArtist("");
    setInstagramLocation("");
    setInstagramLocationId("");
    setInstagramTagInput("");
    setInstagramTaggedPeople([]);
    setInstagramCollaboratorInput("");
    setInstagramCollaborators([]);
    setInstagramFirstComment("");
    setInstagramEffectsNotes("");
  };

  const copyInstagramFinishChecklist = async () => {
    const lines = [
      instagramMusicTitle.trim() ? `Music: ${instagramMusicTitle.trim()}${instagramMusicArtist.trim() ? ` — ${instagramMusicArtist.trim()}` : ""}` : "",
      instagramLocation.trim() ? `Location: ${instagramLocation.trim()}` : "",
      instagramTaggedPeople.length ? `Tag people: ${instagramTaggedPeople.map((h) => `@${h}`).join(", ")}` : "",
      instagramCollaborators.length ? `Collaborators: ${instagramCollaborators.map((h) => `@${h}`).join(", ")}` : "",
      instagramFirstComment.trim() ? `First comment: ${instagramFirstComment.trim()}` : "",
      instagramEffectsNotes.trim() ? `Filters/effects/stickers: ${instagramEffectsNotes.trim()}` : "",
    ].filter(Boolean);
    if (!lines.length) {
      toast.info("Add at least one Instagram finishing detail first");
      return;
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Instagram finishing checklist copied");
    } catch {
      toast.error("Could not copy checklist");
    }
  };

  const runAiTool = async (toolId: string) => {
    if (toolId === "ideas") {
      setActiveView("ai-studio");
      toast.info("Opened AI Studio", { description: "Use Content ideas for a full brainstorming workflow." });
      return;
    }
    if (!composerContent.trim()) {
      toast.error("Write a topic or draft first");
      return;
    }

    setAiLoading(toolId);
    try {
      if (toolId === "hashtag") {
        const res = await authenticatedFetch("/api/v1/ai/hashtag", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            topic: composerContent.slice(0, 500),
            platform: composerPlatforms[0],
            count: 12,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "Hashtag generation failed");
        const tiers = json.data?.hashtags ?? {};
        const suggestions = [...(tiers.broad ?? []), ...(tiers.niche ?? []), ...(tiers.micro ?? [])];
        setHashtagSuggestions(suggestions);
        setShowHashtags(true);
        if (json.data?.provider === "local") {
          toast.info("Hashtag suggestions ready · Local Assist", { description: json.data?.warning ?? "Free Local Assist generated this without an external API call." });
        } else {
          toast.success("Hashtag suggestions ready · OpenAI");
        }
        return;
      }

      const prompt = toolId === "rewrite"
        ? `Rewrite this social media copy while preserving the meaning: ${composerContent}`
        : toolId === "tone"
          ? `Rewrite this social media copy in a bold, conversational tone: ${composerContent}`
          : composerContent;
      const res = await authenticatedFetch("/api/v1/ai/caption", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          topic: prompt.slice(0, 500),
          platform: composerPlatforms[0],
          tone: toolId === "tone" ? "bold" : "professional",
          length: "medium",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "AI generation failed");
      const first = json.data?.captions?.[0];
      if (!first) throw new Error("AI returned no caption");
      setComposerContent(first);
      const doneLabel = toolId === "caption" ? "Caption generated" : toolId === "rewrite" ? "Draft rewritten" : "Tone updated";
      if (json.data?.provider === "local") {
        toast.info(`${doneLabel} · Local Assist`, { description: json.data?.warning ?? "Free Local Assist generated this without an external API call." });
      } else {
        toast.success(`${doneLabel} · OpenAI`);
      }
    } catch (error) {
      toast.error("AI request failed", {
        description: error instanceof Error ? error.message : "Check the server-side AI provider configuration.",
      });
    } finally {
      setAiLoading(null);
    }
  };

  const handleAddMedia = (url: string, type: "image" | "video" = "image") => {
    if (composerMedia.length >= 10) {
      toast.error("Maximum 10 media items per shared post");
      return;
    }
    setComposerMedia([...composerMedia, { type, url, alt: "Attached media" }]);
  };

  const removeMedia = (idx: number) => {
    setComposerMedia(composerMedia.filter((_, i) => i !== idx));
  };

  const handleSchedule = () => {
    if (!scheduleDate) {
      toast.error("Pick a date first");
      return;
    }
    const iso = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    setComposerScheduledAt(iso);
    setScheduleOpen(false);
    toast.success(`Scheduled for ${new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`);
  };

  const handlePublish = async (status: "scheduled" | "draft" | "published") => {
    if (!composerContent.trim()) {
      const selectedAccounts = composerAccountIds.map((id) => accounts.find((a) => a.id === id)).filter(Boolean);
      const mediaOnlyInstagram = selectedAccounts.length > 0 && selectedAccounts.every((a) => a?.platform === "instagram") && composerMedia.length > 0;
      if (!mediaOnlyInstagram) {
        toast.error("Write something first", { description: "Instagram-only posts may be media-only; other channels need post text in this build." });
        return;
      }
    }
    if (composerAccountIds.length === 0) {
      toast.error("Select at least one account to publish to");
      return;
    }

    if (status !== "draft") {
      if (hasInstagram) {
        const mediaCount = composerMedia.length;
        const imageCount = composerMedia.filter((m) => m.type === "image").length;
        const videoCount = composerMedia.filter((m) => m.type === "video").length;
        if (instagramPostType === "feed" && (mediaCount !== 1 || imageCount !== 1)) {
          toast.error("Instagram Feed needs exactly one image", { description: "Choose Reel for video or Carousel for multiple media." });
          return;
        }
        if (instagramPostType === "reel" && (mediaCount !== 1 || videoCount !== 1)) {
          toast.error("Instagram Reel needs exactly one video");
          return;
        }
        if (instagramPostType === "story" && mediaCount !== 1) {
          toast.error("Instagram Story needs exactly one image or video");
          return;
        }
        if (instagramPostType === "carousel" && (mediaCount < 2 || mediaCount > 10)) {
          toast.error("Instagram Carousel needs 2–10 media items");
          return;
        }
      }
      for (const accountId of composerAccountIds) {
        const account = accounts.find((a) => a.id === accountId);
        if (!account) continue;
        const platform = PLATFORMS[account.platform];
        const name = `${platform.name} (${account.handle})`;
        const targetContent = accountOverrides[accountId]?.trim() || composerContent;
        if (targetContent.length > platform.charLimit) {
          toast.error(`${name} is over its character limit`, {
            description: `${targetContent.length}/${platform.charLimit} characters. Shorten the customized copy before publishing.`,
          });
          return;
        }
        const hasVideo = composerMedia.some((m) => m.type === "video");
        if (account.platform === "instagram" && composerMedia.length === 0) {
          toast.error(`${name} requires media`, { description: "Add an image or video, or remove Instagram from this publish." });
          return;
        }
        if (account.platform === "twitter" && composerMedia.length > 0) {
          toast.error(`${name} is text-only in this build`, { description: "X media upload is not enabled yet. Save as draft or remove media/X from this publish." });
          return;
        }
        if (account.platform === "linkedin" && (composerMedia.length > 1 || hasVideo)) {
          toast.error(`${name} supports text or one image in this build`);
          return;
        }
        if (account.platform === "facebook" && (composerMedia.length > 1 || hasVideo)) {
          toast.error(`${name} supports text/link or one image in this build`);
          return;
        }
        if (account.platform === "pinterest" && (composerMedia.length !== 1 || composerMedia[0]?.type !== "image")) {
          toast.error(`${name} requires exactly one image in this build`);
          return;
        }
      }
    }

    // Build per-account targets. Each target starts as "pending".
    // For Publish Now we persist a current timestamp; the store then calls
    // the authenticated server publishing endpoint immediately.
    const targets = composerAccountIds.map((accountId) => {
      const account = accounts.find((a) => a.id === accountId);
      const override = accountOverrides[accountId]?.trim();
      return {
        accountId,
        platform: account?.platform ?? ("linkedin" as PlatformId),
        content: override && override !== composerContent.trim() ? override : undefined,
        status: "pending" as const,
      };
    });

    const isPublishNow = status === "published";
    const scheduledAt =
      status === "scheduled"
        ? composerScheduledAt ?? undefined
        : isPublishNow
          ? new Date().toISOString() // server publishes immediately after the post is persisted
          : undefined;

    const post = {
      id: `post_${Date.now()}`,
      content: composerContent,
      platforms: composerPlatforms,
      status, // store converts Publish now into a server-side immediate publish
      scheduledAt,
      publishedAt: undefined,
      media: composerMedia.map((m, i) => ({ id: `m_${i}`, type: m.type, url: m.url, alt: m.alt })),
      hashtags: composerContent.match(/#\w+/g) ?? [],
      instagramOptions: hasInstagram
        ? {
            postType: instagramPostType,
            shareToFeed: instagramShareToFeed,
            nativeFinish: {
              musicTitle: instagramMusicTitle.trim() || undefined,
              musicArtist: instagramMusicArtist.trim() || undefined,
              location: instagramLocation.trim() || undefined,
              locationId: instagramLocationId.trim() || undefined,
              taggedPeople: instagramTaggedPeople.length ? instagramTaggedPeople : undefined,
              collaborators: instagramCollaborators.length ? instagramCollaborators : undefined,
              firstComment: instagramFirstComment.trim() || undefined,
              effectsNotes: instagramEffectsNotes.trim() || undefined,
            },
          }
        : undefined,
      author: {
        name: user?.name ?? "Maya Chen",
        initials: user?.initials ?? "MC",
        gradient: user?.gradient ?? "from-rose-500 to-orange-500",
      },
      targets,
    };
    let saved = false;
    if (composerEditingId) {
      try {
        await updatePost(composerEditingId, {
          content: post.content,
          status: post.status,
          scheduledAt: post.scheduledAt,
          media: post.media,
          hashtags: post.hashtags,
          instagramOptions: post.instagramOptions,
          targets: post.targets,
        });
        saved = true;
      } catch {
        saved = false;
      }
    } else {
      saved = await addPost(post);
    }
    if (!saved) {
      toast.error("Your draft is still in the composer", { description: "Fix the server error and try again; nothing was cleared." });
      return;
    }
    const wasEditing = Boolean(composerEditingId);
    resetComposer();
    setInstagramPostType("auto");
    setInstagramShareToFeed(true);
    clearInstagramFinishingTools();
    setAccountOverrides({});
    setCustomizeOpen(false);
    setActivePreview(composerPlatforms[0] ?? "linkedin");

    if (status === "published") {
      toast.success(wasEditing ? "Updated post is publishing…" : "Publishing now…", {
        description: `Going live on ${targets.length} account${targets.length === 1 ? "" : "s"}. Check the Queue for live status.`,
      });
    } else if (status === "scheduled") {
      toast.success(wasEditing ? "Scheduled post updated" : "Post scheduled", {
        description: `Will publish on ${new Date(scheduledAt!).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`,
      });
    } else {
      toast.success(wasEditing ? "Draft updated" : "Draft saved", {
        description: "Saved to your database — you can edit it any time.",
      });
    }
  };

  return (
    <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_400px] lg:p-8">
      {/* Left: editor */}
      <div className="space-y-4">
        {editingPost && (
          <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Editing saved post</div>
              <div className="text-xs text-muted-foreground">Changes will update this draft/scheduled post instead of creating a duplicate.</div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => { resetComposer(); setInstagramPostType("auto"); setInstagramShareToFeed(true); clearInstagramFinishingTools(); }}>Cancel edit</Button>
          </div>
        )}
        {/* Account selector — supports multiple accounts per platform */}
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Publish to
            </span>
            <span className="text-xs text-muted-foreground">
              {composerAccountIds.length} account{composerAccountIds.length === 1 ? "" : "s"} selected
            </span>
          </div>
          {accounts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No accounts connected yet.{" "}
              <button
                onClick={() => useSocialFlow.getState().setActiveView("accounts")}
                className="font-medium text-primary hover:underline"
              >
                Connect an account →
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {accounts.map((account) => {
                const p = PLATFORMS[account.platform];
                const Icon = p.icon;
                const active = composerAccountIds.includes(account.id);
                return (
                  <button
                    key={account.id}
                    onClick={() => toggleAccount(account.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                    title={account.handle}
                  >
                    <Icon className={cn("h-4 w-4", active ? p.color : "")} />
                    <span className="max-w-[120px] truncate">{account.handle}</span>
                    {active && <Check className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {composerAccountIds.some((id) => accounts.find((account) => account.id === id)?.platform === "instagram") && (
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Instagram publishing allowance</span>
              <span className="text-[10px] text-muted-foreground">Rolling 24 hours</span>
            </div>
            <div className="space-y-2">
              {composerAccountIds
                .map((id) => accounts.find((account) => account.id === id))
                .filter((account) => account?.platform === "instagram")
                .map((account) => {
                  if (!account) return null;
                  const limit = instagramPublishingLimits[account.id];
                  const loading = instagramLimitLoading[account.id];
                  const error = instagramLimitErrors[account.id];
                  const percentage = limit?.total ? Math.min(100, (limit.used / limit.total) * 100) : 0;
                  return (
                    <div key={`ig-limit-${account.id}`} className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 text-sm font-medium">{account.handle}</div>
                        {loading ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Checking…</span>
                        ) : limit ? (
                          <span className={cn("text-sm font-semibold", limit.remaining <= 0 ? "text-destructive" : limit.remaining <= 10 ? "text-amber-500" : "text-emerald-500")}>
                            {limit.used}/{limit.total}
                          </span>
                        ) : null}
                      </div>
                      {limit && (
                        <>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                            <div className="h-full bg-primary transition-all" style={{ width: `${percentage}%` }} />
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                            <span>{limit.remaining} publishing slot{limit.remaining === 1 ? "" : "s"} remaining</span>
                            <button type="button" className="text-primary hover:underline" onClick={() => void loadInstagramPublishingLimit(account.id)}>Refresh</button>
                          </div>
                          {limit.remaining <= 0 && (
                            <div className="mt-2 text-xs text-destructive">Instagram's API publishing limit is currently reached. Future schedules can still be saved, but publishing will wait until quota becomes available.</div>
                          )}
                        </>
                      )}
                      {!loading && error && (
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="truncate">Quota unavailable: {error}</span>
                          <button type="button" className="shrink-0 text-primary hover:underline" onClick={() => void loadInstagramPublishingLimit(account.id)}>Retry</button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Editor */}
        <div className="rounded-xl border border-border bg-card p-4">
          <Textarea
            placeholder="What do you want to share today? Start typing or let AI help…"
            value={composerContent}
            onChange={(e) => setComposerContent(e.target.value)}
            className="min-h-[180px] resize-none border-0 bg-transparent p-0 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
          />

          {/* Media thumbnails */}
          {composerMedia.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {composerMedia.map((m, i) => (
                <div key={i} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border">
                  {m.type === "video" ? (
                    <video src={m.url} muted playsInline className="h-full w-full object-cover" />
                  ) : (
                    <img src={m.url} alt={m.alt} className="h-full w-full object-cover" />
                  )}
                  <button
                    onClick={() => removeMedia(i)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Toolbar */}
          <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-3">
            <button
              onClick={() => document.getElementById("media-picker")?.click()}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Add image or video"
            >
              <ImageIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => document.getElementById("media-picker")?.click()}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Add image or video"
            >
              <Video className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowEmoji((v) => !v)}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Emoji"
            >
              <Smile className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowHashtags((v) => !v)}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Hashtag suggestions"
            >
              <Hash className="h-4 w-4" />
            </button>

            {/* Sample media picker (hidden) */}
            <input
              id="media-picker"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
              className="hidden"
              onChange={async (e) => {
                const input = e.currentTarget;
                const files = Array.from(input.files ?? []);
                if (files.length === 0) return;

                if (composerMedia.length + files.length > 10) {
                  toast.error("Maximum 10 media items", {
                    description: `You already have ${composerMedia.length}. Choose fewer files.`,
                  });
                  input.value = "";
                  return;
                }

                const uploaded: { type: "image" | "video"; url: string; alt: string }[] = [];

                for (const file of files) {
                  // Instagram API image compatibility. This check only applies
                  // when an Instagram account is actually selected. Stories use
                  // a different portrait format, so the feed ratio guard is not
                  // applied to explicit Story uploads.
                  if (hasInstagram && file.type.startsWith("image/") && instagramPostType !== "story") {
                    const objectUrl = URL.createObjectURL(file);
                    const img = new window.Image();
                    const validImage = await new Promise<boolean>((resolve) => {
                      img.onload = () => {
                        const width = img.naturalWidth;
                        const height = img.naturalHeight;
                        const ratio = width / height;
                        URL.revokeObjectURL(objectUrl);
                        const isValid = ratio >= 0.8 && ratio <= 1.91;
                        if (!isValid) {
                          toast.error("Instagram aspect ratio not supported", {
                            description:
                              `${file.name}: ${width} × ${height}. ` +
                              "Use 1080×1350 (4:5), 1080×1080 (1:1), or landscape up to 1.91:1.",
                          });
                        }
                        resolve(isValid);
                      };
                      img.onerror = () => {
                        URL.revokeObjectURL(objectUrl);
                        toast.error("Unable to read image", { description: file.name });
                        resolve(false);
                      };
                      img.src = objectUrl;
                    });
                    if (!validImage) continue;
                  }

                  const fileExtension = file.name.split(".").pop()?.toLowerCase() ?? "";
                  const isVideoFile = file.type.startsWith("video/") || fileExtension === "mp4" || fileExtension === "mov";

                  if (hasInstagram && instagramPostType === "reel" && !isVideoFile) {
                    toast.error("Reel requires a video", { description: `${file.name} was skipped.` });
                    continue;
                  }

                  try {
                    const isVideo = isVideoFile;
                    const maxReelBytes = 1024 * 1024 * 1024;
                    if (isVideo && file.size > maxReelBytes) {
                      throw new Error("Reel/video is larger than Instagram's 1 GB publishing limit.");
                    }

                    let res: Response;
                    if (isVideo) {
                      // Stream large MP4/MOV files to the server as a raw body.
                      // This avoids wrapping a large Reel in multipart FormData.
                      const videoType = file.type === "video/quicktime" || fileExtension === "mov" ? "video/quicktime" : "video/mp4";
                      res = await authenticatedFetch("/api/v1/upload", {
                        method: "POST",
                        headers: {
                          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                          "Content-Type": videoType,
                          "X-File-Name": encodeURIComponent(file.name),
                          "X-File-Size": String(file.size),
                        },
                        body: file,
                      });
                    } else {
                      const formData = new FormData();
                      formData.append("file", file);
                      res = await authenticatedFetch("/api/v1/upload", {
                        method: "POST",
                        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
                        body: formData,
                      });
                    }
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error?.message ?? "Upload failed");
                    uploaded.push({
                      type: isVideoFile ? "video" : "image",
                      url: json.data.url,
                      alt: file.name.replace(/\.[^.]+$/, "") || "Attached media",
                    });
                  } catch (error) {
                    toast.error(`Media upload failed: ${file.name}`, {
                      description: error instanceof Error ? error.message : "Unknown error",
                    });
                  }
                }

                if (uploaded.length > 0) {
                  setComposerMedia([...composerMedia, ...uploaded]);
                  toast.success(uploaded.length === 1 ? "Media uploaded" : `${uploaded.length} media items uploaded`);
                }
                input.value = "";
              }}
            />

            <div className="ml-auto text-[10px] text-muted-foreground">Images: JPG/PNG/WebP • Reels: MP4/MOV up to 1 GB</div>

            {/* Character counter */}
            <div className="flex w-full items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                {composerPlatforms.length === 0
                  ? "Select at least one platform"
                  : `Tightest limit: ${formatCompact(charLimit)} chars (${PLATFORMS[composerPlatforms.find((p) => PLATFORMS[p].charLimit === charLimit) ?? composerPlatforms[0]].name})`}
              </span>
              <div className="flex items-center gap-2">
                <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isOverLimit ? "bg-danger" : charPct > 80 ? "bg-warning" : "bg-success"
                    )}
                    style={{ width: `${Math.min(charPct, 100)}%` }}
                  />
                </div>
                <span className={cn("text-xs font-medium tabular-nums", isOverLimit ? "text-danger" : "text-muted-foreground")}>
                  {charCount}/{charLimit}
                </span>
              </div>
            </div>
          </div>

          {/* Emoji picker */}
          <AnimatePresence>
            {showEmoji && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 grid grid-cols-8 gap-1 rounded-lg border border-border bg-background p-2">
                  {EMOJI_SET.map((e) => (
                    <button
                      key={e}
                      onClick={() => insertAtCursor(e)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-muted"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hashtag suggestions */}
          <AnimatePresence>
            {showHashtags && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 flex flex-wrap gap-1.5 rounded-lg border border-border bg-background p-2">
                  {hashtagSuggestions.map((h) => (
                    <button
                      key={h}
                      onClick={() => insertAtCursor(h)}
                      className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Per-account copy overrides */}
        {composerAccountIds.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <button
              type="button"
              onClick={() => setCustomizeOpen((value) => !value)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div>
                <div className="text-sm font-semibold">Customize copy by account</div>
                <div className="text-xs text-muted-foreground">Keep the master caption or override it for individual channels.</div>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {Object.keys(accountOverrides).filter((id) => accountOverrides[id]?.trim()).length} customized
              </Badge>
            </button>

            <AnimatePresence>
              {customizeOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 space-y-3">
                    {composerAccountIds.map((accountId) => {
                      const account = accounts.find((item) => item.id === accountId);
                      if (!account) return null;
                      const platform = PLATFORMS[account.platform];
                      const Icon = platform.icon;
                      const value = accountOverrides[accountId] ?? "";
                      const effective = value.trim() || composerContent;
                      const over = effective.length > platform.charLimit;
                      return (
                        <div key={accountId} className="rounded-lg border border-border bg-background p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2 text-xs font-medium">
                              <Icon className={cn("h-4 w-4", platform.color)} />
                              <span className="truncate">{platform.name} · {account.handle}</span>
                            </div>
                            <span className={cn("text-[10px] tabular-nums", over ? "text-danger" : "text-muted-foreground")}>
                              {effective.length}/{platform.charLimit}
                            </span>
                          </div>
                          <Textarea
                            value={value}
                            onChange={(event) =>
                              setAccountOverrides((current) => ({ ...current, [accountId]: event.target.value }))
                            }
                            placeholder="Leave blank to use the master caption"
                            className="min-h-[90px] resize-y text-sm"
                          />
                          {value && (
                            <button
                              type="button"
                              onClick={() =>
                                setAccountOverrides((current) => {
                                  const next = { ...current };
                                  delete next[accountId];
                                  return next;
                                })
                              }
                              className="mt-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                            >
                              Use master caption instead
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* AI tools */}
        <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 via-card to-accent/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white">
              <Wand2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">AI Studio</div>
              <div className="text-xs text-muted-foreground">Generate, rewrite and refine in one click</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {AI_TOOLS.map((tool) => (
              <button
                key={tool.id}
                onClick={() => runAiTool(tool.id)}
                disabled={aiLoading !== null}
                className="group flex flex-col items-start gap-0.5 rounded-lg border border-border bg-card p-2.5 text-left transition-all hover:border-primary/40 hover:shadow-soft disabled:opacity-50"
              >
                <div className="flex items-center gap-1.5">
                  <tool.icon className="h-3.5 w-3.5 text-primary" />
                  {aiLoading === tool.id && (
                    <span className="h-3 w-3 animate-spin rounded-full border border-primary/30 border-t-primary" />
                  )}
                </div>
                <div className="text-xs font-medium">{tool.label}</div>
                <div className="text-[10px] text-muted-foreground">{tool.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Action bar */}
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/90 p-3 backdrop-blur-xl">
          <Button variant="outline" size="sm" onClick={() => handlePublish("draft")}>
            <Save className="mr-1.5 h-4 w-4" />
            Save draft
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setScheduleOpen((v) => !v)}
            className={cn(composerScheduledAt && "border-primary text-primary")}
          >
            <Calendar className="mr-1.5 h-4 w-4" />
            {composerScheduledAt
              ? new Date(composerScheduledAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
              : "Schedule"}
          </Button>

          {composerScheduledAt && (
            <Button size="sm" onClick={() => handlePublish("scheduled")} className="bg-gradient-to-r from-primary to-accent text-white">
              <Clock className="mr-1.5 h-4 w-4" />
              Schedule post
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => handlePublish("published")}
            className="ml-auto bg-gradient-to-r from-primary to-accent text-white shadow-glow"
          >
            <Send className="mr-1.5 h-4 w-4" />
            Publish now
          </Button>
        </div>

        {/* Schedule panel */}
        <AnimatePresence>
          {scheduleOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">Schedule post</span>
                <button onClick={() => setScheduleOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Date</label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Time</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </div>
              </div>
              {/* Best time suggestions */}
              <div className="mt-3">
                <div className="mb-1.5 text-xs text-muted-foreground">Quick time presets (not analytics-based)</div>
                <div className="flex flex-wrap gap-1.5">
                  {["Tue 9:00 AM", "Wed 1:00 PM", "Thu 6:00 PM", "Fri 11:00 AM"].map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        const [day, time] = t.split(" ");
                        const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
                        const d = new Date();
                        d.setDate(d.getDate() + ((map[day] - d.getDay() + 7) % 7 || 7));
                        setScheduleDate(d.toISOString().slice(0, 10));
                        setScheduleTime(time);
                      }}
                      className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={handleSchedule} className="mt-3 w-full bg-gradient-to-r from-primary to-accent text-white">
                Set schedule
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: live preview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Live preview</span>
          <Badge variant="secondary" className="text-[10px]">
            {composerPlatforms.length} platforms
          </Badge>
        </div>

        {/* Platform tabs */}
        <Tabs value={activePreview} onValueChange={(v) => setActivePreview(v as PlatformId)}>
          <TabsList className="flex w-full flex-wrap justify-start gap-1 bg-card">
            {composerPlatforms.map((pid) => {
              const p = PLATFORMS[pid];
              const Icon = p.icon;
              return (
                <TabsTrigger
                  key={pid}
                  value={pid}
                  className="flex items-center gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{p.name}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {composerPlatforms.map((pid) => (
            <TabsContent key={pid} value={pid} className="mt-3">
              <PlatformPreview
                platform={pid}
                content={
                  accountOverrides[composerAccountIds.find((id) => accounts.find((a) => a.id === id)?.platform === pid) ?? ""]?.trim() ||
                  composerContent
                }
                media={composerMedia}
                authorName={user?.name ?? "Maya Chen"}
                authorHandle={user?.email ?? "socialflow"}
                authorInitials={user?.initials ?? "MC"}
                authorGradient={user?.gradient ?? "from-rose-500 to-orange-500"}
              />
            </TabsContent>
          ))}
        </Tabs>

        {hasInstagram && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Instagram publishing</div>
                <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                  API-safe controls are published by Loomic. Instagram-only controls are shown below so the composer stays honest about Meta API limits.
                </div>
              </div>
              <Badge className="shrink-0 bg-gradient-to-r from-fuchsia-500 to-orange-500 text-[10px] text-white">Instagram</Badge>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium">Post type</label>
                <select
                  value={instagramPostType}
                  onChange={(e) => setInstagramPostType(e.target.value as InstagramPostType)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="auto">Auto detect</option>
                  <option value="feed">Feed photo</option>
                  <option value="reel">Reel</option>
                  <option value="story">Story</option>
                  <option value="carousel">Carousel</option>
                </select>
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {inferredInstagramType === "feed" && <ImageIcon className="h-3.5 w-3.5" />}
                  {inferredInstagramType === "reel" && <Film className="h-3.5 w-3.5" />}
                  {inferredInstagramType === "story" && <Smartphone className="h-3.5 w-3.5" />}
                  {inferredInstagramType === "carousel" && <Layers3 className="h-3.5 w-3.5" />}
                  Will publish as <span className="font-medium capitalize text-foreground">{inferredInstagramType}</span>
                </div>
              </div>

              {inferredInstagramType === "reel" && (
                <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
                  <div>
                    <div className="text-xs font-medium">Share Reel to Feed</div>
                    <div className="text-[10px] text-muted-foreground">Also show the Reel in the profile Feed.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={instagramShareToFeed}
                    onChange={(e) => setInstagramShareToFeed(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                </label>
              )}

              {inferredInstagramType === "reel" && (
                <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
                  <Music2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="text-[11px] leading-4">
                    <div className="font-medium">Reel audio</div>
                    <div className="text-muted-foreground">Audio already embedded in your MP4 is preserved. Instagram's licensed song library is not exposed through the publishing API.</div>
                  </div>
                </div>
              )}

              {inferredInstagramType === "story" && composerMedia.length === 1 && (
                <StoryEditor
                  media={composerMedia[0]}
                  onApplied={(url) => setComposerMedia(composerMedia.map((item, index) => index === 0 ? { ...item, url, type: "image" as const } : item))}
                />
              )}

              {composerMedia.some((m) => m.type === "image") && (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium">
                    <Accessibility className="h-3.5 w-3.5 text-primary" />
                    Accessibility text
                  </div>
                  <div className="space-y-2">
                    {composerMedia.map((media, index) => media.type === "image" ? (
                      <div key={`${media.url}-${index}`}>
                        <label className="mb-1 block text-[10px] text-muted-foreground">Image {index + 1} alt text</label>
                        <input
                          value={media.alt}
                          onChange={(e) => setComposerMedia(composerMedia.map((item, i) => i === index ? { ...item, alt: e.target.value } : item))}
                          maxLength={280}
                          placeholder="Describe this image for accessibility"
                          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary"
                        />
                      </div>
                    ) : null)}
                  </div>
                  <div className="mt-1.5 text-[10px] text-muted-foreground">Saved with the Loomic media record. The current Instagram Login publishing docs do not document an alt-text publish parameter.</div>
                </div>
              )}

              <div className="rounded-lg border border-success/25 bg-success/5 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-success">
                  <Check className="h-3.5 w-3.5" /> API-ready in Loomic
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px] text-muted-foreground">
                  <span>✓ Feed photo</span>
                  <span>✓ Reel</span>
                  <span>✓ Story</span>
                  <span>✓ Carousel</span>
                  <span>✓ Multi-account</span>
                  <span>✓ Scheduling</span>
                  <span>✓ Reel share-to-feed</span>
                  <span>✓ Media validation</span>
                  <span>✓ Caption @mentions</span>
                  <span>{hasEnhancedInstagram ? "✓ Facebook-linked mode" : "○ Enhanced Facebook mode"}</span>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <LockKeyhole className="h-3.5 w-3.5 text-muted-foreground" /> Instagram finishing tools
                  </div>
                  <Badge variant="secondary" className="h-5 px-2 text-[9px]">Saved with post</Badge>
                </div>
                <div className="space-y-3 rounded-lg border border-border bg-background p-3">
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium">
                      <Music2 className="h-3.5 w-3.5 text-primary" /> Songs / Instagram music
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input value={instagramMusicTitle} onChange={(e) => setInstagramMusicTitle(e.target.value)} maxLength={120} placeholder="Song title" className="h-9 rounded-lg border border-border bg-card px-3 text-xs outline-none focus:border-primary" />
                      <input value={instagramMusicArtist} onChange={(e) => setInstagramMusicArtist(e.target.value)} maxLength={120} placeholder="Artist (optional)" className="h-9 rounded-lg border border-border bg-card px-3 text-xs outline-none focus:border-primary" />
                    </div>
                    <div className="mt-1 text-[10px] leading-4 text-muted-foreground">Saved as a music cue. Add the licensed track in Instagram after publishing; Meta does not expose the Instagram music catalogue to this publishing API.</div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-medium">
                      <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary" /> Location</span>
                      {instagramLocationLoading && <span className="flex items-center gap-1 text-[10px] font-normal text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Searching…</span>}
                    </div>
                    <div className="relative">
                      <input
                        value={instagramLocation}
                        onChange={(e) => {
                          setInstagramLocation(e.target.value);
                          setInstagramLocationId("");
                          setInstagramLocationSearchEnabled(true);
                          setInstagramLocationSuggestionsOpen(true);
                        }}
                        onFocus={() => {
                          if (instagramLocation.trim().length >= 2) {
                            setInstagramLocationSearchEnabled(true);
                            setInstagramLocationSuggestionsOpen(true);
                          }
                        }}
                        onBlur={() => window.setTimeout(() => setInstagramLocationSuggestionsOpen(false), 140)}
                        maxLength={200}
                        autoComplete="off"
                        placeholder="Search a city, venue or place…"
                        className="h-9 w-full rounded-lg border border-border bg-card px-3 pr-9 text-xs outline-none focus:border-primary"
                      />
                      <MapPin className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />

                      {instagramLocationSuggestionsOpen && instagramLocation.trim().length >= 2 && (
                        <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-xl">
                          {instagramLocationLoading && instagramLocationSuggestions.length === 0 ? (
                            <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Finding locations…</div>
                          ) : instagramLocationSuggestions.length > 0 ? (
                            instagramLocationSuggestions.map((suggestion) => (
                              <button
                                key={suggestion.id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setInstagramLocation(suggestion.formatted || suggestion.name);
                                  setInstagramLocationId(suggestion.nativeId || "");
                                  setInstagramLocationSuggestions([]);
                                  setInstagramLocationSearchEnabled(false);
                                  setInstagramLocationSuggestionsOpen(false);
                                }}
                                className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
                              >
                                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                                <span className="min-w-0">
                                  <span className="block truncate text-xs font-medium text-foreground">{suggestion.name}</span>
                                  <span className="mt-0.5 block line-clamp-2 text-[10px] leading-4 text-muted-foreground">{suggestion.formatted}</span>
                                </span>
                              </button>
                            ))
                          ) : instagramLocationSearchConfigured === false ? (
                            <div className="px-3 py-3 text-[10px] leading-4 text-muted-foreground">
                              Live suggestions are ready in the UI but need a Geoapify API key. Add <code className="rounded bg-muted px-1 py-0.5">GEOAPIFY_API_KEY</code> to your <code className="rounded bg-muted px-1 py-0.5">.env</code> and restart Loomic.
                            </div>
                          ) : (
                            !instagramLocationLoading && <div className="px-3 py-3 text-xs text-muted-foreground">No matching locations found.</div>
                          )}
                          <div className="border-t border-border px-3 py-1.5 text-[9px] text-muted-foreground">{instagramLocationSuggestions.some((item) => item.source === "meta") ? "Native Instagram locations via Meta Pages Search." : "Fallback location suggestions by Geoapify."}</div>
                        </div>
                      )}
                    </div>
                    <div className="mt-1 text-[10px] leading-4 text-muted-foreground">{instagramLocationId ? <span className="font-medium text-success">✓ Native Instagram location selected. It will appear under the username on Facebook-linked Instagram publishing.</span> : hasEnhancedInstagram ? <>Search and choose a Meta place for the native Instagram location header. If Meta Pages Search is not approved for your app yet, Loomic falls back to <span className="font-medium">📍 Location</span> in the caption.</> : <>Current Instagram Login uses the visible <span className="font-medium">📍 Location</span> caption fallback. Connect through Facebook + linked Page to enable native location IDs.</>}</div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium"><UserPlus className="h-3.5 w-3.5 text-primary" /> Tag people</div>
                    <div className="flex gap-2">
                      <input value={instagramTagInput} onChange={(e) => setInstagramTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInstagramHandle("tag"); } }} placeholder="Instagram username" className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-xs outline-none focus:border-primary" />
                      <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => addInstagramHandle("tag")}>Add</Button>
                    </div>
                    {instagramTaggedPeople.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{instagramTaggedPeople.map((handle) => <button key={handle} type="button" onClick={() => setInstagramTaggedPeople(instagramTaggedPeople.filter((item) => item !== handle))} className="rounded-full border border-border bg-muted px-2 py-1 text-[10px] hover:border-destructive/50 hover:text-destructive">@{handle} ×</button>)}</div>}
                    <div className="mt-1 text-[10px] leading-4 text-muted-foreground">{nativeTaggingAvailable ? <span className="font-medium text-success">✓ Facebook-linked Instagram: Loomic sends these as native media tags for Feed images and the first image in a Carousel. Other connection types keep them as finishing instructions.</span> : <>Instagram Login does not expose native media tagging. Connect the Instagram account through Facebook + its linked Page to activate native tags.</>}</div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium"><Users className="h-3.5 w-3.5 text-primary" /> Invite collaborators</div>
                    <div className="flex gap-2">
                      <input value={instagramCollaboratorInput} onChange={(e) => setInstagramCollaboratorInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInstagramHandle("collaborator"); } }} placeholder="Instagram username" className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-xs outline-none focus:border-primary" />
                      <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => addInstagramHandle("collaborator")}>Add</Button>
                    </div>
                    {instagramCollaborators.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{instagramCollaborators.map((handle) => <button key={handle} type="button" onClick={() => setInstagramCollaborators(instagramCollaborators.filter((item) => item !== handle))} className="rounded-full border border-border bg-muted px-2 py-1 text-[10px] hover:border-destructive/50 hover:text-destructive">@{handle} ×</button>)}</div>}
                    <div className="mt-1 text-[10px] leading-4 text-muted-foreground">Saved as collaborator instructions for the Instagram finishing step.</div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium"><Captions className="h-3.5 w-3.5 text-primary" /> First comment</div>
                    <Textarea value={instagramFirstComment} onChange={(e) => setInstagramFirstComment(e.target.value)} maxLength={2200} placeholder="Write the first comment you want to add after publishing…" className="min-h-[72px] bg-card text-xs" />
                    <div className="mt-1 flex justify-between gap-3 text-[10px] text-muted-foreground"><span>Saved for the finishing step; current Instagram Login comment APIs support moderation/replies rather than creating a new root first comment.</span><span className="shrink-0">{instagramFirstComment.length}/2200</span></div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium"><Sparkles className="h-3.5 w-3.5 text-primary" /> Filters, effects & stickers</div>
                    <Textarea value={instagramEffectsNotes} onChange={(e) => setInstagramEffectsNotes(e.target.value)} maxLength={800} placeholder="e.g. Warm filter, link sticker, poll sticker, subtle sparkle effect…" className="min-h-[72px] bg-card text-xs" />
                    <div className="mt-1 text-[10px] leading-4 text-muted-foreground">Use this as a finishing checklist. Native Instagram filters/effects/stickers are not available through Content Publishing.</div>
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                    <Button type="button" variant="outline" size="sm" onClick={copyInstagramFinishChecklist}>Copy finishing checklist</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer")}>Open Instagram</Button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] leading-4 text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                Caption @mentions are published exactly as typed. Facebook-linked Instagram connections can use native location IDs and supported media tags. The Story editor bakes text, drawings, decorative stickers and visual @mentions into image Stories. Instagram-native Story Mention/Music/Poll/Link stickers and collaborator/root-comment finishing still require Instagram.
              </div>
            </div>
          </div>
        )}

        {composerPlatforms.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Select a platform above to see your preview.
          </div>
        )}
      </div>
    </div>
  );
}

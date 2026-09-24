"use client";

import { useState, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion } from "framer-motion";
import {
  Clock,
  CheckCircle2,
  FileEdit,
  AlertTriangle,
  Trash2,
  Copy,
  MoreHorizontal,
  Search,
  Filter,
  Loader2,
  RefreshCw,
  ExternalLink,
  Smartphone,
  Copy as CopyIcon,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSocialFlow } from "@/lib/store";
import { PLATFORMS } from "@/lib/platforms";
import { cn, formatCompact, formatDate, formatTime, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import type { PostStatus, TargetStatus } from "@/lib/mock-data";
import { retryFailedTargets } from "@/hooks/use-publish-worker";

const STATUS_FILTERS: { id: PostStatus | "all"; label: string; icon: typeof Clock }[] = [
  { id: "all", label: "All", icon: Filter },
  { id: "scheduled", label: "Scheduled", icon: Clock },
  { id: "publishing", label: "Processing", icon: Loader2 },
  { id: "published", label: "Published", icon: CheckCircle2 },
  { id: "draft", label: "Drafts", icon: FileEdit },
  { id: "handoff", label: "Finish in Instagram", icon: Smartphone },
  { id: "failed", label: "Failed", icon: AlertTriangle },
];

const STATUS_META: Record<PostStatus, { label: string; color: string; dot: string }> = {
  scheduled: { label: "Scheduled", color: "text-primary", dot: "bg-primary" },
  publishing: { label: "Processing", color: "text-warning", dot: "bg-warning animate-pulse" },
  published: { label: "Published", color: "text-success", dot: "bg-success" },
  draft: { label: "Draft", color: "text-muted-foreground", dot: "bg-muted-foreground" },
  failed: { label: "Failed", color: "text-danger", dot: "bg-danger" },
  handoff: { label: "Finish in Instagram", color: "text-warning", dot: "bg-warning" },
};

const TARGET_STATUS_META: Record<TargetStatus, { label: string; color: string; dot: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pending", color: "text-muted-foreground", dot: "bg-muted-foreground", icon: Clock },
  publishing: { label: "Processing", color: "text-warning", dot: "bg-warning animate-pulse", icon: Loader2 },
  published: { label: "Published", color: "text-success", dot: "bg-success", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-danger", dot: "bg-danger", icon: AlertTriangle },
  handoff: { label: "Finish in Instagram", color: "text-warning", dot: "bg-warning", icon: Smartphone },
};

/**
 * QueueView — a searchable, filterable list of every post in the
 * workspace. Shows per-account publish status (pending → publishing →
 * published/failed) so you can see exactly which channels succeeded
 * and retry the ones that failed.
 */
export function QueueView() {
  const {
    posts, deletePost, addPost, accounts, setActiveView, publishingPosts,
    setComposerContent, setComposerMedia, setComposerScheduledAt,
    setComposerAccountIds, setComposerEditingId,
  } = useSocialFlow();
  const [filter, setFilter] = useState<PostStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [createdBy, setCreatedBy] = useState("all");
  const [handoffPostId, setHandoffPostId] = useState<string | null>(null);
  const creators = useMemo(() => Array.from(new Set(posts.map((p) => p.author.name))).sort(), [posts]);

  const filtered = useMemo(() => {
    return posts
      .filter((p) => (filter === "all" ? true : p.status === filter))
      .filter((p) => createdBy === "all" || p.author.name === createdBy)
      .filter((p) =>
        query.trim() === ""
          ? true
          : p.content.toLowerCase().includes(query.toLowerCase()) ||
            p.hashtags.some((h) => h.toLowerCase().includes(query.toLowerCase()))
      )
      .sort((a, b) => {
        const ta = new Date(a.scheduledAt ?? a.publishedAt ?? 0).getTime();
        const tb = new Date(b.scheduledAt ?? b.publishedAt ?? 0).getTime();
        return tb - ta;
      });
  }, [posts, filter, query, createdBy]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: posts.length };
    for (const p of posts) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [posts]);

  const handleDuplicate = async (postId: string) => {
    const original = posts.find((p) => p.id === postId);
    if (!original) return;
    const dup = {
      ...original,
      id: `post_${Date.now()}`,
      status: "draft" as const,
      scheduledAt: undefined,
      publishedAt: undefined,
      targets: original.targets.map((t) => ({
        ...t,
        status: "pending" as const,
        externalId: undefined,
        externalUrl: undefined,
        errorMessage: undefined,
        publishedAt: undefined,
      })),
    };
    await addPost(dup);
    toast.success("Post duplicated to drafts", {
      description: "Edit the copy in the composer.",
    });
  };


  const handleEdit = (postId: string) => {
    const post = posts.find((item) => item.id === postId);
    if (!post) return;
    if (post.status === "published" || post.status === "publishing") {
      // Provider APIs generally do not support editing an already-published
      // cross-network post consistently. Open it as a new unsaved draft.
      setComposerContent(post.content);
      setComposerMedia(post.media.map((media) => ({ type: media.type, url: media.url, alt: media.alt })));
      setComposerScheduledAt(null);
      setComposerAccountIds(post.targets.map((target) => target.accountId));
      setComposerEditingId(null);
      setActiveView("composer");
      toast.info("Opened as a new draft", { description: "Publishing this copy will create a new post; the live post stays unchanged." });
      return;
    }
    setComposerContent(post.content);
    setComposerMedia(post.media.map((media) => ({ type: media.type, url: media.url, alt: media.alt })));
    setComposerScheduledAt(post.scheduledAt ?? null);
    setComposerAccountIds(post.targets.map((target) => target.accountId));
    setComposerEditingId(post.id);
    setActiveView("composer");
  };

  const handleDelete = async (postId: string) => {
    await deletePost(postId);
    toast.success("Post deleted", {
      description: "Removed from your database.",
    });
  };

  const handleRetry = async (postId: string) => {
    await retryFailedTargets(postId);
  };

  const handleInstagramHandoff = (postId: string) => {
    setHandoffPostId(postId);
  };

  const handoffPost = handoffPostId ? posts.find((item) => item.id === handoffPostId) ?? null : null;
  const handoffFinish = handoffPost?.instagramOptions?.nativeFinish;
  const handoffMedia = handoffPost?.media[0];
  const handoffUrl = typeof window !== "undefined" && handoffPost && handoffMedia
    ? `${window.location.origin}/instagram-handoff?media=${encodeURIComponent(handoffMedia.url)}&type=${encodeURIComponent(handoffMedia.type)}&mention=${encodeURIComponent(handoffFinish?.storyMention ?? "")}&link=${encodeURIComponent(handoffFinish?.storyLink ?? "")}`
    : "";

  const copyNativeValue = async (value: string, label: string) => {
    if (!value) return;
    await navigator.clipboard?.writeText(value);
    toast.success(`${label} copied`);
  };

  return (
    <div className="space-y-4 p-4 sm:p-6 lg:p-8">
      <Dialog open={Boolean(handoffPost)} onOpenChange={(open) => !open && setHandoffPostId(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[760px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Finish this Story in Instagram</DialogTitle>
            <DialogDescription>
              Instagram requires native Link and @Mention stickers to be added inside the Instagram app. Scan this QR code with your phone to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-w-0 gap-4 sm:gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col items-center gap-3 rounded-2xl border bg-white p-3 sm:p-4">
              {handoffUrl ? <div className="w-full max-w-[190px] [&>svg]:h-auto [&>svg]:w-full"><QRCodeSVG value={handoffUrl} size={180} level="M" includeMargin /></div> : null}
              <p className="text-center text-xs text-slate-600">Scan with your phone camera</p>
            </div>
            <div className="min-w-0 space-y-3 sm:space-y-4">
              <div className="rounded-xl border bg-muted/30 p-3 text-sm sm:p-4">
                <div className="font-semibold">On your phone</div>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                  <li>Open the QR link.</li>
                  <li>Save/open the prepared Story media.</li>
                  <li>Copy the Link or @Mention below.</li>
                  <li>Open Instagram, create a Story, select the media, then add Instagram's native sticker.</li>
                </ol>
              </div>
              {handoffFinish?.storyLink && (
                <div className="flex min-w-0 flex-col items-stretch gap-2 rounded-xl border p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1"><div className="text-xs text-muted-foreground">Link sticker</div><div className="truncate text-sm font-medium">{handoffFinish.storyLink}</div></div>
                  <Button size="sm" variant="outline" className="w-full shrink-0 sm:w-auto" onClick={() => copyNativeValue(handoffFinish.storyLink!, "Link")}><CopyIcon className="mr-1 h-4 w-4" />Copy</Button>
                </div>
              )}
              {handoffFinish?.storyMention && (
                <div className="flex min-w-0 flex-col items-stretch gap-2 rounded-xl border p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1"><div className="text-xs text-muted-foreground">Mention sticker</div><div className="truncate text-sm font-medium">{handoffFinish.storyMention}</div></div>
                  <Button size="sm" variant="outline" className="w-full shrink-0 sm:w-auto" onClick={() => copyNativeValue(handoffFinish.storyMention!, "Mention")}><CopyIcon className="mr-1 h-4 w-4" />Copy</Button>
                </div>
              )}
              {handoffMedia?.url && <Button asChild variant="outline" className="w-full"><a href={handoffMedia.url} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4 w-4" />Open Story media</a></Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {posts.length} post{posts.length === 1 ? "" : "s"} · {accounts.length} connected account{accounts.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button
          onClick={() => setActiveView("composer")}
          className="bg-gradient-to-r from-primary to-accent text-white shadow-glow"
        >
          Create post
        </Button>
      </motion.div>

      {/* Filters + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <f.icon className={cn("h-3 w-3", f.id === "publishing" && "animate-spin")} />
                {f.label}
                <span className={cn("rounded-full px-1 text-[10px]", active ? "bg-primary/20" : "bg-muted")}>
                  {counts[f.id] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
        <Select value={createdBy} onValueChange={setCreatedBy}>
          <SelectTrigger className="h-9 w-full sm:ml-auto sm:w-44"><SelectValue placeholder="Created by" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All creators</SelectItem>{creators.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
        </Select>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search posts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <FileEdit className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 text-sm font-medium">No posts found</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Try a different filter or create a new post.
            </p>
          </div>
        )}

        {filtered.map((post, i) => {
          const meta = STATUS_META[post.status];
          const targetDate = post.scheduledAt ?? post.publishedAt;
          const isPublishing = publishingPosts.includes(post.id);
          const hasFailures = post.targets.some((t) => t.status === "failed");
          const successCount = post.targets.filter((t) => t.status === "published").length;
          const failCount = post.targets.filter((t) => t.status === "failed").length;
          const handoffCount = post.targets.filter((t) => t.status === "handoff").length;

          return (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
              className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start gap-3">
                {/* Status indicator */}
                <div className="mt-1 flex flex-col items-center gap-1">
                  <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{post.content}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className={cn("gap-1", meta.color)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                      {meta.label}
                    </Badge>
                    {targetDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {post.status === "published"
                          ? `Published ${timeAgo(targetDate)}`
                          : post.status === "publishing"
                            ? "Processing / publishing…"
                            : `${formatDate(targetDate)} · ${formatTime(targetDate)}`}
                      </span>
                    )}
                    {post.clientName && <Badge variant="secondary" className="text-[10px]">{post.clientName}</Badge>}
                    <span>· Created by {post.author.name}</span>
                    {post.metrics && (
                      <span className="flex items-center gap-2">
                        <span className="flex items-center gap-0.5">
                          <span>👁</span> {formatCompact(post.metrics.reach)}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <span>❤️</span> {formatCompact(post.metrics.likes)}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <span>💬</span> {formatCompact(post.metrics.comments)}
                        </span>
                      </span>
                    )}
                  </div>
                  {post.hashtags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {post.hashtags.slice(0, 4).map((h) => (
                        <span key={h} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {h}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Per-account publish status */}
                  {post.targets.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {post.targets.map((target) => {
                        const account = accounts.find((a) => a.id === target.accountId);
                        const p = PLATFORMS[target.platform];
                        const Icon = p.icon;
                        const tMeta = TARGET_STATUS_META[target.status];
                        const TIcon = tMeta.icon;
                        return (
                          <span
                            key={target.accountId}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
                              target.status === "failed" ? "border-danger/30 bg-danger/10 text-danger" :
                              target.status === "handoff" ? "border-warning/30 bg-warning/10 text-warning" :
                              target.status === "publishing" ? "border-warning/30 bg-warning/10 text-warning" :
                              target.status === "published" ? "border-success/30 bg-success/10 text-success" :
                              "border-border bg-muted/40 text-muted-foreground"
                            )}
                            title={target.errorMessage || `${account?.handle ?? target.platform}: ${tMeta.label}`}
                          >
                            <Icon className="h-3 w-3" />
                            <span className="max-w-[100px] truncate">{account?.handle ?? p.name}</span>
                            <TIcon className={cn("h-3 w-3", target.status === "publishing" && "animate-spin")} />
                            {target.status === "published" && target.externalUrl && (
                              <a
                                href={target.externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-success/70 hover:text-success"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </span>
                        );
                      })}
                      {handoffCount > 0 && !isPublishing && (
                        <button
                          onClick={() => handleInstagramHandoff(post.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning transition-colors hover:bg-warning/20"
                        >
                          <Smartphone className="h-3 w-3" />
                          Finish in Instagram
                        </button>
                      )}
                      {hasFailures && !isPublishing && (
                        <button
                          onClick={() => handleRetry(post.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Retry failed ({failCount})
                        </button>
                      )}
                      {isPublishing && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-warning">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Processing on provider…
                        </span>
                      )}
                      {!isPublishing && post.status === "published" && failCount === 0 && successCount > 0 && (
                        <span className="text-[11px] text-success">
                          ✓ Live on {successCount} channel{successCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(post.id)}>
                      <FileEdit className="mr-2 h-4 w-4" />
                      {post.status === "published" || post.status === "publishing" ? "Edit as new draft" : "Edit"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicate(post.id)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate
                    </DropdownMenuItem>
                    {hasFailures && !isPublishing && (
                      <DropdownMenuItem onClick={() => handleRetry(post.id)}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry failed
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDelete(post.id)}
                      className="text-danger focus:text-danger"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

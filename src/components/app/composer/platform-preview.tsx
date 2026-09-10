"use client";

import { Heart, MessageCircle, Repeat2, Share, Bookmark, MoreHorizontal, Globe2 } from "lucide-react";
import { type PlatformId } from "@/lib/platforms";

interface PreviewProps {
  platform: PlatformId;
  content: string;
  media: { type: "image" | "video"; url: string; alt: string }[];
  authorName: string;
  authorHandle: string;
  authorInitials: string;
  authorGradient: string;
}

/**
 * PlatformPreview — renders an authentic-looking mock of how a post
 * will appear on the chosen platform. Each platform has its own layout
 * so users can spot truncation, hashtag clutter and media cropping
 * before they publish.
 */
export function PlatformPreview(props: PreviewProps) {
  switch (props.platform) {
    case "linkedin":
      return <LinkedInPreview {...props} />;
    case "twitter":
      return <XPreview {...props} />;
    case "facebook":
      return <FacebookPreview {...props} />;
    case "instagram":
      return <InstagramPreview {...props} />;
    case "threads":
      return <ThreadsPreview {...props} />;
    case "pinterest":
      return <PinterestPreview {...props} />;
    default:
      return null;
  }
}

/* ----------------------------- LinkedIn ----------------------------- */
function LinkedInPreview({ content, media, authorName, authorInitials, authorGradient }: PreviewProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${authorGradient} text-sm font-semibold text-white`}
        >
          {authorInitials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{authorName}</div>
          <div className="text-xs text-muted-foreground">Founder · 1st</div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Globe2 className="h-3 w-3" /> Public · now
          </div>
        </div>
        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
        {content || "Your post preview will appear here…"}
      </div>
      {media.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border border-border">
          {media.slice(0, 1).map((m, i) => (
            <PreviewMedia key={i} media={m} className="max-h-72 w-full object-cover" />
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
        <span>👍 42 · ❤️ 18 · 👏 7</span>
        <span>3 comments · 12 reposts</span>
      </div>
    </div>
  );
}

/* ----------------------------- X / Twitter ----------------------------- */
function XPreview({ content, media, authorName, authorInitials, authorGradient }: PreviewProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${authorGradient} text-xs font-semibold text-white`}
        >
          {authorInitials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm">
            <span className="font-semibold">{authorName}</span>
            <span className="text-muted-foreground">@socialflow · now</span>
          </div>
          <div className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
            {content || "Your post preview will appear here…"}
          </div>
          {media.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-xl border border-border">
              {media.slice(0, 1).map((m, i) => (
                <PreviewMedia key={i} media={m} className="max-h-72 w-full object-cover" />
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1 text-xs"><MessageCircle className="h-4 w-4" /> 12</span>
            <span className="flex items-center gap-1 text-xs"><Repeat2 className="h-4 w-4" /> 48</span>
            <span className="flex items-center gap-1 text-xs"><Heart className="h-4 w-4" /> 184</span>
            <span className="flex items-center gap-1 text-xs"><Bookmark className="h-4 w-4" /></span>
            <Share className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Facebook ----------------------------- */
function FacebookPreview({ content, media, authorName, authorInitials, authorGradient }: PreviewProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${authorGradient} text-xs font-semibold text-white`}
        >
          {authorInitials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{authorName}</div>
          <div className="text-xs text-muted-foreground">Just now · 🌐</div>
        </div>
        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
        {content || "Your post preview will appear here…"}
      </div>
      {media.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border border-border">
          {media.slice(0, 1).map((m, i) => (
            <PreviewMedia key={i} media={m} className="max-h-72 w-full object-cover" />
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between border-y border-border py-2 text-xs text-muted-foreground">
        <span>👍 124</span>
        <span>32 comments · 8 shares</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-2"><ThumbUp /> Like</span>
        <span className="flex items-center gap-2"><MessageCircle /> Comment</span>
        <span className="flex items-center gap-2"><Share /> Share</span>
      </div>
    </div>
  );
}

/* ----------------------------- Instagram ----------------------------- */
function InstagramPreview({ content, media, authorName, authorInitials, authorGradient }: PreviewProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-full bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888] p-[2px]">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-card text-xs font-semibold`}>
              {authorInitials}
            </div>
          </div>
          <span className="text-sm font-semibold">{authorName.toLowerCase().replace(/\s/g, "_")}</span>
        </div>
        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="aspect-square w-full bg-muted">
        {media.length > 0 ? (
          <PreviewMedia media={media[0]} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Add an image to preview
          </div>
        )}
      </div>
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <Heart className="h-5 w-5" />
          <MessageCircle className="h-5 w-5" />
          <Share className="h-5 w-5" />
        </div>
        <Bookmark className="h-5 w-5" />
      </div>
      <div className="px-3 pb-3 text-sm">
        <div className="font-semibold">2,184 likes</div>
        <div className="mt-1">
          <span className="font-semibold">{authorName.toLowerCase().replace(/\s/g, "_")}</span>{" "}
          <span className="text-foreground/90">{content || "Your caption will appear here…"}</span>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Threads ----------------------------- */
function ThreadsPreview({ content, media, authorName, authorInitials, authorGradient }: PreviewProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${authorGradient} text-xs font-semibold text-white`}
        >
          {authorInitials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">{authorName.toLowerCase().replace(/\s/g, "_")}</span>
            <span className="text-xs text-muted-foreground">2m</span>
          </div>
          <div className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
            {content || "Your post preview will appear here…"}
          </div>
          {media.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-xl border border-border">
              {media.slice(0, 1).map((m, i) => (
                <PreviewMedia key={i} media={m} className="max-h-72 w-full object-cover" />
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center gap-5 text-muted-foreground">
            <Heart className="h-4 w-4" />
            <MessageCircle className="h-4 w-4" />
            <Repeat2 className="h-4 w-4" />
            <Share className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Pinterest ----------------------------- */
function PinterestPreview({ content, media, authorName }: PreviewProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="overflow-hidden rounded-lg bg-muted">
        {media.length > 0 ? (
          <PreviewMedia media={media[0]} className="aspect-[3/4] w-full object-cover" />
        ) : (
          <div className="flex aspect-[3/4] items-center justify-center text-sm text-muted-foreground">
            Pinterest needs an image
          </div>
        )}
      </div>
      <div className="mt-2 text-sm font-medium leading-snug">{content || "Your pin description…"}</div>
      <div className="mt-1.5 text-xs text-muted-foreground">{authorName}</div>
    </div>
  );
}

function PreviewMedia({ media, className }: { media: PreviewProps["media"][number]; className: string }) {
  if (media.type === "video") {
    return <video src={media.url} muted controls playsInline className={className} />;
  }
  return <img src={media.url} alt={media.alt} className={className} />;
}

/* Tiny inline icon for Facebook Like to keep the file self-contained */
function ThumbUp(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L14 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  );
}

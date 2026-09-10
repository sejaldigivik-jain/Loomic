/**
 * Platform definitions for every social network SocialFlow integrates with.
 * Each platform carries its own brand color, gradient, character limit and
 * icon so the composer can render authentic previews per channel.
 */
import type { ComponentType, ComponentProps } from "react";
import {
  Linkedin,
  Twitter,
  Instagram,
  Facebook,
  AtSign,
} from "lucide-react";

export type PlatformId =
  | "linkedin"
  | "twitter"
  | "facebook"
  | "instagram"
  | "pinterest"
  | "threads";

export interface Platform {
  id: PlatformId;
  name: string;
  icon: ComponentType<ComponentProps<typeof AtSign>>;
  /** Tailwind text color class for the brand glyph */
  color: string;
  /** CSS gradient used for covers and avatars */
  gradient: string;
  /** Solid hex used in charts and badges */
  hex: string;
  /** Maximum characters allowed in a single post */
  charLimit: number;
  /** Whether this platform supports image carousels */
  supportsCarousel: boolean;
  /** Whether this platform supports video posts */
  supportsVideo: boolean;
  /** Default placeholder handle for previews */
  handle: string;
}

export const PLATFORMS: Record<PlatformId, Platform> = {
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    icon: Linkedin,
    color: "text-[#0a66c2]",
    gradient: "from-[#0a66c2] to-[#004182]",
    hex: "#0a66c2",
    charLimit: 3000,
    supportsCarousel: false,
    supportsVideo: false,
    handle: "socialflow",
  },
  twitter: {
    id: "twitter",
    name: "X (Twitter)",
    icon: Twitter,
    color: "text-foreground",
    gradient: "from-zinc-700 to-zinc-900",
    hex: "#6b7280",
    charLimit: 280,
    supportsCarousel: false,
    supportsVideo: false,
    handle: "socialflow",
  },
  facebook: {
    id: "facebook",
    name: "Facebook",
    icon: Facebook,
    color: "text-[#1877f2]",
    gradient: "from-[#1877f2] to-[#0a4fb5]",
    hex: "#1877f2",
    charLimit: 5000,
    supportsCarousel: false,
    supportsVideo: false,
    handle: "socialflowapp",
  },
  instagram: {
    id: "instagram",
    name: "Instagram",
    icon: Instagram,
    color: "text-[#e1306c]",
    gradient: "from-[#f09433] via-[#e6683c] to-[#dc2743]",
    hex: "#e1306c",
    charLimit: 2200,
    supportsCarousel: true,
    supportsVideo: true,
    handle: "socialflow",
  },
  pinterest: {
    id: "pinterest",
    name: "Pinterest",
    icon: AtSign,
    color: "text-[#e60023]",
    gradient: "from-[#e60023] to-[#ad0019]",
    hex: "#e60023",
    charLimit: 500,
    supportsCarousel: false,
    supportsVideo: false,
    handle: "socialflow",
  },
  threads: {
    id: "threads",
    name: "Threads",
    icon: AtsignFallback,
    color: "text-foreground",
    gradient: "from-zinc-800 to-black",
    hex: "#525252",
    charLimit: 500,
    supportsCarousel: true,
    supportsVideo: true,
    handle: "socialflow",
  },
};

/** Small inline fallback glyph used for Threads (no Lucide icon exists yet) */
function AtsignFallback(props: React.ComponentProps<typeof AtSign>) {
  return <AtSign {...props} />;
}

export const PLATFORM_LIST = Object.values(PLATFORMS);

/** Generate a deterministic avatar gradient from a handle string */
export function avatarGradient(seed: string): string {
  const gradients = [
    "from-indigo-500 to-violet-500",
    "from-rose-500 to-orange-500",
    "from-emerald-500 to-teal-500",
    "from-amber-500 to-pink-500",
    "from-sky-500 to-blue-600",
    "from-fuchsia-500 to-purple-600",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return gradients[Math.abs(hash) % gradients.length];
}

/**
 * Shared client-side shapes plus non-persistent preview/example constants.
 * Production user/workspace/post/account state is loaded from the API; this
 * module must not be treated as a persistence layer.
 */
import { type PlatformId } from "./platforms";

export type PostStatus = "draft" | "scheduled" | "publishing" | "published" | "failed" | "handoff";

/** Per-account publish state — a single Post fans out into N targets. */
export type TargetStatus = "pending" | "publishing" | "published" | "failed" | "handoff";

export type InstagramPostType = "auto" | "feed" | "reel" | "story" | "carousel";

export interface InstagramNativeFinishOptions {
  /** Instagram licensed-music reference saved for the manual finishing step. */
  musicTitle?: string;
  musicArtist?: string;
  /** Human-readable Instagram location shown in Loomic. */
  location?: string;
  /** Facebook Page ID for a native Instagram location tag when using Facebook Login. */
  locationId?: string;
  /** Native Story mention to add during Finish in Instagram. */
  storyMention?: string;
  /** Native Story Link sticker URL to add during Finish in Instagram. */
  storyLink?: string;
  /** Usernames to tag manually in Instagram after API publishing. */
  taggedPeople?: string[];
  /** Usernames to invite as collaborators manually in Instagram. */
  collaborators?: string[];
  /** First-comment copy saved with the post for the finishing workflow. */
  firstComment?: string;
  /** Notes for native filters, effects, stickers, polls, links, etc. */
  effectsNotes?: string;
}

export interface InstagramOptions {
  /** Auto = single image→feed, single video→reel, multiple media→carousel. */
  postType: InstagramPostType;
  /** Reels only: publish to both Feed and Reels tab when supported by Meta. */
  shareToFeed: boolean;
  /** Composer metadata for Instagram-native controls that Meta does not expose to this API login flow. */
  nativeFinish?: InstagramNativeFinishOptions;
}

export interface PostTarget {
  /** Database id of the per-channel target, when persisted. */
  id?: string;
  /** ID of the connected SocialAccount this post will publish to */
  accountId: string;
  platform: PlatformId;
  /** Optional per-target copy override. */
  content?: string;
  /** Per-target publish status — tracked independently so one failure
   *  doesn't block the other platforms. */
  status: TargetStatus;
  /** External post ID returned by the platform API (e.g. IG media id) */
  externalId?: string;
  /** Permalink on the platform, when available */
  externalUrl?: string;
  /** Error message if status === "failed" */
  errorMessage?: string;
  /** When the publish attempt completed */
  publishedAt?: string;
}

export interface Post {
  id: string;
  content: string;
  /** Backwards-compat: list of platforms targeted (derived from targets). */
  platforms: PlatformId[];
  status: PostStatus;
  /** ISO datetime string for scheduled posts */
  scheduledAt?: string;
  /** ISO datetime string for published posts */
  publishedAt?: string;
  media: PostMedia[];
  hashtags: string[];
  /** Optional agency client assignment. */
  clientId?: string;
  clientName?: string;
  /** Author of the post inside the workspace */
  author: {
    name: string;
    initials: string;
    gradient: string;
  };
  /** Instagram-specific publishing controls shared by Instagram targets. */
  instagramOptions?: InstagramOptions;
  /** Per-account publish targets — the source of truth for publish state. */
  targets: PostTarget[];
  /** Engagement metrics — only present on published posts */
  metrics?: {
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
  };
}

export interface PostMedia {
  id: string;
  type: "image" | "video";
  url: string;
  alt: string;
}

export interface SocialAccount {
  id: string;
  platform: PlatformId;
  handle: string;
  displayName: string;
  /** Optional avatar URL — falls back to gradient in UI */
  avatarUrl?: string;
  avatarGradient: string;
  followers: number;
  connectedAt: string;
  status: "connected" | "error" | "expired";
  /** OAuth token expiry — UI warns when this is near */
  tokenExpiresAt?: string;
  /** TRUE if this is a real OAuth-connected account (has provider credentials).
   *  FALSE if it is an explicitly enabled development-only demo account. */
  isReal?: boolean;
  /** The platform's numeric user ID (e.g. Instagram's IG business account ID).
   *  Required for real publishing — the Graph API needs this to create media containers. */
  externalUserId?: string;
  /** How this Instagram account is connected. */
  instagramConnectionMethod?: "instagram_login" | "facebook_login" | "meta_developer_token" | "unknown";
  /** Linked Facebook Page metadata for enhanced Instagram publishing. */
  instagramPageId?: string;
  instagramPageName?: string;
  supportsNativeInstagramTags?: boolean;
  supportsNativeInstagramLocation?: boolean;
  /** Agency client assignment. */
  clientId?: string;
  clientName?: string;
}

export interface TeamMember {
  id: string;
  userId?: string;
  assignedClients?: { id: string; name: string; status: string }[];
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Editor" | "Contributor" | "Viewer";
  initials: string;
  gradient: string;
  lastActive: string;
  status: "active" | "invited" | "suspended";
}

export interface ActivityItem {
  id: string;
  type: "publish" | "schedule" | "comment" | "connect" | "team" | "ai";
  message: string;
  actor: string;
  timestamp: string;
}

/* -------------------------------------------------------------------------- */
/*  Connected social accounts                                                 */
/* -------------------------------------------------------------------------- */

export const CONNECTED_ACCOUNTS: SocialAccount[] = [
  {
    id: "acc_1",
    platform: "instagram",
    handle: "@socialflow",
    displayName: "Loomic",
    avatarGradient: "from-[#f09433] via-[#e6683c] to-[#dc2743]",
    followers: 41200,
    connectedAt: "2025-01-15",
    status: "connected",
    tokenExpiresAt: "2025-12-15",
  },
  {
    id: "acc_2",
    platform: "instagram",
    handle: "@socialflow.personal",
    displayName: "Personal Brand",
    avatarGradient: "from-[#f09433] via-[#bc2a8d] to-[#6a3d72]",
    followers: 8640,
    connectedAt: "2025-04-08",
    status: "connected",
    tokenExpiresAt: "2025-12-15",
  },
  {
    id: "acc_3",
    platform: "linkedin",
    handle: "/socialflow",
    displayName: "Loomic",
    avatarGradient: "from-[#0a66c2] to-[#004182]",
    followers: 18420,
    connectedAt: "2025-03-12",
    status: "connected",
    tokenExpiresAt: "2025-11-30",
  },
  {
    id: "acc_4",
    platform: "twitter",
    handle: "@socialflow",
    displayName: "Loomic",
    avatarGradient: "from-zinc-700 to-zinc-900",
    followers: 28940,
    connectedAt: "2025-02-28",
    status: "connected",
    tokenExpiresAt: "2026-01-20",
  },
  {
    id: "acc_5",
    platform: "facebook",
    handle: "/socialflowapp",
    displayName: "Loomic App",
    avatarGradient: "from-[#1877f2] to-[#0a4fb5]",
    followers: 9650,
    connectedAt: "2025-04-02",
    status: "connected",
    tokenExpiresAt: "2025-12-01",
  },
  {
    id: "acc_6",
    platform: "threads",
    handle: "@socialflow",
    displayName: "Loomic",
    avatarGradient: "from-zinc-800 to-black",
    followers: 5240,
    connectedAt: "2025-05-20",
    status: "connected",
    tokenExpiresAt: "2026-02-10",
  },
  {
    id: "acc_7",
    platform: "pinterest",
    handle: "/socialflow",
    displayName: "Loomic",
    avatarGradient: "from-[#e60023] to-[#ad081b]",
    followers: 3120,
    connectedAt: "2025-06-05",
    status: "connected",
    tokenExpiresAt: "2026-01-05",
  },
];

/* -------------------------------------------------------------------------- */
/*  Posts — mix of published, scheduled and draft                             */
/* -------------------------------------------------------------------------- */

function daysFromNow(days: number, hour = 10, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function daysAgo(days: number, hour = 14, minute = 0): string {
  return daysFromNow(-days, hour, minute);
}

export const INITIAL_POSTS: Post[] = [
  {
    id: "post_1",
    content:
      "We just shipped AI-powered caption generation across every plan. Describe your post in one sentence and let Loomic draft the rest. Try it today.",
    platforms: ["linkedin", "twitter"],
    status: "published",
    publishedAt: daysAgo(2, 9, 30),
    media: [],
    hashtags: ["#AI", "#ProductUpdate", "#SocialMedia"],
    author: { name: "Maya Chen", initials: "MC", gradient: "from-rose-500 to-orange-500" },
    targets: [
      { accountId: "acc_3", platform: "linkedin", status: "published", externalId: "urn:li:activity:123", externalUrl: "https://linkedin.com", publishedAt: daysAgo(2, 9, 30) },
      { accountId: "acc_4", platform: "twitter", status: "published", externalId: "tw_123", externalUrl: "https://x.com", publishedAt: daysAgo(2, 9, 30) },
    ],
    metrics: { reach: 18420, likes: 642, comments: 38, shares: 91, clicks: 1240 },
  },
  {
    id: "post_2",
    content:
      "The best content calendar isn't a calendar. It's a system. Here's how we plan 30 days of content in under an hour.",
    platforms: ["instagram"],
    status: "published",
    publishedAt: daysAgo(5, 11, 0),
    media: [
      {
        id: "m1",
        type: "image",
        url: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80",
        alt: "Content planning workspace",
      },
    ],
    hashtags: ["#ContentStrategy", "#Marketing"],
    author: { name: "Diego Ramirez", initials: "DR", gradient: "from-emerald-500 to-teal-500" },
    targets: [
      { accountId: "acc_1", platform: "instagram", status: "published", externalId: "ig_media_123", externalUrl: "https://instagram.com", publishedAt: daysAgo(5, 11, 0) },
    ],
    metrics: { reach: 41200, likes: 2184, comments: 142, shares: 305, clicks: 890 },
  },
  {
    id: "post_3",
    content:
      "Reminder: consistency beats virality. A modest post shipped on schedule will outperform a perfect post that never leaves your drafts.",
    platforms: ["twitter", "threads"],
    status: "published",
    publishedAt: daysAgo(1, 16, 15),
    media: [],
    hashtags: ["#GrowthTips"],
    author: { name: "Maya Chen", initials: "MC", gradient: "from-rose-500 to-orange-500" },
    targets: [
      { accountId: "acc_4", platform: "twitter", status: "published", externalId: "tw_456", publishedAt: daysAgo(1, 16, 15) },
      { accountId: "acc_6", platform: "threads", status: "published", externalId: "th_456", publishedAt: daysAgo(1, 16, 15) },
    ],
    metrics: { reach: 9200, likes: 412, comments: 18, shares: 88, clicks: 220 },
  },
  {
    id: "post_4",
    content:
      "Behind every viral post is a workflow most people never see. Swipe to peek at ours — from idea capture to scheduled publish.",
    platforms: ["instagram", "facebook"],
    status: "scheduled",
    scheduledAt: daysFromNow(1, 9, 0),
    media: [
      {
        id: "m2",
        type: "image",
        url: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&q=80",
        alt: "Team working on content",
      },
    ],
    hashtags: ["#BehindTheScenes", "#Workflow"],
    author: { name: "Aisha Patel", initials: "AP", gradient: "from-sky-500 to-blue-600" },
    targets: [
      { accountId: "acc_1", platform: "instagram", status: "pending" },
      { accountId: "acc_2", platform: "instagram", status: "pending" },
      { accountId: "acc_5", platform: "facebook", status: "pending" },
    ],
  },
  {
    id: "post_5",
    content:
      "Q3 product roadmap update: native TikTok publishing, a brand-new analytics engine, and team approval workflows are all landing in the next 60 days.",
    platforms: ["linkedin"],
    status: "scheduled",
    scheduledAt: daysFromNow(2, 14, 0),
    media: [],
    hashtags: ["#Roadmap", "#ProductManagement"],
    author: { name: "Diego Ramirez", initials: "DR", gradient: "from-emerald-500 to-teal-500" },
    targets: [
      { accountId: "acc_3", platform: "linkedin", status: "pending" },
    ],
  },
  {
    id: "post_6",
    content:
      "Three signs your social strategy needs a reset: 1) Reach flat for 30+ days. 2) Saves > likes. 3) You can't name your top post last month. Fix all three with Loomic.",
    platforms: ["twitter"],
    status: "scheduled",
    scheduledAt: daysFromNow(3, 10, 30),
    media: [],
    hashtags: ["#SocialMediaTips"],
    author: { name: "Maya Chen", initials: "MC", gradient: "from-rose-500 to-orange-500" },
    targets: [
      { accountId: "acc_4", platform: "twitter", status: "pending" },
    ],
  },
  {
    id: "post_7",
    content:
      "Draft in progress — holiday campaign teaser. Need to finalize copy and add carousel images before scheduling.",
    platforms: ["instagram", "facebook", "threads"],
    status: "draft",
    media: [],
    hashtags: ["#HolidayCampaign"],
    author: { name: "Aisha Patel", initials: "AP", gradient: "from-sky-500 to-blue-600" },
    targets: [
      { accountId: "acc_1", platform: "instagram", status: "pending" },
      { accountId: "acc_5", platform: "facebook", status: "pending" },
      { accountId: "acc_6", platform: "threads", status: "pending" },
    ],
  },
  {
    id: "post_8",
    content:
      "Our analytics dashboard now segments reach by audience cohort. Stop looking at averages — start understanding who actually engages.",
    platforms: ["linkedin", "twitter"],
    status: "scheduled",
    scheduledAt: daysFromNow(4, 13, 0),
    media: [],
    hashtags: ["#Analytics", "#ProductUpdate"],
    author: { name: "Diego Ramirez", initials: "DR", gradient: "from-emerald-500 to-teal-500" },
    targets: [
      { accountId: "acc_3", platform: "linkedin", status: "pending" },
      { accountId: "acc_4", platform: "twitter", status: "pending" },
    ],
  },
  {
    id: "post_9",
    content:
      "Friday roundup: 5 posts that taught us something about audience retention this week. Thread incoming.",
    platforms: ["threads"],
    status: "scheduled",
    scheduledAt: daysFromNow(5, 17, 0),
    media: [],
    hashtags: ["#FridayRoundup"],
    author: { name: "Maya Chen", initials: "MC", gradient: "from-rose-500 to-orange-500" },
    targets: [
      { accountId: "acc_6", platform: "threads", status: "pending" },
    ],
  },
  {
    id: "post_10",
    content:
      "We analyzed 10,000 scheduled posts. The optimal posting window for B2B is Tuesday–Thursday, 9–11am. Save this. Thank us later.",
    platforms: ["linkedin"],
    status: "published",
    publishedAt: daysAgo(8, 10, 0),
    media: [],
    hashtags: ["#DataDriven", "#B2BMarketing"],
    author: { name: "Diego Ramirez", initials: "DR", gradient: "from-emerald-500 to-teal-500" },
    targets: [
      { accountId: "acc_3", platform: "linkedin", status: "published", externalId: "urn:li:activity:789", publishedAt: daysAgo(8, 10, 0) },
    ],
    metrics: { reach: 24800, likes: 1184, comments: 76, shares: 412, clicks: 2100 },
  },
];

/* -------------------------------------------------------------------------- */
/*  Analytics time-series                                                      */
/* -------------------------------------------------------------------------- */

export interface AnalyticsPoint {
  date: string;
  followers: number;
  reach: number;
  engagement: number;
  clicks: number;
}

/** Generate 30 days of synthetic but believable analytics data */
export function generateAnalyticsSeries(days = 30): AnalyticsPoint[] {
  const out: AnalyticsPoint[] = [];
  let followers = 95000;
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    followers += Math.round(120 + Math.sin(i / 2) * 80 + Math.random() * 200);
    out.push({
      date: d.toISOString().slice(0, 10),
      followers,
      reach: Math.round(8000 + Math.sin(i / 3) * 3000 + Math.random() * 4000),
      engagement: Math.round(2200 + Math.cos(i / 2) * 600 + Math.random() * 800),
      clicks: Math.round(1400 + Math.sin(i / 4) * 400 + Math.random() * 500),
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Platform breakdown for analytics                                           */
/* -------------------------------------------------------------------------- */

export interface PlatformBreakdown {
  platform: PlatformId;
  followers: number;
  engagement: number;
  reach: number;
}

export const PLATFORM_BREAKDOWN: PlatformBreakdown[] = [
  { platform: "instagram", followers: 41200, engagement: 4.8, reach: 184000 },
  { platform: "twitter", followers: 28940, engagement: 3.2, reach: 142000 },
  { platform: "linkedin", followers: 18420, engagement: 6.1, reach: 98000 },
  { platform: "facebook", followers: 9650, engagement: 2.4, reach: 41000 },
  { platform: "threads", followers: 5240, engagement: 5.5, reach: 22000 },
];

/* -------------------------------------------------------------------------- */
/*  Team members                                                               */
/* -------------------------------------------------------------------------- */

export const TEAM_MEMBERS: TeamMember[] = [
  {
    id: "tm_1",
    name: "Maya Chen",
    email: "maya@socialflow.io",
    role: "Owner",
    initials: "MC",
    gradient: "from-rose-500 to-orange-500",
    lastActive: "Active now",
    status: "active",
  },
  {
    id: "tm_2",
    name: "Diego Ramirez",
    email: "diego@socialflow.io",
    role: "Admin",
    initials: "DR",
    gradient: "from-emerald-500 to-teal-500",
    lastActive: "2 hours ago",
    status: "active",
  },
  {
    id: "tm_3",
    name: "Aisha Patel",
    email: "aisha@socialflow.io",
    role: "Editor",
    initials: "AP",
    gradient: "from-sky-500 to-blue-600",
    lastActive: "Yesterday",
    status: "active",
  },
  {
    id: "tm_4",
    name: "Noah Williams",
    email: "noah@socialflow.io",
    role: "Contributor",
    initials: "NW",
    gradient: "from-amber-500 to-pink-500",
    lastActive: "3 days ago",
    status: "active",
  },
  {
    id: "tm_5",
    name: "Sofia Lindqvist",
    email: "sofia@socialflow.io",
    role: "Viewer",
    initials: "SL",
    gradient: "from-fuchsia-500 to-purple-600",
    lastActive: "—",
    status: "invited",
  },
];

/* -------------------------------------------------------------------------- */
/*  Activity feed                                                              */
/* -------------------------------------------------------------------------- */

export const ACTIVITY_FEED: ActivityItem[] = [
  {
    id: "a1",
    type: "publish",
    message: "published “Reminder: consistency beats virality” to X and Threads",
    actor: "Maya Chen",
    timestamp: daysAgo(1, 16, 15),
  },
  {
    id: "a2",
    type: "ai",
    message: "generated 3 caption variations for the holiday campaign",
    actor: "Aisha Patel",
    timestamp: daysAgo(1, 13, 40),
  },
  {
    id: "a3",
    type: "schedule",
    message: "scheduled “Q3 product roadmap update” for LinkedIn",
    actor: "Diego Ramirez",
    timestamp: daysAgo(1, 11, 20),
  },
  {
    id: "a4",
    type: "comment",
    message: "left a comment on “Behind every viral post” draft",
    actor: "Noah Williams",
    timestamp: daysAgo(2, 9, 5),
  },
  {
    id: "a5",
    type: "connect",
    message: "connected a new Threads account to the workspace",
    actor: "Maya Chen",
    timestamp: daysAgo(3, 15, 0),
  },
  {
    id: "a6",
    type: "team",
    message: "invited Sofia Lindqvist to the workspace as Viewer",
    actor: "Maya Chen",
    timestamp: daysAgo(4, 10, 30),
  },
];

/* -------------------------------------------------------------------------- */
/*  Content ideas for AI Studio                                                */
/* -------------------------------------------------------------------------- */

export const CONTENT_IDEAS: string[] = [
  "A behind-the-scenes carousel showing how your team plans a week of content",
  "A data-driven post: “We analyzed 10,000 posts — here's what we learned”",
  "A myth-busting thread challenging a common belief in your industry",
  "A customer spotlight featuring a real result with specific numbers",
  "A tools-we-use Tuesday post covering your actual daily stack",
  "A “what I wish I knew 12 months ago” reflection post",
  "A prediction post about where your industry is heading next year",
  "A step-by-step tutorial solving one specific problem your audience has",
];

export const TONE_OPTIONS = [
  "Professional",
  "Casual",
  "Witty",
  "Inspirational",
  "Bold",
  "Educational",
  "Empathetic",
  "Persuasive",
] as const;

export type Tone = (typeof TONE_OPTIONS)[number];

/* -------------------------------------------------------------------------- */
/*  Pricing plans                                                              */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Feature list for landing page                                              */
/* -------------------------------------------------------------------------- */

export interface Feature {
  icon: string; // lucide icon name resolved in component
  title: string;
  description: string;
}

export const FEATURES: Feature[] = [
  {
    icon: "CalendarClock",
    title: "Plan once, tailor per channel",
    description:
      "Draft in one workspace, customize copy and media for each connected account, then schedule server-side or publish immediately.",
  },
  {
    icon: "Sparkles",
    title: "AI Studio built in",
    description:
      "Generate captions, rewrite for tone, suggest hashtags and brainstorm content ideas with an AI assistant trained on what actually performs.",
  },
  {
    icon: "BarChart3",
    title: "Analytics from stored performance data",
    description:
      "Review published-post performance in one dashboard. Instagram metrics can be synced directly and the data model is ready for additional provider adapters.",
  },
  {
    icon: "Users",
    title: "Built for teams",
    description:
      "Approval workflows, comments, roles and permissions. Keep freelancers productive and stakeholders informed without messy threads.",
  },
  {
    icon: "LayoutGrid",
    title: "A calendar you'll actually use",
    description:
      "Drag-and-drop scheduling across monthly, weekly and daily views. See your whole content universe at a glance.",
  },
  {
    icon: "ShieldCheck",
    title: "Production-focused security",
    description:
      "JWT sessions, refresh-token rotation, role-based workspace access, encrypted provider tokens and audit trails are built into the deployment path.",
  },
];

export interface Testimonial {
  quote: string;
  author: string;
  role: string;
  initials: string;
  gradient: string;
}

/* -------------------------------------------------------------------------- */
/*  Team: approval workflow requests                                          */
/* -------------------------------------------------------------------------- */

export interface ApprovalRequest {
  id: string;
  postContent: string;
  author: { name: string; initials: string; gradient: string };
  platforms: PlatformId[];
  requestedAt: string;
  status: "pending" | "approved" | "rejected" | "changes_requested";
  dueBy: string;
  commentCount: number;
}

export const APPROVAL_REQUESTS: ApprovalRequest[] = [
  {
    id: "ap_1",
    postContent:
      "Q4 holiday campaign launch announcement — carousel with 5 product shots and a 20% off promo code for the first 500 customers.",
    author: { name: "Aisha Patel", initials: "AP", gradient: "from-sky-500 to-blue-600" },
    platforms: ["instagram", "facebook"],
    requestedAt: daysAgo(0, 9, 15),
    status: "pending",
    dueBy: daysFromNow(1, 17, 0),
    commentCount: 2,
  },
  {
    id: "ap_2",
    postContent:
      "Customer success story with Northwind Labs — how they 3x'd their engagement in 90 days using Loomic's AI Studio.",
    author: { name: "Diego Ramirez", initials: "DR", gradient: "from-emerald-500 to-teal-500" },
    platforms: ["linkedin"],
    requestedAt: daysAgo(1, 14, 0),
    status: "changes_requested",
    dueBy: daysFromNow(2, 12, 0),
    commentCount: 4,
  },
  {
    id: "ap_3",
    postContent:
      "Behind-the-scenes thread on our design process for the new composer UI — 8 posts, includes video clips.",
    author: { name: "Noah Williams", initials: "NW", gradient: "from-amber-500 to-pink-500" },
    platforms: ["threads", "twitter"],
    requestedAt: daysAgo(2, 11, 30),
    status: "pending",
    dueBy: daysFromNow(3, 10, 0),
    commentCount: 0,
  },
  {
    id: "ap_4",
    postContent:
      "Weekly metrics recap: we hit 100K total followers across all channels. Thank you GIF + mini-infographic.",
    author: { name: "Aisha Patel", initials: "AP", gradient: "from-sky-500 to-blue-600" },
    platforms: ["instagram", "linkedin", "twitter"],
    requestedAt: daysAgo(3, 16, 0),
    status: "approved",
    dueBy: daysAgo(0, 12, 0),
    commentCount: 1,
  },
];

/* -------------------------------------------------------------------------- */
/*  Billing: invoices, usage, payment methods                                 */
/* -------------------------------------------------------------------------- */

export interface Invoice {
  id: string;
  number: string;
  date: string;
  amount: number;
  status: "paid" | "open" | "void" | "refunded";
  period: string;
  pdfUrl: string;
}

export const INVOICES: Invoice[] = [
  { id: "inv_1", number: "INV-2025-0048", date: daysAgo(2, 0, 0), amount: 49, status: "paid", period: "Jul 2025", pdfUrl: "#" },
  { id: "inv_2", number: "INV-2025-0041", date: daysAgo(32, 0, 0), amount: 49, status: "paid", period: "Jun 2025", pdfUrl: "#" },
  { id: "inv_3", number: "INV-2025-0033", date: daysAgo(62, 0, 0), amount: 49, status: "paid", period: "May 2025", pdfUrl: "#" },
  { id: "inv_4", number: "INV-2025-0024", date: daysAgo(92, 0, 0), amount: 18, status: "paid", period: "Apr 2025", pdfUrl: "#" },
  { id: "inv_5", number: "INV-2025-0018", date: daysAgo(122, 0, 0), amount: 18, status: "paid", period: "Mar 2025", pdfUrl: "#" },
  { id: "inv_6", number: "INV-2025-0007", date: daysAgo(152, 0, 0), amount: 18, status: "refunded", period: "Feb 2025", pdfUrl: "#" },
];

export interface PaymentMethod {
  id: string;
  brand: "visa" | "mastercard" | "amex";
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  { id: "pm_1", brand: "visa", last4: "4242", expiryMonth: 11, expiryYear: 2027, isDefault: true },
  { id: "pm_2", brand: "mastercard", last4: "8888", expiryMonth: 3, expiryYear: 2026, isDefault: false },
];

export interface UsageStat {
  label: string;
  used: number;
  limit: number;
  unit: string;
  resetsAt: string;
}

export const USAGE_STATS: UsageStat[] = [
  { label: "Scheduled posts", used: 142, limit: -1, unit: "posts", resetsAt: "Never" },
  { label: "AI credits", used: 67, limit: 100, unit: "credits", resetsAt: "Aug 1, 2025" },
  { label: "Connected channels", used: 5, limit: 8, unit: "channels", resetsAt: "Never" },
  { label: "Team members", used: 5, limit: 10, unit: "seats", resetsAt: "Never" },
  { label: "Storage", used: 2.4, limit: 50, unit: "GB", resetsAt: "Never" },
];

/**
 * Loomic global store — API-backed persistence edition.
 *
 * All state (auth/user, posts, connected accounts, composer draft) is
 * persisted to the backend database via the REST API under /api/v1/.
 * A short-lived access token (JWT) is kept in localStorage so the user
 * stays logged in across page refreshes.
 *
 * On mount we call restoreSession() which:
 *   1. Reads the JWT from localStorage
 *   2. Calls /api/v1/auth/me to validate it
 *   3. Loads the user's posts and accounts from the API
 *
 * Every mutation (addPost, updatePost, deletePost, connectAccount,
 * disconnectAccount, updateProfile) calls the API first; on success it
 * updates the local state so the UI reflects the change immediately.
 */
"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { toast } from "sonner";
import {
  type Post,
  type SocialAccount,
  type PostTarget,
  type PostStatus,
} from "@/lib/mock-data";
import type { PlatformId } from "@/lib/platforms";

export type AppView =
  | "dashboard"
  | "composer"
  | "calendar"
  | "queue"
  | "analytics"
  | "ai-studio"
  | "accounts"
  | "team"
  | "settings";

export type AuthMode = "login" | "signup" | "forgot" | "reset" | null;

interface SocialFlowUser {
  id?: string;
  name: string;
  email: string;
  initials: string;
  gradient: string;
  image?: string | null;
  bio?: string;
  theme?: string;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export interface AgencyMemberSummary {
  userId: string;
  name: string;
  email: string;
  role: string;
}

export interface AgencyClientSummary {
  id: string;
  name: string;
  status: string;
  members: { userId: string; name?: string | null; email: string }[];
  accounts: { id: string; platform: string; handle: string }[];
  postCount: number;
}

interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: string;
  isActive: boolean;
}

const DEFAULT_GRADIENT = "from-rose-500 to-orange-500";

function buildInitials(email: string, name?: string): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

/**
 * Derive a post's overall status from its targets.
 */
export function derivePostStatus(post: Post): PostStatus {
  if (post.targets.length === 0) {
    if (post.status === "draft") return "draft";
    return post.scheduledAt ? "scheduled" : "draft";
  }
  const statuses = post.targets.map((t) => t.status);
  const allPublished = statuses.every((s) => s === "published");
  const anyPublishing = statuses.some((s) => s === "publishing");
  const anyFailed = statuses.some((s) => s === "failed");
  const anyPublished = statuses.some((s) => s === "published");
  const anyHandoff = statuses.some((s) => s === "handoff");

  if (allPublished) return "published";
  if (anyPublishing) return "publishing";
  if (anyPublished && (anyFailed || anyHandoff)) return "published"; // partial success
  if (anyHandoff && !anyPublished && !anyFailed) return "handoff";
  if (anyFailed && !anyPublished) return "failed";
  return post.scheduledAt ? "scheduled" : "draft";
}

/* -------------------------------------------------------------------------- */
/*  API helpers                                                                */
/* -------------------------------------------------------------------------- */

const TOKEN_KEY = "socialflow_access_token";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function setAccessToken(access: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, access);
}

function clearTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (!res.ok || !json.data?.accessToken) return null;
    setAccessToken(json.data.accessToken);
    return json.data.accessToken;
  } catch {
    return null;
  }
}

/**
 * Fetch an authenticated Loomic API route and transparently refresh the
 * short-lived access token once when it expires. Components should use this
 * helper instead of calling fetch() directly for signed-in API requests.
 */
export async function authenticatedFetch(
  path: string,
  options: RequestInit = {},
  retryAuth = true
): Promise<Response> {
  const headers = new Headers(options.headers ?? {});
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res = await fetch(path, { ...options, headers });
  if (res.status === 401 && retryAuth && path !== "/api/v1/auth/refresh") {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      headers.set("Authorization", `Bearer ${nextToken}`);
      res = await fetch(path, { ...options, headers });
    }
  }
  return res;
}

async function apiCall<T = any>(
  path: string,
  options: RequestInit = {},
  retryAuth = true
): Promise<{ data: T; meta?: any }> {
  const headers = new Headers(options.headers ?? {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await authenticatedFetch(path, { ...options, headers }, retryAuth);
  const json = await res.json();
  if (!res.ok) {
    const msg =
      json?.error?.message ?? json?.message ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

/** Convert a Prisma post row (with targets/media) into the client Post shape. */
function postFromApi(p: any): Post {
  const targets: PostTarget[] = (p.targets ?? []).map((t: any) => ({
    id: t.id,
    accountId: t.socialAccountId ?? t.socialAccount?.id ?? t.accountId,
    platform: (t.socialAccount?.platform ?? t.platform ?? "linkedin") as PlatformId,
    content: t.content ?? undefined,
    status: (t.status ?? "pending") as PostTarget["status"],
    externalId: t.externalId ?? undefined,
    externalUrl: t.externalUrl ?? undefined,
    errorMessage: t.errorMessage ?? undefined,
    publishedAt: t.publishedAt ?? undefined,
  }));
  const latestByAccount = new Map<string, any>();
  for (const row of p.analytics ?? []) {
    const key = row.socialAccountId ?? row.accountId ?? row.id;
    if (!latestByAccount.has(key)) latestByAccount.set(key, row);
  }
  const metricRows = Array.from(latestByAccount.values());
  const metrics = metricRows.length
    ? {
        reach: metricRows.reduce((sum, r) => sum + (r.reach ?? 0), 0),
        likes: metricRows.reduce((sum, r) => sum + (r.likes ?? 0), 0),
        comments: metricRows.reduce((sum, r) => sum + (r.comments ?? 0), 0),
        shares: metricRows.reduce((sum, r) => sum + (r.shares ?? 0), 0),
        clicks: metricRows.reduce((sum, r) => sum + (r.clicks ?? 0), 0),
      }
    : undefined;
  return {
    id: p.id,
    content: p.content,
    platforms: Array.from(
      new Set(targets.map((t) => t.platform))
    ) as PlatformId[],
    status: (p.status ?? "draft") as PostStatus,
    scheduledAt: p.scheduledAt ?? undefined,
    publishedAt: p.publishedAt ?? undefined,
    media: (p.media ?? []).map((m: any) => ({
      id: m.id,
      type: m.type,
      url: m.url,
      alt: m.altText ?? "media",
    })),
    hashtags: p.hashtags ? safeJsonParse(p.hashtags, []) : [],
    instagramOptions: p.aiMeta
      ? safeJsonParse<any>(p.aiMeta, {})?.instagramOptions
      : undefined,
    author: {
      name: p.createdBy?.name ?? p.author?.name ?? "You",
      initials: buildInitials(p.createdBy?.email ?? p.author?.email ?? "you@example.com", p.createdBy?.name ?? p.author?.name ?? undefined),
      gradient: DEFAULT_GRADIENT,
    },
    clientId: p.targets?.[0]?.socialAccount?.id ?? p.clientId ?? p.client?.id ?? undefined,
    clientName: p.targets?.[0]?.socialAccount?.displayName ?? p.targets?.[0]?.socialAccount?.handle ?? p.client?.name ?? undefined,
    targets,
    metrics: p.metrics ?? metrics,
  };
}

function accountFromApi(a: any): SocialAccount {
  return {
    id: a.id,
    platform: a.platform as PlatformId,
    handle: a.handle,
    displayName: a.displayName ?? a.handle,
    avatarUrl: a.avatarUrl ?? undefined,
    avatarGradient: a.avatarGradient ?? DEFAULT_GRADIENT,
    followers: a.followers ?? 0,
    connectedAt: a.connectedAt ?? new Date().toISOString(),
    status: a.status ?? "connected",
    tokenExpiresAt: a.tokenExpiresAt ?? undefined,
    isReal: a.isReal ?? false,
    externalUserId: a.externalUserId ?? undefined,
    clientId: a.clientId ?? a.client?.id ?? undefined,
    clientName: a.clientName ?? a.client?.name ?? undefined,
  };
}

function safeJsonParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

/* -------------------------------------------------------------------------- */
/*  Store interface                                                            */
/* -------------------------------------------------------------------------- */

interface SocialFlowState {
  /* Auth */
  isAuthenticated: boolean;
  authMode: AuthMode;
  user: SocialFlowUser | null;
  accessToken: string | null;
  workspaceId: string | null;
  workspaces: WorkspaceSummary[];
  switchWorkspace: (workspaceId: string) => Promise<void>;
  isLoading: boolean;
  setAuthMode: (mode: AuthMode) => void;
  register: (name: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  restoreSession: () => Promise<void>;
  updateProfile: (patch: {
    name?: string;
    email?: string;
    bio?: string;
    image?: string | null;
    theme?: string;
    notifications?: Record<string, boolean>;
  }) => Promise<void>;
  signOut: () => void;

  /* Agency scope */
  agencyMembers: AgencyMemberSummary[];
  agencyClients: AgencyClientSummary[];
  agencyMemberId: string;
  agencyClientId: string;
  agencyPlatformId: string;
  loadAgencyDirectory: () => Promise<void>;
  setAgencyMemberFilter: (memberId: string) => Promise<void>;
  setAgencyClientFilter: (clientId: string) => Promise<void>;
  setAgencyPlatformFilter: (platformId: string) => Promise<void>;

  /* Navigation */
  activeView: AppView;
  setActiveView: (view: AppView) => void;

  /* Command palette */
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;

  /* Posts */
  posts: Post[];
  addPost: (post: Post) => Promise<boolean>;
  updatePost: (id: string, patch: Partial<Post>) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  updatePostTarget: (postId: string, accountId: string, patch: Partial<PostTarget>) => Promise<void>;
  recomputePostStatus: (postId: string) => void;
  /** Replace the entire posts collection (used by import). */
  replacePosts: (posts: Post[]) => void;
  /** Replace the entire accounts collection (used by import). */
  replaceAccounts: (accounts: SocialAccount[]) => void;
  /** Reload posts + accounts from the API. */
  reloadData: () => Promise<void>;
  /** Export all data as a downloadable JSON file. */
  exportData: () => Promise<void>;

  /* Connected accounts */
  accounts: SocialAccount[];
  connectAccount: (account: Omit<SocialAccount, "id" | "connectedAt">, connectionGrant?: string) => Promise<string>;
  disconnectAccount: (id: string) => Promise<void>;
  updateAccount: (id: string, patch: Partial<SocialAccount>) => Promise<void>;
  checkOAuthCallback: () => void;

  /* Composer state */
  composerContent: string;
  composerMedia: { type: "image" | "video"; url: string; alt: string }[];
  composerScheduledAt: string | null;
  composerAccountIds: string[];
  composerEditingId: string | null;
  setComposerContent: (c: string) => void;
  setComposerMedia: (m: { type: "image" | "video"; url: string; alt: string }[]) => void;
  setComposerScheduledAt: (d: string | null) => void;
  setComposerAccountIds: (ids: string[]) => void;
  setComposerEditingId: (id: string | null) => void;
  resetComposer: () => void;

  /* Publish worker */
  publishingPosts: string[];
  setPublishing: (postId: string, isPublishing: boolean) => void;
}

/* -------------------------------------------------------------------------- */
/*  Store implementation                                                       */
/* -------------------------------------------------------------------------- */

export const useSocialFlow = create<SocialFlowState>()(
  persist(
    (set, get) => ({
      /* Auth */
      isAuthenticated: false,
      authMode: null,
      user: null,
      accessToken: null,
      workspaceId: null,
      workspaces: [],
      isLoading: true,
      agencyMembers: [],
      agencyClients: [],
      agencyMemberId: "all",
      agencyClientId: "all",
      agencyPlatformId: "all",
      setAuthMode: (mode) => set({ authMode: mode }),

      register: async (name, email, password) => {
        const json = await apiCall<{ user: any; accessToken: string }>(
          "/api/v1/auth/register",
          {
            method: "POST",
            body: JSON.stringify({ name, email, password }),
          }
        );
        setAccessToken(json.data.accessToken);
        // Fetch the full profile (with workspace id)
        const me = await apiCall<{ user: any; workspaces: any[] }>("/api/v1/auth/me");
        const u = me.data.user;
        const workspaces = me.data.workspaces ?? [];
        const ws = workspaces.find((w: any) => w.isActive) ?? workspaces.find((w: any) => w.id === u.defaultWorkspaceId) ?? workspaces[0];
        set({
          isAuthenticated: true,
          authMode: null,
          accessToken: json.data.accessToken,
          workspaceId: ws?.id ?? null,
          workspaces,
          agencyMembers: [],
          agencyClients: [],
          agencyMemberId: "all",
          agencyClientId: "all",
          agencyPlatformId: "all",
          user: {
            id: u.id,
            name: u.name ?? name,
            email: u.email,
            initials: buildInitials(u.email, u.name ?? name),
            gradient: DEFAULT_GRADIENT,
            image: u.image ?? null,
            bio: u.bio ?? "",
            theme: u.theme ?? "dark",
          },
          activeView: "dashboard",
        });
        // Load posts + accounts (will be empty for a fresh user)
        await get().reloadData();
        toast.success("Account created", {
          description: "Welcome to Loomic! Your data is saved to the database.",
        });
      },

      signIn: async (email, password) => {
        const json = await apiCall<{ user: any; accessToken: string }>(
          "/api/v1/auth/login",
          {
            method: "POST",
            body: JSON.stringify({ email, password }),
          }
        );
        setAccessToken(json.data.accessToken);
        // Fetch the full profile
        const me = await apiCall<{ user: any; workspaces: any[] }>("/api/v1/auth/me");
        const u = me.data.user;
        const workspaces = me.data.workspaces ?? [];
        const ws = workspaces.find((w: any) => w.isActive) ?? workspaces.find((w: any) => w.id === u.defaultWorkspaceId) ?? workspaces[0];
        set({
          isAuthenticated: true,
          authMode: null,
          accessToken: json.data.accessToken,
          workspaceId: ws?.id ?? null,
          workspaces,
          agencyMembers: [],
          agencyClients: [],
          agencyMemberId: "all",
          agencyClientId: "all",
          agencyPlatformId: "all",
          user: {
            id: u.id,
            name: u.name ?? email,
            email: u.email,
            initials: buildInitials(u.email, u.name ?? email),
            gradient: DEFAULT_GRADIENT,
            image: u.image ?? null,
            bio: u.bio ?? "",
            theme: u.theme ?? "dark",
          },
          activeView: "dashboard",
        });
        // Load posts + accounts
        await get().reloadData();
        toast.success("Welcome back!", {
          description: `Logged in as ${u.email}`,
        });
      },

      restoreSession: async () => {
        let token = getToken();
        if (!token) token = await refreshAccessToken();
        if (!token) {
          set({ isLoading: false });
          return;
        }
        try {
          const me = await apiCall<{ user: any; workspaces: any[] }>("/api/v1/auth/me");
          const u = me.data.user;
          const workspaces = me.data.workspaces ?? [];
          const ws = workspaces.find((w: any) => w.isActive) ?? workspaces.find((w: any) => w.id === u.defaultWorkspaceId) ?? workspaces[0];
          set({
            isAuthenticated: true,
            accessToken: getToken() ?? token,
            workspaceId: ws?.id ?? null,
            workspaces,
            user: {
              id: u.id,
              name: u.name ?? u.email,
              email: u.email,
              initials: buildInitials(u.email, u.name ?? undefined),
              gradient: DEFAULT_GRADIENT,
              image: u.image ?? null,
              bio: u.bio ?? "",
              theme: u.theme ?? "dark",
            },
            activeView: "dashboard",
            isLoading: false,
          });
          // Load posts + accounts from the API
          await get().reloadData();
        } catch {
          clearTokens();
          set({ isAuthenticated: false, user: null, accessToken: null, isLoading: false });
        }
      },

      updateProfile: async (patch) => {
        const json = await apiCall<any>("/api/v1/auth/me/profile", {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        const u = json.data;
        set((s) => ({
          user: s.user
            ? {
                ...s.user,
                name: u.name ?? s.user.name,
                email: u.email ?? s.user.email,
                initials: buildInitials(u.email ?? s.user.email, u.name ?? s.user.name),
                image: u.image ?? s.user.image,
                bio: u.bio ?? s.user.bio,
                theme: u.theme ?? s.user.theme,
              }
            : null,
        }));
      },

      signOut: () => {
        if (typeof window !== "undefined") {
          void fetch("/api/v1/auth/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
        }
        clearTokens();
        set({
          isAuthenticated: false,
          user: null,
          accessToken: null,
          workspaceId: null,
          workspaces: [],
          posts: [],
          accounts: [],
          agencyMembers: [],
          agencyClients: [],
          agencyMemberId: "all",
          agencyClientId: "all",
          agencyPlatformId: "all",
          activeView: "dashboard",
          authMode: null,
        });
        toast.success("Signed out");
      },

      switchWorkspace: async (workspaceId) => {
        if (workspaceId === get().workspaceId) return;
        await apiCall("/api/v1/workspace/activate", {
          method: "POST",
          body: JSON.stringify({ workspaceId }),
        });
        set((state) => ({
          workspaceId,
          workspaces: state.workspaces.map((w) => ({ ...w, isActive: w.id === workspaceId })),
          posts: [],
          accounts: [],
          agencyMembers: [],
          agencyClients: [],
          agencyMemberId: "all",
          agencyClientId: "all",
          agencyPlatformId: "all",
          activeView: "dashboard",
        }));
        await get().reloadData();
        toast.success("Workspace switched");
      },

      /* Agency scope */
      loadAgencyDirectory: async () => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) return;
        const role = get().workspaces.find((w) => w.id === workspaceId)?.role;
        if (role !== "owner") {
          set({ agencyMembers: [], agencyClients: [] });
          return;
        }
        try {
          const [membersRes, accountsRes] = await Promise.all([
            apiCall<any>(`/api/v1/teams/members?workspaceId=${encodeURIComponent(workspaceId)}&pageSize=100`),
            apiCall<any[]>(`/api/v1/accounts?workspaceId=${encodeURIComponent(workspaceId)}`),
          ]);
          const memberRows = membersRes.data?.members ?? [];
          const accountRows = accountsRes.data ?? [];
          set({
            agencyMembers: memberRows
              .filter((m: any) => m.role !== "owner")
              .map((m: any) => ({ userId: m.userId, name: m.name ?? m.email, email: m.email, role: m.role })),
            // In this agency workflow every connected social account is a client.
            agencyClients: accountRows.map((account: any) => ({
              id: account.id,
              name: account.displayName || account.handle,
              status: account.status,
              members: memberRows
                .filter((m: any) => m.role !== "owner" && (m.assignedAccounts ?? []).some((assigned: any) => assigned.id === account.id))
                .map((m: any) => ({ userId: m.userId, name: m.name ?? null, email: m.email })),
              accounts: [{ id: account.id, platform: account.platform, handle: account.handle }],
              postCount: 0,
            })),
          });
        } catch (error) {
          console.warn("[agency directory] failed:", error);
        }
      },
      setAgencyMemberFilter: async (memberId) => {
        set({ agencyMemberId: memberId, agencyClientId: "all" });
        await get().reloadData();
      },
      setAgencyClientFilter: async (clientId) => {
        set({ agencyClientId: clientId });
        await get().reloadData();
      },
      setAgencyPlatformFilter: async (platformId) => {
        set({ agencyPlatformId: platformId });
        await get().reloadData();
      },

      /* Navigation */
      activeView: "dashboard",
      setActiveView: (view) => set({ activeView: view }),

      /* Command palette */
      commandOpen: false,
      setCommandOpen: (open) => set({ commandOpen: open }),

      /* Posts — empty until loaded from API */
      posts: [],
      addPost: async (post) => {
        const workspaceId = get().workspaceId;
        const publishNow = post.status === "published";
        if (!workspaceId) {
          toast.error("No active workspace", { description: "Reload the app or sign in again before creating a post." });
          return false;
        }
        try {
          const json = await apiCall<any>("/api/v1/posts", {
            method: "POST",
            body: JSON.stringify({
              workspaceId,
              content: post.content,
              status: publishNow ? "scheduled" : post.status,
              scheduledAt: publishNow ? (post.scheduledAt ?? new Date().toISOString()) : post.scheduledAt,
              hashtags: post.hashtags,
              instagramOptions: post.instagramOptions,
              targets: post.targets.map((t) => ({
                accountId: t.accountId,
                content: t.content ?? null,
              })),
              media: post.media.map((m, i) => ({
                type: m.type,
                url: m.url,
                altText: m.alt,
                sortOrder: i,
              })),
            }),
          });
          const created = postFromApi(json.data);
          set((s) => ({ posts: [created, ...s.posts] }));
          if (publishNow) {
            await apiCall(`/api/v1/posts/${created.id}/publish`, { method: "POST" });
            await get().reloadData();
          }
          return true;
        } catch (err) {
          toast.error("Post was not saved", {
            description: err instanceof Error ? err.message : "Server request failed",
          });
          return false;
        }
      },
      updatePost: async (id, patch) => {
        // Optimistic update. The server response is reloaded afterwards so
        // target/media ids and publish status remain authoritative.
        set((s) => ({
          posts: s.posts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        }));
        try {
          const publishNow = patch.status === "published";
          await apiCall(`/api/v1/posts/${id}`, {
            method: "PATCH",
            body: JSON.stringify({
              content: patch.content,
              status: publishNow ? "scheduled" : patch.status,
              scheduledAt: publishNow ? (patch.scheduledAt ?? new Date().toISOString()) : patch.scheduledAt,
              hashtags: patch.hashtags,
              instagramOptions: patch.instagramOptions,
              targets: patch.targets?.map((target) => ({
                accountId: target.accountId,
                content: target.content ?? null,
              })),
              media: patch.media?.map((media, index) => ({
                type: media.type,
                url: media.url,
                altText: media.alt,
                sortOrder: index,
              })),
            }),
          });
          if (publishNow) {
            await apiCall(`/api/v1/posts/${id}/publish`, { method: "POST" });
          }
          await get().reloadData();
        } catch (error) {
          await get().reloadData();
          toast.error("Post update failed", { description: error instanceof Error ? error.message : "Server request failed" });
          throw error;
        }
      },
      deletePost: async (id) => {
        // Optimistic
        set((s) => ({ posts: s.posts.filter((p) => p.id !== id) }));
        try {
          await apiCall(`/api/v1/posts/${id}`, { method: "DELETE" });
        } catch (error) {
          await get().reloadData();
          toast.error("Post deletion failed", { description: error instanceof Error ? error.message : "Server request failed" });
        }
      },
      updatePostTarget: async (postId, accountId, patch) => {
        // Optimistic
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  targets: p.targets.map((t) =>
                    t.accountId === accountId ? { ...t, ...patch } : t
                  ),
                }
              : p
          ),
        }));
        const target = get().posts.find((p) => p.id === postId)?.targets.find((t) => t.accountId === accountId);
        if (target?.id) {
          try {
            await apiCall(`/api/v1/posts/${postId}/targets/${target.id}`, {
              method: "PATCH",
              body: JSON.stringify(patch),
            });
          } catch (error) {
            console.warn("[updatePostTarget] persistence failed:", error);
          }
        }
      },
      recomputePostStatus: (postId) =>
        set((s) => ({
          posts: s.posts.map((p) => {
            if (p.id !== postId) return p;
            const newStatus = derivePostStatus(p);
            const publishedAt =
              newStatus === "published"
                ? p.targets.find((t) => t.status === "published")?.publishedAt ??
                  new Date().toISOString()
                : p.publishedAt;
            return { ...p, status: newStatus, publishedAt };
          }),
        })),

      replacePosts: (posts) => set({ posts }),
      replaceAccounts: (accounts) => set({ accounts }),


      reloadData: async () => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) return;
        try {
          const params = new URLSearchParams({ workspaceId });
          const memberId = get().agencyMemberId;
          const clientId = get().agencyClientId;
          const platformId = get().agencyPlatformId;
          if (memberId && memberId !== "all") params.set("memberId", memberId);
          if (clientId && clientId !== "all") params.set("accountId", clientId);
          if (platformId && platformId !== "all") params.set("platform", platformId);
          const query = params.toString();
          const [postsRes, accountsRes] = await Promise.all([
            apiCall<any[]>(`/api/v1/posts?${query}`),
            apiCall<any[]>(`/api/v1/accounts?${query}`),
          ]);
          set({
            posts: (postsRes.data ?? []).map(postFromApi),
            accounts: (accountsRes.data ?? []).map(accountFromApi),
          });
        } catch (err) {
          console.warn("[reloadData] failed:", err);
        }
      },

      exportData: async () => {
        const state = get();
        const payload = {
          exportedAt: new Date().toISOString(),
          user: state.user,
          posts: state.posts,
          accounts: state.accounts,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `socialflow-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Data exported", {
          description: `${state.posts.length} posts and ${state.accounts.length} accounts saved to your download.`,
        });
      },

      /* Accounts */
      accounts: [],
      connectAccount: async (account, connectionGrant) => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) {
          toast.error("No active workspace");
          throw new Error("No active workspace");
        }
        try {
          const json = await apiCall<any>("/api/v1/accounts", {
            method: "POST",
            headers: connectionGrant ? { "X-Account-Connect-Grant": connectionGrant } : undefined,
            body: JSON.stringify({
              workspaceId,
              platform: account.platform,
              handle: account.handle,
              displayName: account.displayName,
              avatarUrl: account.avatarUrl,
              avatarGradient: account.avatarGradient,
              followers: account.followers,
              status: account.status,
              tokenExpiresAt: account.tokenExpiresAt,
            }),
          });
          const created = accountFromApi(json.data);
          set((s) => ({ accounts: [...s.accounts, created] }));
          return created.id;
        } catch (err) {
          toast.error("Account was not connected", {
            description: err instanceof Error ? err.message : "Server request failed",
          });
          throw err;
        }
      },
      disconnectAccount: async (id) => {
        // Optimistic
        set((s) => ({
          accounts: s.accounts.filter((a) => a.id !== id),
          posts: s.posts.map((p) => ({
            ...p,
            targets: p.targets.filter((t) => t.accountId !== id),
            platforms: Array.from(
              new Set(
                p.targets
                  .filter((t) => t.accountId !== id)
                  .map((t) => t.platform)
              )
            ) as PlatformId[],
          })),
        }));
        try {
          await apiCall(`/api/v1/accounts/${id}`, { method: "DELETE" });
        } catch (err) {
          await get().reloadData();
          toast.error("Account was not disconnected", {
            description: err instanceof Error ? err.message : "Server request failed",
          });
        }
      },
      updateAccount: async (id, patch) => {
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        }));
        try {
          await apiCall(`/api/v1/accounts/${id}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
          });
        } catch (err) {
          await get().reloadData();
          toast.error("Account update failed", {
            description: err instanceof Error ? err.message : "Server request failed",
          });
        }
      },
      checkOAuthCallback: () => {
        if (typeof window === "undefined") return;
        const url = new URL(window.location.href);
        const success = url.searchParams.get("oauth_success");
        const error = url.searchParams.get("oauth_error");
        const detail = url.searchParams.get("error_detail");
        if (!success && !error) return;

        if (success) {
          void get().reloadData().then(() => {
            toast.success(`${success === "twitter" ? "X" : success.charAt(0).toUpperCase() + success.slice(1)} connected via OAuth`, {
              description: "Provider credentials are stored securely on the server.",
            });
          });
        } else {
          toast.error("Social account connection failed", {
            description: detail || error || "The provider did not complete OAuth.",
          });
        }
        ["oauth_success", "oauth_error", "error_detail"].forEach((key) => url.searchParams.delete(key));
        window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
      },

      /* Composer */
      composerContent: "",
      composerMedia: [],
      composerScheduledAt: null,
      composerAccountIds: [],
      composerEditingId: null,
      setComposerContent: (c) => set({ composerContent: c }),
      setComposerMedia: (m) => set({ composerMedia: m }),
      setComposerScheduledAt: (d) => set({ composerScheduledAt: d }),
      setComposerAccountIds: (ids) => set({ composerAccountIds: ids }),
      setComposerEditingId: (id) => set({ composerEditingId: id }),
      resetComposer: () =>
        set({
          composerContent: "",
          composerMedia: [],
          composerScheduledAt: null,
          composerAccountIds: [],
          composerEditingId: null,
        }),

      /* Publish worker */
      publishingPosts: [],
      setPublishing: (postId, isPublishing) =>
        set((s) => {
          const set = new Set(s.publishingPosts);
          if (isPublishing) set.add(postId);
          else set.delete(postId);
          return { publishingPosts: Array.from(set) };
        }),
    }),
    {
      name: "socialflow-store-v2",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return window.localStorage;
      }),
      // Persist UI + composer state, but NOT auth (we use the JWT for that)
      partialize: (s) => ({
        user: s.user,
        workspaceId: s.workspaceId,
        workspaces: s.workspaces,
        activeView: s.activeView,
        composerContent: s.composerContent,
        composerMedia: s.composerMedia,
        composerScheduledAt: s.composerScheduledAt,
        composerAccountIds: s.composerAccountIds,
        composerEditingId: s.composerEditingId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // After rehydration, mark as not-authenticated until restoreSession confirms
          state.isAuthenticated = false;
          state.accessToken = null;
        }
      },
    }
  )
);

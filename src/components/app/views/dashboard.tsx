"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Eye,
  Heart,
  MousePointerClick,
  Clock,
  Sparkles,
  BriefcaseBusiness,
  UserRound,
  Radio,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { authenticatedFetch, useSocialFlow } from "@/lib/store";
import { PLATFORMS } from "@/lib/platforms";
import { formatCompact, formatNumber, cn } from "@/lib/utils";

interface StatCard {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  gradient: string;
}

/**
 * Dashboard — the authenticated landing view. Shows four KPI cards, a
 * 30-day performance chart, the upcoming posts queue, a recent activity
 * feed and a "what to do next" prompt.
 */
export function DashboardView() {
  const { posts, accounts, user, workspaceId, accessToken, setActiveView, workspaces,
    agencyMembers, agencyClients, agencyMemberId, agencyClientId, agencyPlatformId, loadAgencyDirectory } = useSocialFlow();
  const role = workspaces.find((w) => w.id === workspaceId)?.role;
  const isOwner = role === "owner";
  const [analytics, setAnalytics] = useState<{
    totals: { followers: number; reach: number; engagement: number; clicks: number };
    series: { date: string; reach: number; engagement: number; clicks: number }[];
  }>({ totals: { followers: 0, reach: 0, engagement: 0, clicks: 0 }, series: [] });
  const [memberClientCount, setMemberClientCount] = useState(0);

  useEffect(() => {
    if (!workspaceId || !accessToken) return;
    let cancelled = false;
    const params = new URLSearchParams({ workspaceId, range: "30d" });
    if (agencyMemberId !== "all") params.set("memberId", agencyMemberId);
    if (agencyClientId !== "all") params.set("accountId", agencyClientId);
    if (agencyPlatformId !== "all") params.set("platform", agencyPlatformId);
    authenticatedFetch(`/api/v1/analytics/summary?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "Analytics request failed");
        if (!cancelled && json.data) setAnalytics({ totals: json.data.totals, series: json.data.series ?? [] });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [workspaceId, accessToken, agencyMemberId, agencyClientId, agencyPlatformId]);

  useEffect(() => { if (isOwner) void loadAgencyDirectory(); }, [isOwner, workspaceId, loadAgencyDirectory]);

  useEffect(() => {
    if (!workspaceId || !accessToken || isOwner) return;
    let cancelled = false;
    authenticatedFetch(`/api/v1/accounts?workspaceId=${encodeURIComponent(workspaceId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "Assigned client/account request failed");
        if (!cancelled) setMemberClientCount((json.data ?? []).length);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [workspaceId, accessToken, isOwner]);

  const series = analytics.series;

  // Upcoming = scheduled posts sorted by scheduledAt ascending
  const upcoming = useMemo(
    () =>
      posts
        .filter((p) => p.status === "scheduled" && p.scheduledAt)
        .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
        .slice(0, 5),
    [posts]
  );

  // Published posts with synced provider metrics
  const published = useMemo(() => posts.filter((p) => p.status === "published" && p.metrics), [posts]);
  const recentPosts = useMemo(() =>
    [...posts]
      .filter((p) => p.publishedAt || p.scheduledAt)
      .sort((a, b) => new Date(b.publishedAt ?? b.scheduledAt ?? 0).getTime() - new Date(a.publishedAt ?? a.scheduledAt ?? 0).getTime())
      .slice(0, 6),
    [posts]
  );

  const totalFollowers = analytics.totals.followers || accounts.reduce((sum, a) => sum + a.followers, 0);
  const scopedClients = agencyClientId !== "all"
    ? agencyClients.filter((c) => c.id === agencyClientId)
    : agencyMemberId !== "all"
      ? agencyClients.filter((c) => c.members.some((m) => m.userId === agencyMemberId))
      : agencyClients;
  const scopedMembers = agencyMemberId !== "all"
    ? agencyMembers.filter((m) => m.userId === agencyMemberId)
    : agencyClientId !== "all"
      ? agencyMembers.filter((m) => scopedClients.some((c) => c.members.some((cm) => cm.userId === m.userId)))
      : agencyMembers;
  const agencyStats: StatCard[] = [
    { label: "Total clients", value: String(scopedClients.filter((c) => c.status !== "archived").length), detail: "Clients in current scope", icon: BriefcaseBusiness, gradient: "from-indigo-500 to-violet-500" },
    { label: "Total team members", value: String(scopedMembers.length), detail: "Members in current scope", icon: UserRound, gradient: "from-cyan-500 to-blue-500" },
    { label: "Connected accounts", value: String(accounts.length), detail: "Social accounts in current scope", icon: Radio, gradient: "from-violet-500 to-fuchsia-500" },
    { label: "Scheduled posts", value: String(posts.filter((p) => p.status === "scheduled").length), detail: "Queued to publish", icon: CalendarClock, gradient: "from-amber-500 to-orange-500" },
    { label: "Published posts", value: String(posts.filter((p) => p.status === "published").length), detail: "Published in current scope", icon: CheckCircle2, gradient: "from-emerald-500 to-teal-500" },
    { label: "Failed posts", value: String(posts.filter((p) => p.status === "failed").length), detail: "Need attention", icon: AlertTriangle, gradient: "from-rose-500 to-red-500" },
  ];

  const stats: StatCard[] = [
    {
      label: "Total followers",
      value: formatCompact(totalFollowers),
      detail: `${accounts.length} connected account${accounts.length === 1 ? "" : "s"}`,
      icon: Users,
      gradient: "from-indigo-500 to-violet-500",
    },
    {
      label: "Reach (30d)",
      value: formatCompact(analytics.totals.reach),
      detail: "Synced provider reach",
      icon: Eye,
      gradient: "from-rose-500 to-orange-500",
    },
    {
      label: "Engagement (30d)",
      value: formatCompact(analytics.totals.engagement),
      detail: "Likes, comments & shares",
      icon: Heart,
      gradient: "from-emerald-500 to-teal-500",
    },
    {
      label: "Link clicks (30d)",
      value: formatCompact(analytics.totals.clicks),
      detail: "Tracked provider clicks",
      icon: MousePointerClick,
      gradient: "from-amber-500 to-pink-500",
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Good morning, {user?.name?.split(" ")[0] ?? "there"} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening across your channels today.
          </p>
        </div>
        <Button
          onClick={() => setActiveView("composer")}
          className="bg-gradient-to-r from-primary to-accent text-white shadow-glow"
        >
          <Sparkles className="mr-1.5 h-4 w-4" />
          Create post
        </Button>
      </motion.div>

      {!isOwner && (
        <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold">{user?.name?.split(" ")[0] ?? "Team"} workspace</h2>
            <p className="text-xs text-muted-foreground">Your login is automatically restricted to the clients assigned to you. Accounts, Queue, Calendar, Composer and Analytics use the same server-side scope.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-border bg-card/70"><CardContent className="flex items-center gap-3 p-4"><BriefcaseBusiness className="h-5 w-5 text-primary" /><div><div className="font-display text-xl font-semibold">{memberClientCount}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Assigned clients</div></div></CardContent></Card>
            <Card className="border-border bg-card/70"><CardContent className="flex items-center gap-3 p-4"><Radio className="h-5 w-5 text-primary" /><div><div className="font-display text-xl font-semibold">{accounts.length}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Visible accounts</div></div></CardContent></Card>
            <Card className="border-border bg-card/70"><CardContent className="flex items-center gap-3 p-4"><CalendarClock className="h-5 w-5 text-primary" /><div><div className="font-display text-xl font-semibold">{posts.filter((post) => post.status === "scheduled").length}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Scheduled posts</div></div></CardContent></Card>
          </div>
        </div>
      )}

      {isOwner && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div><h2 className="text-sm font-semibold">Agency overview</h2><p className="text-xs text-muted-foreground">Respects the Team Member, Client and Platform filters in the header.</p></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {agencyStats.map((stat) => (
              <Card key={stat.label} className="border-border"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{stat.label}</CardTitle><stat.icon className="h-4 w-4 text-primary" /></CardHeader><CardContent><div className="font-display text-2xl font-semibold">{stat.value}</div><p className="mt-1 text-[10px] text-muted-foreground">{stat.detail}</p></CardContent></Card>
            ))}
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
          >
            <Card className="relative overflow-hidden border-border">
              <div
                className={cn(
                  "absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-15 blur-2xl",
                  stat.gradient
                )}
                aria-hidden
              />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-soft",
                    stat.gradient
                  )}
                >
                  <stat.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="font-display text-3xl font-semibold tracking-tight">{stat.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{stat.detail}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Performance chart + activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base font-semibold">Performance overview</CardTitle>
                <p className="text-xs text-muted-foreground">Reach and engagement over the last 30 days</p>
              </div>
              <Badge variant="secondary">Synced data</Badge>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="g-reach" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#4F46E5" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="g-eng" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                      tick={{ fontSize: 11, fill: "currentColor" }}
                      stroke="currentColor"
                      strokeOpacity={0.2}
                      tickLine={false}
                      axisLine={false}
                      interval={5}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "currentColor" }}
                      stroke="currentColor"
                      strokeOpacity={0.2}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatCompact(v)}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        fontSize: 12,
                        color: "var(--popover-foreground)",
                      }}
                      labelFormatter={(d) => new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                      formatter={(value: number, name) => [formatNumber(value), name === "reach" ? "Reach" : "Engagement"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="reach"
                      stroke="#4F46E5"
                      strokeWidth={2}
                      fill="url(#g-reach)"
                    />
                    <Area
                      type="monotone"
                      dataKey="engagement"
                      stroke="#8B5CF6"
                      strokeWidth={2}
                      fill="url(#g-eng)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Activity feed */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="h-full border-border">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentPosts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                  No publishing activity yet.
                </div>
              ) : recentPosts.map((post) => {
                const platform = PLATFORMS[post.platforms[0]];
                const when = post.publishedAt ?? post.scheduledAt;
                return (
                  <div key={post.id} className="flex gap-3">
                    <div className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white", platform?.gradient)}>
                      {platform ? (() => { const Icon = platform.icon; return <Icon className="h-3.5 w-3.5" />; })() : <Clock className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm leading-snug">{post.content || "Media post"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {post.status === "published" ? "Published" : post.status === "scheduled" ? "Scheduled" : post.status}
                        {when ? ` · ${new Date(when).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Upcoming posts + top performers */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Upcoming */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold">Upcoming posts</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setActiveView("queue")}>
                View all
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcoming.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No scheduled posts. Create one to get started.
                </div>
              )}
              {upcoming.map((post) => {
                const p = PLATFORMS[post.platforms[0]];
                const Icon = p.icon;
                return (
                  <div
                    key={post.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card/50 p-3 transition-colors hover:border-primary/40"
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white",
                        p.gradient
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{post.content.slice(0, 80)}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(post.scheduledAt!).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        {" · "}
                        {new Date(post.scheduledAt!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                    <div className="flex -space-x-1">
                      {post.platforms.slice(0, 3).map((pid) => {
                        const plat = PLATFORMS[pid];
                        const PIcon = plat.icon;
                        return (
                          <div
                            key={pid}
                            className={cn(
                              "flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br ring-2 ring-card",
                              plat.gradient
                            )}
                          >
                            <PIcon className="h-2.5 w-2.5 text-white" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Top performers */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold">Top performing posts</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setActiveView("analytics")}>
                View all
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {[...published]
                .sort((a, b) => (b.metrics?.reach ?? 0) - (a.metrics?.reach ?? 0))
                .slice(0, 3)
                .map((post, idx) => {
                  const p = PLATFORMS[post.platforms[0]];
                  return (
                    <div
                      key={post.id}
                      className="flex items-start gap-3 rounded-xl border border-border bg-card/50 p-3"
                    >
                      <div className="font-display text-lg font-semibold text-muted-foreground">
                        #{idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium">{post.content}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {formatCompact(post.metrics!.reach)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="h-3 w-3" />
                            {formatCompact(post.metrics!.likes)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MousePointerClick className="h-3 w-3" />
                            {formatCompact(post.metrics!.clicks)}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {p.name}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

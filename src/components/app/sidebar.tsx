"use client";

import { motion } from "framer-motion";
import {
  LayoutDashboard,
  PenSquare,
  Calendar,
  ListChecks,
  BarChart3,
  Sparkles,
  Plug,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { BrandWordmark } from "@/components/brand";
import { useSocialFlow, type AppView } from "@/lib/store";
import { cn, formatCompact } from "@/lib/utils";
import { PLATFORMS } from "@/lib/platforms";

interface NavItem {
  id: AppView;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

const PRIMARY_NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "composer", label: "Composer", icon: PenSquare },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "queue", label: "Queue", icon: ListChecks },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "ai-studio", label: "AI Studio", icon: Sparkles, badge: "New" },
];

const SECONDARY_NAV: NavItem[] = [
  { id: "accounts", label: "Accounts", icon: Plug },
  { id: "team", label: "Team", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];

/**
 * Sidebar — the persistent left navigation inside the authenticated app.
 * Shows the brand wordmark, primary nav, connected accounts summary and
 * a workspace switcher at the bottom.
 */
export function Sidebar() {
  const { activeView, setActiveView, accounts, workspaces, workspaceId } = useSocialFlow();
  const role = workspaces.find((workspace) => workspace.id === workspaceId)?.role;
  const canManageTeam = role === "owner" || role === "admin";
  const secondaryNav = SECONDARY_NAV.filter((item) => item.id !== "team" || canManageTeam);

  const totalFollowers = accounts.reduce((sum, a) => sum + a.followers, 0);

  return (
    <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r border-border bg-sidebar lg:flex">
      {/* Brand */}
      <div className="flex h-16 items-center border-b border-border px-5">
        <BrandWordmark />
      </div>

      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {role === "owner" ? "Agency workspace" : "My workspace"}
        </div>
        <ul className="space-y-0.5">
          {PRIMARY_NAV.map((item) => {
            const isActive = activeView === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => setActiveView(item.id)}
                  className={cn(
                    "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-primary to-accent"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <item.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className="rounded-full bg-gradient-to-r from-primary to-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mb-1 mt-6 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Manage
        </div>
        <ul className="space-y-0.5">
          {secondaryNav.map((item) => {
            const isActive = activeView === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => setActiveView(item.id)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Connected accounts summary */}
        <div className="mt-6 rounded-xl border border-border bg-card/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Connected</span>
            <span className="text-xs font-semibold text-foreground">
              {formatCompact(totalFollowers)}
            </span>
          </div>
          <div className="mt-2 flex -space-x-1.5">
            {accounts.slice(0, 5).map((a) => {
              const p = PLATFORMS[a.platform];
              const Icon = p.icon;
              return (
                <div
                  key={a.id}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ring-2 ring-sidebar",
                    p.gradient
                  )}
                  title={p.name}
                >
                  <Icon className="h-3.5 w-3.5 text-white" />
                </div>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Quick stats card */}
      <div className="p-3">
        <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/15 via-card to-accent/15 p-4">
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-primary to-accent opacity-20 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Your reach
            </div>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {formatCompact(totalFollowers)} followers across {accounts.length} accounts
            </p>
            <button
              onClick={() => setActiveView("accounts")}
              className="mt-2.5 w-full rounded-lg bg-gradient-to-r from-primary to-accent py-1.5 text-xs font-medium text-white transition-transform hover:scale-[1.02]"
            >
              Manage accounts
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

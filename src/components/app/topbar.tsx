"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  Search,
  Sun,
  Moon,
  Bell,
  Plus,
  Menu,
  ChevronDown,
  LogOut,
  User,
  Settings as SettingsIcon,
  Building2,
  Check,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrandWordmark } from "@/components/brand";
import { useSocialFlow, type AppView } from "@/lib/store";
import { AgencyScopeFilter } from "./agency-scope-filter";

const VIEW_TITLES: Record<AppView, string> = {
  dashboard: "Dashboard",
  composer: "Composer",
  calendar: "Calendar",
  queue: "Queue",
  analytics: "Analytics",
  "ai-studio": "AI Studio",
  accounts: "Accounts",
  team: "Team",
  settings: "Settings",
};

/**
 * Topbar — the persistent header inside the authenticated app. Carries
 * the page title, a command-palette trigger, the theme toggle, a
 * notifications dropdown and the user menu.
 */
export function Topbar({ onOpenMobileNav }: { onOpenMobileNav?: () => void }) {
  const { theme, setTheme } = useTheme();
  const { user, posts, workspaces, workspaceId, switchWorkspace, signOut, setActiveView, setCommandOpen, activeView } = useSocialFlow();
  const [mounted, setMounted] = useState(false);
  const currentWorkspace = workspaces.find((w) => w.id === workspaceId);
  const isOwner = currentWorkspace?.role === "owner";

  // next-themes needs a client mount check before reading `theme`. This is the
  // recommended pattern from the library docs — the linter is overly strict here.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
      {/* Mobile nav toggle */}
      <button
        onClick={onOpenMobileNav}
        className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile brand */}
      <div className="lg:hidden">
        <BrandWordmark />
      </div>

      {/* Page title — desktop */}
      <div className="hidden lg:block">
        <h1 className="font-display text-lg font-semibold tracking-tight">
          {VIEW_TITLES[activeView]}
        </h1>
      </div>

      {/* Owner can switch workspaces. Team members get a locked, isolated team-workspace view. */}
      {isOwner ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="hidden max-w-[220px] items-center gap-2 rounded-lg border border-border bg-card/60 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 lg:flex">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <span className="truncate">{currentWorkspace?.name ?? "Workspace"}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => void switchWorkspace(workspace.id)}
                className="flex items-center justify-between gap-3"
              >
                <span className="min-w-0 truncate">{workspace.name}</span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  {workspace.role}
                  {workspace.id === workspaceId && <Check className="h-3 w-3 text-success" />}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="hidden max-w-[240px] items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-foreground lg:flex" title="Your login is isolated to assigned clients">
          <UserRound className="h-3.5 w-3.5 text-primary" />
          <span className="truncate">{user?.name?.split(" ")[0] ?? "Team"} workspace</span>
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-primary">Assigned only</span>
        </div>
      )}

      <AgencyScopeFilter />

      {/* Command palette trigger */}
      <div className="ml-auto hidden max-w-md flex-1 sm:block">
        <button
          onClick={() => setCommandOpen(true)}
          className="group flex w-full items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search or jump to…</span>
          <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Mobile search icon */}
      <button
        onClick={() => setCommandOpen(true)}
        className="rounded-lg p-2 text-muted-foreground hover:bg-muted sm:hidden"
        aria-label="Search"
      >
        <Search className="h-5 w-5" />
      </button>

      {/* Quick create */}
      <Button
        size="sm"
        onClick={() => setActiveView("composer")}
        className="hidden bg-gradient-to-r from-primary to-accent text-white shadow-glow sm:inline-flex"
      >
        <Plus className="mr-1 h-4 w-4" />
        Create
      </Button>

      {/* Theme toggle */}
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Toggle theme"
      >
        {mounted && theme === "dark" ? (
          <Sun className="h-5 w-5" />
        ) : (
          <Moon className="h-5 w-5" />
        )}
      </button>

      {/* Notifications */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {posts.some((p) => p.status === "failed") && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-background" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {posts.length === 0 ? (
            <div className="px-3 py-5 text-center text-xs text-muted-foreground">No publishing activity yet.</div>
          ) : [...posts]
              .filter((p) => p.publishedAt || p.scheduledAt)
              .sort((a, b) => new Date(b.publishedAt ?? b.scheduledAt ?? 0).getTime() - new Date(a.publishedAt ?? a.scheduledAt ?? 0).getTime())
              .slice(0, 4)
              .map((post) => {
                const when = post.publishedAt ?? post.scheduledAt;
                return (
                  <DropdownMenuItem key={post.id} onClick={() => setActiveView("queue")} className="flex-col items-start py-2.5 cursor-pointer">
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-sm font-medium capitalize">Post {post.status}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {when ? new Date(when).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}
                      </span>
                    </div>
                    <span className="line-clamp-1 text-xs text-muted-foreground">{post.content || "Media post"}</span>
                  </DropdownMenuItem>
                );
              })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-muted">
            <div className="relative h-8 w-8 overflow-hidden rounded-full bg-gradient-to-br from-rose-500 to-orange-500 text-xs font-semibold text-white">
              {user?.image ? (
                <img src={user.image} alt={user.name ?? "Avatar"} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  {user?.initials ?? "MC"}
                </div>
              )}
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{user?.name}</span>
              <span className="text-xs text-muted-foreground">{user?.email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setActiveView("settings")}>
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActiveView("settings")}>
            <SettingsIcon className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="text-danger focus:text-danger">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

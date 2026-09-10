"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
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
import { cn } from "@/lib/utils";

const NAV: { id: AppView; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "composer", label: "Composer", icon: PenSquare },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "queue", label: "Queue", icon: ListChecks },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "ai-studio", label: "AI Studio", icon: Sparkles },
  { id: "accounts", label: "Accounts", icon: Plug },
  { id: "team", label: "Team", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];

/**
 * MobileNav — a slide-in sheet version of the sidebar shown on small
 * screens when the hamburger button in the topbar is tapped.
 */
export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeView, setActiveView, workspaces, workspaceId } = useSocialFlow();
  const role = workspaces.find((workspace) => workspace.id === workspaceId)?.role;
  const canManageTeam = role === "owner" || role === "admin";
  const navItems = NAV.filter((item) => item.id !== "team" || canManageTeam);

  const go = (view: AppView) => {
    setActiveView(view);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[80] lg:hidden"
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="absolute left-0 top-0 h-full w-72 border-r border-border bg-sidebar p-4"
          >
            <div className="flex items-center justify-between">
              <BrandWordmark />
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-6 space-y-1">
              {navItems.map((item) => {
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => go(item.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

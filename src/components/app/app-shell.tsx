"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileNav } from "./mobile-nav";
import { CommandPalette } from "./command-palette";
import { DashboardView } from "./views/dashboard";
import { ComposerView } from "./views/composer";
import { CalendarView } from "./views/calendar-view";
import { QueueView } from "./views/queue";
import { AnalyticsView } from "./views/analytics";
import { AIStudioView } from "./views/ai-studio";
import { AccountsView } from "./views/accounts";
import { TeamView } from "./views/team";
import { SettingsView } from "./views/settings";
import { useSocialFlow } from "@/lib/store";
import { usePublishWorker } from "@/hooks/use-publish-worker";

/**
 * AppShell — the authenticated application layout. Renders the sidebar,
 * topbar, command palette and the currently active view. The view
 * transition is animated with a soft fade so navigation feels smooth.
 *
 * A lightweight synchronizer is mounted here so server-side publish results
 * appear in the UI while the user keeps the app open.
 *
 * On mount we also check OAuth callback query parameters. Successful
 * provider callbacks trigger a fresh account reload from the API.
 */
export function AppShell() {
  const { activeView, checkOAuthCallback, workspaces, workspaceId, setActiveView } = useSocialFlow();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const role = workspaces.find((workspace) => workspace.id === workspaceId)?.role;
  const canManageTeam = role === "owner" || role === "admin";

  // UI synchronizer. Publishing itself runs server-side via the cron endpoint.
  usePublishWorker();

  // Check for a provider OAuth callback on mount.
  useEffect(() => {
    checkOAuthCallback();
  }, [checkOAuthCallback]);

  // A persisted/deep-linked Team view must never expose team-management UI
  // to regular members/viewers. Server-side authorization remains the final gate.
  useEffect(() => {
    if (activeView === "team" && !canManageTeam) setActiveView("dashboard");
  }, [activeView, canManageTeam, setActiveView]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />

        <main className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeView === "dashboard" && <DashboardView />}
              {activeView === "composer" && <ComposerView />}
              {activeView === "calendar" && <CalendarView />}
              {activeView === "queue" && <QueueView />}
              {activeView === "analytics" && <AnalyticsView />}
              {activeView === "ai-studio" && <AIStudioView />}
              {activeView === "accounts" && <AccountsView />}
              {activeView === "team" && canManageTeam && <TeamView />}
              {activeView === "settings" && <SettingsView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <CommandPalette />
    </div>
  );
}

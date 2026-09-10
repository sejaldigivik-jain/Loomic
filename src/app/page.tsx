"use client";

import { useEffect, useState } from "react";
import { LandingPage } from "@/components/landing";
import { AppShell } from "@/components/app/app-shell";
import { AuthModal } from "@/components/auth/auth-modal";
import { useSocialFlow } from "@/lib/store";
import { toast } from "sonner";

/**
 * Home — the single entry point of Loomic. Renders the marketing
 * landing page for unauthenticated visitors and the full app shell for
 * signed-in users. The auth modal is mounted globally so any CTA can
 * trigger it.
 *
 * On mount we check for a stored JWT token. If one exists, we call
 * /api/v1/auth/me to validate it and restore the user's session —
 * so users stay logged in across page refreshes.
 */
export default function Home() {
  const { isAuthenticated, accessToken, restoreSession, setAuthMode } = useSocialFlow();
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    // Never leave the public/tunnel preview stuck forever on the splash screen
    // if a browser cookie/session check is delayed by the proxy.
    let finished = false;
    const fallback = window.setTimeout(() => {
      if (!finished) setRestored(true);
    }, 8000);

    restoreSession().finally(() => {
      finished = true;
      window.clearTimeout(fallback);
      setRestored(true);
    });

    return () => {
      finished = true;
      window.clearTimeout(fallback);
    };
  }, [restoreSession]);

  useEffect(() => {
    if (!restored || typeof window === "undefined") return;
    const reset = new URLSearchParams(window.location.search).get("reset");
    if (reset) setAuthMode("reset");
  }, [restored, setAuthMode]);

  useEffect(() => {
    if (!restored || typeof window === "undefined") return;
    const invite = new URLSearchParams(window.location.search).get("invite");
    if (!invite) return;
    if (!isAuthenticated || !accessToken) {
      setAuthMode("signup");
      return;
    }

    let cancelled = false;
    void fetch(`/api/v1/invitations/${encodeURIComponent(invite)}/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "Invitation could not be accepted");
        if (cancelled) return;
        window.history.replaceState({}, "", window.location.pathname);
        toast.success("Invitation accepted", { description: "You are now inside the invited workspace." });
        return restoreSession();
      })
      .catch((error) => {
        if (!cancelled) toast.error("Invitation could not be accepted", { description: error instanceof Error ? error.message : "Unknown error" });
      });
    return () => { cancelled = true; };
  }, [restored, isAuthenticated, accessToken, restoreSession, setAuthMode]);

  // While checking the stored token, show a brief splash so we don't
  // flash the landing page for already-authenticated users.
  if (!restored) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <p className="text-xs text-muted-foreground">Loading Loomic…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {isAuthenticated ? <AppShell /> : <LandingPage />}
      <AuthModal />
    </>
  );
}

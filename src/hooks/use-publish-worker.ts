/**
 * Production publish synchronizer.
 *
 * Scheduled publishing itself is handled server-side by
 * /api/v1/jobs/publish-due so it keeps running after the browser closes.
 * This hook only refreshes UI state while the app is open.
 */
"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { authenticatedFetch, useSocialFlow } from "@/lib/store";

export function usePublishWorker() {
  const { isAuthenticated, reloadData } = useSocialFlow();

  useEffect(() => {
    if (!isAuthenticated) return;
    const sync = () => void reloadData();
    const interval = window.setInterval(sync, 15000);
    const onFocus = () => sync();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [isAuthenticated, reloadData]);
}

export async function retryFailedTargets(postId: string) {
  const { accessToken, reloadData, setPublishing } = useSocialFlow.getState();
  if (!accessToken) {
    toast.error("Your session has expired. Please sign in again.");
    return;
  }
  setPublishing(postId, true);
  try {
    const res = await authenticatedFetch(`/api/v1/posts/${postId}/publish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? "Retry failed");
    await reloadData();
    if (json.data?.failed > 0) {
      toast.warning("Retry completed with errors", {
        description: `${json.data.published ?? 0} published, ${json.data.failed} failed.`,
      });
    } else {
      toast.success("Post published", {
        description: `Published to ${json.data?.published ?? 0} channel(s).`,
      });
    }
  } catch (error) {
    toast.error("Could not retry post", {
      description: error instanceof Error ? error.message : "Unknown publish error",
    });
  } finally {
    setPublishing(postId, false);
  }
}

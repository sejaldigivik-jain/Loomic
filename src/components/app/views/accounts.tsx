"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Check,
  ExternalLink,
  Users,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Shield,
  AlertCircle,
  KeyRound,
  Sparkles,
  ClipboardPaste,
  Loader2,
  LockKeyhole,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authenticatedFetch, useSocialFlow } from "@/lib/store";
import { PLATFORMS, PLATFORM_LIST, type PlatformId } from "@/lib/platforms";
import { formatCompact, formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { SocialAccount } from "@/lib/mock-data";

/* -------------------------------------------------------------------------- */
/*  Provider OAuth configuration                                               */
/* -------------------------------------------------------------------------- */

interface ProviderConfig { configured: boolean; redirectUri?: string; source?: "workspace" | "environment" | null }
interface SocialProviderConfig {
  providers: Record<PlatformId, ProviderConfig>;
  demoConnectionsEnabled: boolean;
}

interface AccountConnectionLockStatus {
  workspaceId: string;
  configured: boolean;
  setAt?: string | null;
  canManage: boolean;
}

function useSocialProviderConfig(workspaceId: string | null, accessToken: string | null): { config: SocialProviderConfig | null; loading: boolean; reload: () => Promise<void> } {
  const [config, setConfig] = useState<SocialProviderConfig | null>(null);
  const [loading, setLoading] = useState(true);
  async function reload() {
    if (!workspaceId || !accessToken) { setConfig(null); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/v1/config/social-providers?workspaceId=${encodeURIComponent(workspaceId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Could not load provider configuration");
      setConfig(json.data);
    } catch {
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void reload(); }, [workspaceId, accessToken]);
  return { config, loading, reload };
}

/* -------------------------------------------------------------------------- */
/*  Connect dialog — production OAuth plus an optional development-only demo flow */
/*  (other platforms)                                                          */
/* -------------------------------------------------------------------------- */

type ConnectStep = "select" | "instagram_options" | "instagram_token" | "auth" | "details" | "success";

const SAMPLE_HANDLES: Record<PlatformId, string[]> = {
  instagram: ["@yourbrand", "@personal.brand", "@sidehustle.co"],
  linkedin: ["/your-company", "/your-profile"],
  twitter: ["@yourhandle", "@yourbrand"],
  facebook: ["/your-page", "/your-business"],
  threads: ["@yourhandle"],
  pinterest: ["@yourbrand"],
};

function ConnectDialog({
  open,
  onClose,
  preselectPlatform,
  providerConfig,
  onConfigure,
  connectionGrant,
  onGrantConsumed,
}: {
  open: boolean;
  onClose: () => void;
  preselectPlatform?: PlatformId;
  providerConfig: SocialProviderConfig | null;
  onConfigure: () => void;
  connectionGrant: string | null;
  onGrantConsumed: () => void;
}) {
  const { connectAccount, accessToken, workspaceId, reloadData } = useSocialFlow();
  const [step, setStep] = useState<ConnectStep>("select");
  const [platform, setPlatform] = useState<PlatformId | null>(preselectPlatform ?? null);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authProgress, setAuthProgress] = useState(0);
  const [metaToken, setMetaToken] = useState("");
  const [tokenConnecting, setTokenConnecting] = useState(false);

  useEffect(() => {
    if (!open || !preselectPlatform) return;
    setPlatform(preselectPlatform);
    if (preselectPlatform === "instagram" && providerConfig?.providers?.instagram?.configured) {
      setStep("instagram_options");
    }
  }, [open, preselectPlatform, providerConfig]);

  function reset() {
    setStep("select");
    setPlatform(preselectPlatform ?? null);
    setHandle("");
    setDisplayName("");
    setAuthProgress(0);
    setMetaToken("");
    setTokenConnecting(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function launchProviderOAuth(p: PlatformId) {
    try {
      const endpoint = p === "instagram" ? "/api/v1/oauth/instagram/start" : `/api/v1/oauth/${p}/start`;
      const res = await authenticatedFetch(`${endpoint}?workspaceId=${encodeURIComponent(workspaceId ?? "")}`, {
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(connectionGrant ? { "X-Account-Connect-Grant": connectionGrant } : {}),
        },
      });
      onGrantConsumed();
      const json = await res.json();
      if (!res.ok || !json.data?.authorizeUrl) throw new Error(json.error?.message ?? `Could not start ${PLATFORMS[p].name} OAuth`);
      toast.info(`Redirecting to ${PLATFORMS[p].name}…`, { description: "Authorize the account for this workspace." });
      window.location.href = json.data.authorizeUrl;
    } catch (error) {
      onGrantConsumed();
      toast.error(`${PLATFORMS[p].name} connection failed`, { description: error instanceof Error ? error.message : "OAuth start failed" });
      handleClose();
    }
  }

  async function startAuth(p: PlatformId) {
    setPlatform(p);
    const configured = providerConfig?.providers?.[p]?.configured;
    if (configured) {
      if (p === "instagram") {
        setStep("instagram_options");
        return;
      }
      await launchProviderOAuth(p);
      return;
    }

    if (!providerConfig?.demoConnectionsEnabled) {
      toast.info(`${PLATFORMS[p].name} needs one-time provider setup`, {
        description: "Add the developer app Client ID/Secret in Settings → Integrations, then click Connect again.",
      });
      handleClose();
      onConfigure();
      return;
    }

    setStep("auth");
    setAuthProgress(0);
    const interval = setInterval(() => {
      setAuthProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setStep("details");
          const samples = SAMPLE_HANDLES[p];
          if (samples?.length) setHandle(samples[0]);
          return 100;
        }
        return prev + 4;
      });
    }, 60);
  }

  async function connectInstagramToken() {
    if (!workspaceId) {
      toast.error("No active workspace");
      return;
    }
    if (!metaToken.trim()) {
      toast.error("Paste the Instagram access token generated by Meta");
      return;
    }
    setTokenConnecting(true);
    try {
      const res = await authenticatedFetch("/api/v1/accounts/instagram/token-connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(connectionGrant ? { "X-Account-Connect-Grant": connectionGrant } : {}),
        },
        body: JSON.stringify({ workspaceId, accessToken: metaToken.trim() }),
      });
      onGrantConsumed();
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Instagram token connection failed");
      await reloadData();
      toast.success(`${json.data?.handle ?? "Instagram"} connected`, {
        description: json.data?.tokenWasExchanged
          ? "Meta token verified and upgraded to a long-lived token."
          : "Meta token verified and securely stored.",
      });
      setStep("success");
      setHandle(json.data?.handle ?? "Instagram");
      setTimeout(() => handleClose(), 1200);
    } catch (error) {
      onGrantConsumed();
      toast.error("Instagram connection failed", { description: error instanceof Error ? error.message : "Unknown error" });
      handleClose();
    } finally {
      setTokenConnecting(false);
    }
  }

  async function handleConnect() {
    if (!platform) return;
    if (!handle.trim()) {
      toast.error("Enter your handle");
      return;
    }
    const p = PLATFORMS[platform];
    try {
      await connectAccount({
        platform,
        handle: handle.trim(),
        displayName: displayName.trim() || p.name + " account",
        avatarGradient: p.gradient,
        followers: Math.floor(500 + Math.random() * 5000),
        status: "connected",
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        isReal: false, // demo account
      }, connectionGrant ?? undefined);
      onGrantConsumed();
      setStep("success");
      toast.success(`${p.name} account connected (demo)`, {
        description: `${handle.trim()} is a demo account — posts won't publish for real.`,
      });
      setTimeout(() => handleClose(), 1400);
    } catch {
      // A connection grant is deliberately one-use even when the provider
      // attempt fails. Close the dialog so the owner must unlock again.
      onGrantConsumed();
      handleClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "select" && "Connect a social account"}
            {step === "instagram_options" && "Connect Instagram"}
            {step === "instagram_token" && "Quick connect with Meta token"}
            {step === "auth" && "Authorizing…"}
            {step === "details" && "Account details"}
            {step === "success" && "Connected!"}
          </DialogTitle>
          <DialogDescription>
            {step === "select" && (providerConfig?.demoConnectionsEnabled ? "Connect a configured OAuth provider, or use development-only demo accounts." : "Connect a configured production OAuth integration.")}
            {step === "instagram_options" && "Choose the easiest method for your current setup."}
            {step === "instagram_token" && "No redirect URL is needed for this testing method."}
            {step === "auth" && "Opening the platform's secure OAuth consent screen…"}
            {step === "details" && "Confirm the handle and a friendly name for this account."}
            {step === "success" && "Your account is connected and ready to publish."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: pick platform */}
        {step === "select" && (
          <div className="space-y-2 py-2">
            {PLATFORM_LIST.map((p) => {
              const Icon = p.icon;
              const configured = providerConfig?.providers?.[p.id]?.configured;
              const canDemo = providerConfig?.demoConnectionsEnabled;
              return (
                <button
                  key={p.id}
                  onClick={() => void startAuth(p.id)}
                  disabled={!providerConfig}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-primary/40 hover:shadow-soft disabled:cursor-not-allowed disabled:opacity-55",
                    configured && "border-primary/30 bg-primary/5"
                  )}
                >
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-white", p.gradient)}><Icon className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{p.name}</span>
                      {configured ? (
                        <Badge className="border-success/30 bg-success/15 text-[9px] text-success">REAL OAUTH</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] text-muted-foreground">{canDemo ? "DEV DEMO" : "NOT CONFIGURED"}</Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {configured ? "Connect with the provider's authorization screen →" : canDemo ? "Development-only simulated account" : "Add provider credentials to the production environment"}
                    </div>
                  </div>
                </button>
              );
            })}
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <KeyRound className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
                <p>OAuth redirect URLs and required environment variables are listed in <span className="font-medium text-foreground">PROVIDER-SETUP.md</span>.</p>
              </div>
            </div>
          </div>
        )}

        {step === "instagram_options" && platform === "instagram" && (
          <div className="space-y-3 py-2">
            <button
              type="button"
              onClick={() => setStep("instagram_token")}
              className="w-full rounded-xl border border-primary/30 bg-primary/5 p-4 text-left transition hover:border-primary/60"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-primary/15 p-2 text-primary"><ClipboardPaste className="h-4 w-4" /></div>
                <div>
                  <div className="text-sm font-semibold">Easy test connection — Meta generated token</div>
                  <div className="mt-1 text-xs text-muted-foreground">Best while Loomic is still local. Generate a token for your Instagram Tester account in Meta, paste it here, and connect without OAuth redirect setup.</div>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => void launchProviderOAuth("instagram")}
              className="w-full rounded-xl border border-border p-4 text-left transition hover:border-primary/40"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-success/10 p-2 text-success"><Shield className="h-4 w-4" /></div>
                <div>
                  <div className="text-sm font-semibold">Production OAuth connection</div>
                  <div className="mt-1 text-xs text-muted-foreground">Use this after your permanent HTTPS callback is registered in Meta. This is the method normal customers will use.</div>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                if (providerConfig?.providers?.facebook?.configured) {
                  void launchProviderOAuth("facebook");
                } else {
                  toast.info("Facebook Login needs one-time setup", { description: "Configure the same Meta Business app under Settings → Integrations → Facebook, then reconnect Instagram." });
                  onConfigure();
                  handleClose();
                }
              }}
              className="w-full rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-4 text-left transition hover:border-fuchsia-500/60"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-fuchsia-500/10 p-2 text-fuchsia-600"><Shield className="h-4 w-4" /></div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">Enhanced Instagram via Facebook <Badge className="bg-fuchsia-600 text-[9px] text-white">NATIVE TAGS + LOCATION</Badge></div>
                  <div className="mt-1 text-xs text-muted-foreground">Connect the Facebook Page linked to this professional Instagram account. Loomic keeps the same Instagram account row and upgrades it for supported native media tags and native location IDs.</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{providerConfig?.providers?.facebook?.configured ? "Facebook OAuth is configured and ready." : "Facebook OAuth is not configured yet; click to open Integrations."}</div>
                </div>
              </div>
            </button>
            <Button variant="ghost" className="w-full" onClick={() => setStep("select")}>Back</Button>
          </div>
        )}

        {step === "instagram_token" && platform === "instagram" && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-success/25 bg-success/5 p-3 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">Meta Developer Dashboard → Instagram API → API setup with Instagram login → Generate access tokens</div>
              <div className="mt-1">Click <strong>Generate token</strong> beside your tester account, approve Instagram access, then paste the token below. Loomic verifies the token server-side and encrypts it before saving.</div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Instagram access token</label>
              <Textarea
                value={metaToken}
                onChange={(e) => setMetaToken(e.target.value)}
                placeholder="Paste the token generated by Meta…"
                className="min-h-28 break-all font-mono text-xs"
                autoComplete="off"
              />
              <p className="text-[11px] text-muted-foreground">The token is sent only to your Loomic server. Do not send it in chat or screenshots.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={tokenConnecting} onClick={() => setStep("instagram_options")}>Back</Button>
              <Button disabled={tokenConnecting || !metaToken.trim()} onClick={() => void connectInstagramToken()} className="bg-gradient-to-r from-primary to-accent text-white">
                {tokenConnecting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                {tokenConnecting ? "Verifying…" : "Connect real account"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: OAuth in progress (demo only — real OAuth redirects away) */}
        {step === "auth" && platform && (
          <div className="py-6">
            <div className="flex flex-col items-center gap-4">
              <div className={cn("flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-glow", PLATFORMS[platform].gradient)}>
                {(() => { const Icon = PLATFORMS[platform].icon; return <Icon className="h-8 w-8" />; })()}
              </div>
              <div className="w-full max-w-xs">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Opening consent screen…</span>
                  <span>{authProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    style={{ width: `${authProgress}%` }}
                    transition={{ ease: "linear" }}
                  />
                </div>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5 text-success" />
                Demo mode — posts won&apos;t publish for real
              </p>
            </div>
          </div>
        )}

        {/* Step 3: enter handle + name (demo only) */}
        {step === "details" && platform && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Account handle</label>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@yourhandle"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Display name (optional)</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Personal brand, Company page"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warning" />
              <span>
                This is a <strong>development-only demo account</strong>. It has no provider credentials and cannot publish to real social media. Configure OAuth and reconnect before using it for live publishing.
              </span>
            </div>
          </div>
        )}

        {/* Step 4: success */}
        {step === "success" && platform && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
              <Check className="h-8 w-8 text-success" />
            </div>
            <p className="text-sm font-medium">{PLATFORMS[platform].name} connected</p>
            <p className="text-xs text-muted-foreground">{handle}</p>
          </div>
        )}

        {step === "details" && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleConnect} className="bg-gradient-to-r from-primary to-accent text-white">
              <Check className="mr-1.5 h-4 w-4" />
              Connect account
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main AccountsView                                                          */
/* -------------------------------------------------------------------------- */

export function AccountsView() {
  const { accounts, disconnectAccount, reloadData, accessToken, workspaceId, setActiveView } = useSocialFlow();
  const { config: providerConfig, loading: providerLoading } = useSocialProviderConfig(workspaceId, accessToken);
  const [connectOpen, setConnectOpen] = useState(false);
  const [preselectPlatform, setPreselectPlatform] = useState<PlatformId | undefined>(undefined);
  const [lockStatus, setLockStatus] = useState<AccountConnectionLockStatus | null>(null);
  const [lockStatusLoading, setLockStatusLoading] = useState(false);
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [lockMode, setLockMode] = useState<"setup" | "unlock">("unlock");
  const [lockPassword, setLockPassword] = useState("");
  const [lockPasswordConfirm, setLockPasswordConfirm] = useState("");
  const [lockSubmitting, setLockSubmitting] = useState(false);
  const [pendingPlatform, setPendingPlatform] = useState<PlatformId | undefined>(undefined);
  const [connectionGrant, setConnectionGrant] = useState<string | null>(null);

  const totalFollowers = accounts.reduce((s, a) => s + a.followers, 0);
  const realAccountCount = accounts.filter((a) => a.isReal).length;
  const demoAccountCount = accounts.length - realAccountCount;

  const byPlatform = accounts.reduce<Record<string, SocialAccount[]>>((acc, account) => {
    (acc[account.platform] = acc[account.platform] ?? []).push(account);
    return acc;
  }, {});

  const connectedPlatforms = new Set(Object.keys(byPlatform));
  const availablePlatforms = PLATFORM_LIST.filter((p) => !connectedPlatforms.has(p.id));

  async function loadLockStatus() {
    if (!workspaceId || !accessToken) return null;
    setLockStatusLoading(true);
    try {
      const res = await authenticatedFetch(`/api/v1/account-connection-lock?workspaceId=${encodeURIComponent(workspaceId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Could not load account connection lock");
      const next = json.data as AccountConnectionLockStatus;
      setLockStatus(next);
      return next;
    } catch (error) {
      toast.error("Connection lock unavailable", { description: error instanceof Error ? error.message : "Could not load lock status" });
      return null;
    } finally {
      setLockStatusLoading(false);
    }
  }

  useEffect(() => {
    setLockStatus(null);
    if (workspaceId && accessToken) void loadLockStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, accessToken]);

  async function openConnect(preselect?: PlatformId) {
    const status = lockStatus?.workspaceId === workspaceId ? lockStatus : await loadLockStatus();
    if (!status) return;
    if (!status.canManage) {
      toast.error("Account connection locked", { description: "Only the workspace owner can unlock and connect another account." });
      return;
    }
    setPendingPlatform(preselect);
    setLockMode(status.configured ? "unlock" : "setup");
    setLockPassword("");
    setLockPasswordConfirm("");
    setLockDialogOpen(true);
  }

  async function submitConnectionLock() {
    if (!workspaceId) return;
    if (lockPassword.length < 8) {
      toast.error("Use at least 8 characters for the permanent connection password");
      return;
    }
    if (lockMode === "setup" && lockPassword !== lockPasswordConfirm) {
      toast.error("Passwords do not match");
      return;
    }

    setLockSubmitting(true);
    try {
      const endpoint = lockMode === "setup"
        ? "/api/v1/account-connection-lock/setup"
        : "/api/v1/account-connection-lock/unlock";
      const res = await authenticatedFetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ workspaceId, password: lockPassword }),
      });
      const json = await res.json();
      if (!res.ok || !json.data?.grant) throw new Error(json.error?.message ?? "Could not unlock account connections");

      setLockStatus((prev) => ({ workspaceId, configured: true, canManage: true, setAt: prev?.setAt ?? new Date().toISOString() }));
      setConnectionGrant(json.data.grant);
      setPreselectPlatform(pendingPlatform);
      setLockDialogOpen(false);
      setLockPassword("");
      setLockPasswordConfirm("");
      setConnectOpen(true);
      toast.success(lockMode === "setup" ? "Permanent connection password set" : "Account connection unlocked", {
        description: "This unlock allows one account connection attempt and then locks again automatically.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unlock failed";
      toast.error(lockMode === "setup" ? "Could not set connection password" : "Could not unlock account connection", { description: message });
      if (/already been set/i.test(message)) {
        setLockMode("unlock");
        await loadLockStatus();
      }
    } finally {
      setLockSubmitting(false);
    }
  }

  function markGrantConsumed() {
    setConnectionGrant(null);
  }

  async function closeConnectAndRelock() {
    const grant = connectionGrant;
    setConnectOpen(false);
    setConnectionGrant(null);
    if (!grant || !workspaceId) return;
    try {
      await authenticatedFetch("/api/v1/account-connection-lock/relock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ workspaceId, grant }),
      });
    } catch {
      // The client drops the grant regardless. It also expires server-side in five minutes.
    }
  }

  function openIntegrationSettings() {
    if (typeof window !== "undefined") sessionStorage.setItem("socialflow-settings-section", "integrations");
    setActiveView("settings");
  }

  async function handleDisconnect(account: SocialAccount) {
    const p = PLATFORMS[account.platform];
    await disconnectAccount(account.id);
    toast.success(`${p.name} account disconnected`, {
      description: `${account.handle} can no longer publish posts.`,
    });
  }

  async function handleRefresh(account: SocialAccount) {
    if (!account.isReal) {
      toast.info("Demo accounts cannot sync with a provider");
      return;
    }
    toast.info(`Refreshing ${account.handle}…`);
    try {
      const res = await authenticatedFetch(`/api/v1/accounts/${account.id}/sync`, {
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Sync failed");
      await reloadData();
      const analyticsSynced = Number(json.data?.analyticsSynced ?? 0);
      toast.success(`${PLATFORMS[account.platform].name} account refreshed`, {
        description: analyticsSynced > 0
          ? `Profile updated and ${analyticsSynced} published post${analyticsSynced === 1 ? "" : "s"} refreshed.`
          : "Latest account profile details were synced from the provider.",
      });
    } catch (error) {
      toast.error("Account refresh failed", { description: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Connected accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {accounts.length} account{accounts.length === 1 ? "" : "s"} · {formatCompact(totalFollowers)} total followers
            {realAccountCount > 0 && (
              <span className="ml-2 text-success">· {realAccountCount} real · {demoAccountCount} demo</span>
            )}
          </p>
        </div>
        <Button
          onClick={() => openConnect()}
          className="bg-gradient-to-r from-primary to-accent text-white shadow-glow"
        >
          <LockKeyhole className="mr-1.5 h-4 w-4" />
          Connect account
        </Button>
      </motion.div>

      {/* Provider OAuth status */}
      {!providerLoading && providerConfig && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-gradient-to-r from-primary/10 to-transparent p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/15"><Shield className="h-5 w-5 text-primary" /></div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Production social integrations</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {Object.values(providerConfig.providers).filter((p) => p.configured).length} of {PLATFORM_LIST.length} providers are ready for real OAuth in this workspace. Add provider app credentials in Settings → Integrations to enable the remaining channels.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{formatCompact(totalFollowers)}</div>
              <div className="text-xs text-muted-foreground">Total followers</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{accounts.length}</div>
              <div className="text-xs text-muted-foreground">Connected accounts</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-pink-500 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{realAccountCount}</div>
              <div className="text-xs text-muted-foreground">Real accounts (OAuth)</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounts grouped by platform */}
      <div className="space-y-6">
        {PLATFORM_LIST.map((p) => {
          const platformAccounts = byPlatform[p.id] ?? [];
          if (platformAccounts.length === 0) return null;
          const Icon = p.icon;
          return (
            <div key={p.id}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br text-white", p.gradient)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {p.name}
                  </h2>
                  <Badge variant="secondary" className="text-[10px]">
                    {platformAccounts.length} {platformAccounts.length === 1 ? "account" : "accounts"}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => openConnect(p.id)}
                >
                  <LockKeyhole className="mr-1 h-3 w-3" />
                  Add another
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {platformAccounts.map((account, i) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    index={i}
                    onDisconnect={() => handleDisconnect(account)}
                    onRefresh={() => handleRefresh(account)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Platforms with no accounts yet */}
      {availablePlatforms.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Connect a new platform
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availablePlatforms.map((p, i) => {
              const Icon = p.icon;
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                >
                  <Card className="flex items-center justify-between border-border p-4 transition-all hover:border-primary/40">
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white", p.gradient)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {providerConfig?.providers?.[p.id]?.configured ? "Real OAuth ready" : "Set up provider app first"}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!providerConfig}
                      onClick={() => {
                        if (providerConfig?.providers?.[p.id]?.configured || providerConfig?.demoConnectionsEnabled) openConnect(p.id);
                        else openIntegrationSettings();
                      }}
                    >
                      {providerConfig?.providers?.[p.id]?.configured ? <LockKeyhole className="mr-1 h-3.5 w-3.5" /> : <KeyRound className="mr-1 h-3.5 w-3.5" />}
                      {providerConfig?.providers?.[p.id]?.configured ? "Connect" : "Set up"}
                    </Button>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog
        open={lockDialogOpen}
        onOpenChange={(open) => {
          if (!open && !lockSubmitting) {
            setLockDialogOpen(false);
            setLockPassword("");
            setLockPasswordConfirm("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <DialogTitle>{lockMode === "setup" ? "Set permanent connection password" : "Unlock account connection"}</DialogTitle>
            <DialogDescription>
              {lockMode === "setup"
                ? "Set this password once. Loomic will not provide a normal change, reset, or forgot-password option for this connection lock."
                : "Enter the permanent Owner password to allow one new social-account connection."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {lockMode === "setup" && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
                <strong>Important:</strong> After you save this password it cannot be changed from the Loomic interface. Store it safely.
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{lockMode === "setup" ? "Permanent password" : "Connection password"}</label>
              <input
                type="password"
                autoComplete="new-password"
                value={lockPassword}
                onChange={(event) => setLockPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && lockMode === "unlock" && !lockSubmitting) void submitConnectionLock();
                }}
                placeholder="Minimum 8 characters"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                autoFocus
              />
            </div>
            {lockMode === "setup" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Confirm permanent password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={lockPasswordConfirm}
                  onChange={(event) => setLockPasswordConfirm(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !lockSubmitting) void submitConnectionLock();
                  }}
                  placeholder="Enter the same password again"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={lockSubmitting} onClick={() => setLockDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={lockSubmitting || lockStatusLoading || lockPassword.length < 8 || (lockMode === "setup" && lockPassword !== lockPasswordConfirm)}
              onClick={() => void submitConnectionLock()}
              className="bg-gradient-to-r from-primary to-accent text-white"
            >
              {lockSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
              {lockMode === "setup" ? "Set password & unlock" : "Unlock once"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConnectDialog
        open={connectOpen}
        onClose={() => void closeConnectAndRelock()}
        preselectPlatform={preselectPlatform}
        providerConfig={providerConfig}
        onConfigure={openIntegrationSettings}
        connectionGrant={connectionGrant}
        onGrantConsumed={markGrantConsumed}
      />
    </div>
  );
}

function profileUrl(account: SocialAccount) {
  const handle = account.handle.replace(/^@/, "").replace(/^\//, "");
  switch (account.platform) {
    case "instagram": return `https://www.instagram.com/${handle}/`;
    case "twitter": return `https://x.com/${handle}`;
    case "facebook": return account.externalUserId ? `https://www.facebook.com/${account.externalUserId}` : `https://www.facebook.com/${handle}`;
    case "threads": return `https://www.threads.net/@${handle}`;
    case "pinterest": return `https://www.pinterest.com/${handle}/`;
    case "linkedin": return "https://www.linkedin.com/feed/";
  }
}

/* -------------------------------------------------------------------------- */
/*  Account card                                                               */
/* -------------------------------------------------------------------------- */

function AccountCard({
  account,
  index,
  onDisconnect,
  onRefresh,
}: {
  account: SocialAccount;
  index: number;
  onDisconnect: () => void;
  onRefresh: () => void;
}) {
  const p = PLATFORMS[account.platform];
  const Icon = p.icon;
  const { agencyClients } = useSocialFlow();
  const client = agencyClients.find((item) => item.id === account.clientId);
  const assignedNames = client?.members.map((m) => m.name).filter(Boolean) ?? [];
  const tokenExpiringSoon = account.tokenExpiresAt
    ? new Date(account.tokenExpiresAt).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000
    : false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
    >
      <Card className="group relative overflow-hidden border-border transition-all hover:border-primary/40">
        <div
          className={cn("absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br opacity-15 blur-2xl", p.gradient)}
          aria-hidden
        />
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-soft", p.gradient)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold">{account.displayName}</span>
                {account.isReal ? (
                  <Badge className="bg-success/15 text-success border-success/30 text-[9px] gap-0.5">
                    <Shield className="h-2.5 w-2.5" />
                    REAL
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] text-muted-foreground">DEMO</Badge>
                )}
              </div>
              <div className="truncate text-xs text-muted-foreground">{account.handle}</div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onRefresh}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh stats
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(profileUrl(account), "_blank", "noopener,noreferrer")}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDisconnect}
                className="text-danger focus:text-danger"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <div>
              <div className="font-display text-2xl font-semibold">
                {formatCompact(account.followers)}
              </div>
              <div className="text-xs text-muted-foreground">followers</div>
            </div>
            <Badge variant="secondary" className="gap-1 text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Connected
            </Badge>
          </div>
          {assignedNames.length > 0 && (
            <div className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Assigned team:</span>{" "}
              <span className="font-medium">{assignedNames.join(", ")}</span>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
            <span>Connected {formatDate(account.connectedAt)}</span>
            {tokenExpiringSoon && (
              <span className="flex items-center gap-1 text-warning">
                <AlertCircle className="h-3 w-3" />
                Token expires soon
              </span>
            )}
          </div>
          {account.isReal && (
            <div className="mt-2 rounded-md bg-success/10 px-2 py-1 text-[10px] text-success">
              ✓ Posts will publish to your real {p.name} account
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

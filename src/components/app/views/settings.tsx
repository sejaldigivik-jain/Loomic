"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  User,
  Building2,
  Key,
  Users as UsersIcon,
  Bell,
  Palette,
  Copy,
  Check,
  Plus,
  Trash2,
  Crown,
  Sun,
  Moon,
  Upload,
  Loader2,
  Lock,
  AlertCircle,
  Download,
  Database,
  RotateCcw,
  Plug,
  ExternalLink,
  Eye,
  EyeOff,
  BrainCircuit,
  FlaskConical,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { authenticatedFetch, useSocialFlow } from "@/lib/store";
import { useTheme } from "next-themes";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { PLATFORM_LIST, PLATFORMS, type PlatformId } from "@/lib/platforms";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "ai", label: "AI Provider", icon: BrainCircuit },
  { id: "team", label: "Team", icon: UsersIcon },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "api", label: "API tokens", icon: Key },
  { id: "password", label: "Password", icon: Lock },
  { id: "data", label: "Data & backup", icon: Database },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/**
 * SettingsView — tabbed settings panel. EVERY change is persisted to
 * the database via real API calls:
 *   • Profile (name, email, bio, image) → PATCH /api/v1/auth/me/profile
 *   • Avatar upload → POST /api/v1/upload
 *   • Password change → PATCH /api/v1/auth/me/password
 *   • Workspace → GET/PATCH /api/v1/workspace
 *   • Notifications → PATCH /api/v1/auth/me/profile (preferences JSON)
 *   • Appearance (theme) → PATCH /api/v1/auth/me/profile + next-themes
 *   • API tokens → GET/POST/DELETE /api/v1/tokens
 */
export function SettingsView() {
  const [section, setSection] = useState<SectionId>("profile");

  useEffect(() => {
    const requested = sessionStorage.getItem("socialflow-settings-section") as SectionId | null;
    sessionStorage.removeItem("socialflow-settings-section");
    if (requested && SECTIONS.some((item) => item.id === requested)) setSection(requested);
  }, []);

  return (
    <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[220px_1fr] lg:p-8">
      <nav className="flex gap-1 overflow-x-auto lg:flex-col">
        {SECTIONS.map((s) => {
          const active = section === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={cn(
                "flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <s.icon className="h-4 w-4" />
              {s.label}
            </button>
          );
        })}
      </nav>

      <motion.div
        key={section}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {section === "profile" && <ProfileSection />}
        {section === "workspace" && <WorkspaceSection />}
        {section === "integrations" && <IntegrationsSection />}
        {section === "ai" && <AIProviderSection />}
        {section === "team" && <TeamSection />}
        {section === "notifications" && <NotificationsSection />}
        {section === "appearance" && <AppearanceSection />}
        {section === "api" && <ApiSection />}
        {section === "password" && <PasswordSection />}
        {section === "data" && <DataSection />}
      </motion.div>
    </div>
  );
}

/* ----------------------------- Profile ----------------------------- */
function ProfileSection() {
  const { user, updateProfile, accessToken } = useSocialFlow();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [image, setImage] = useState<string | null>(user?.image ?? null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local state when user changes (e.g. after restoreSession)
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setBio(user.bio ?? "");
      setImage(user.image ?? null);
    }
  }, [user]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile({ name, email, bio, image });
      toast.success("Profile saved", { description: "Your changes are persisted to the database." });
    } catch (err) {
      toast.error("Failed to save profile", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await authenticatedFetch("/api/v1/upload", {
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message ?? "Upload failed");
      }
      setImage(json.data.url);
      // Immediately persist the image to the user's profile
      await updateProfile({ image: json.data.url });
      toast.success("Profile image updated", { description: "Saved to database." });
    } catch (err) {
      toast.error("Upload failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-lg">Profile</CardTitle>
        <p className="text-sm text-muted-foreground">Update your personal information and avatar. All changes are saved to the database.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 overflow-hidden rounded-full bg-gradient-to-br from-rose-500 to-orange-500 text-lg font-semibold text-white">
            {image ? (
              <img src={image} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                {user?.initials ?? "MC"}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Upload new
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP or GIF. 2MB max.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} className="min-h-[80px]" maxLength={500} />
          <p className="text-xs text-muted-foreground">{bio.length}/500 characters</p>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-primary to-accent text-white"
          >
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ----------------------------- Password ----------------------------- */
function PasswordSection() {
  const { accessToken } = useSocialFlow();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange() {
    setError(null);
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match");
      return;
    }
    setSaving(true);
    try {
      const res = await authenticatedFetch("/api/v1/auth/me/password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message ?? "Failed to change password");
      }
      toast.success("Password changed", { description: "Your new password is now active." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-lg">Change password</CardTitle>
        <p className="text-sm text-muted-foreground">Enter your current password for verification, then choose a new one.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="h-10"
            autoComplete="current-password"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-10"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-10"
              autoComplete="new-password"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Use at least 8 characters. Your password is hashed with PBKDF2 + per-user salt.</p>
        <div className="flex justify-end">
          <Button
            onClick={handleChange}
            disabled={saving || !currentPassword || !newPassword}
            className="bg-gradient-to-r from-primary to-accent text-white"
          >
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Changing…
              </>
            ) : (
              "Change password"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ----------------------------- Workspace ----------------------------- */
function WorkspaceSection() {
  const { accessToken, workspaceId } = useSocialFlow();
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    authenticatedFetch(`/api/v1/workspace?workspaceId=${encodeURIComponent(workspaceId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.workspace) {
          setName(json.data.workspace.name);
          setTimezone(json.data.workspace.timezone);
          setCustomDomain(json.data.workspace.customDomain ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, [accessToken, workspaceId]);

  async function handleSave() {
    setSaving(true);
    try {
      if (!workspaceId) throw new Error("No active workspace");
      const res = await authenticatedFetch(`/api/v1/workspace?workspaceId=${encodeURIComponent(workspaceId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ workspaceId, name, timezone, customDomain }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed to save");
      toast.success("Workspace saved", { description: "Settings persisted to database." });
    } catch (err) {
      toast.error("Failed to save workspace", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-lg">Workspace</CardTitle>
        <p className="text-sm text-muted-foreground">Manage your workspace name, timezone and default settings. Saved to database.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-tz">Timezone</Label>
            <Input id="ws-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="h-10" placeholder="UTC+05:30 · India Standard Time" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ws-domain">Custom domain</Label>
          <Input id="ws-domain" value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="social.yourcompany.com" className="h-10" />
        </div>
        <div className="rounded-lg border border-border bg-card/50 p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Edition</div>
              <div className="text-xs text-muted-foreground">Personal — all features unlocked</div>
            </div>
            <Badge className="bg-gradient-to-r from-primary to-accent text-white">
              <Crown className="mr-1 h-3 w-3" /> Personal
            </Badge>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-primary to-accent text-white">
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ----------------------------- Team ----------------------------- */
function TeamSection() {
  const { setActiveView } = useSocialFlow();
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-lg">Team & approvals</CardTitle>
        <p className="text-sm text-muted-foreground">
          Member roles, invitations, ownership transfer, removals and post approvals are managed in the dedicated Team workspace.
        </p>
      </CardHeader>
      <CardContent>
        <Button
          onClick={() => setActiveView("team")}
          className="bg-gradient-to-r from-primary to-accent text-white"
        >
          <UsersIcon className="mr-1.5 h-4 w-4" />
          Open team management
        </Button>
      </CardContent>
    </Card>
  );
}

/* ----------------------------- Notifications ----------------------------- */
function NotificationsSection() {
  const { accessToken, user } = useSocialFlow();
  const [settings, setSettings] = useState<Record<string, boolean>>({
    postPublished: true,
    postFailed: true,
    comments: true,
    teamActivity: false,
    weeklyDigest: true,
    productUpdates: false,
  });
  const [loaded, setLoaded] = useState(false);

  // Load notification preferences from the API (via /auth/me which returns preferences)
  useEffect(() => {
    if (user?.email) {
      // restoreSession already loaded the user. We can fetch fresh prefs too:
      authenticatedFetch("/api/v1/auth/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((r) => r.json())
        .then((json) => {
          if (json.data?.user?.notifications) {
            setSettings(json.data.user.notifications);
          }
        })
        .finally(() => setLoaded(true));
    }
  }, [accessToken, user?.email]);

  const items: { key: string; label: string; desc: string }[] = [
    { key: "postPublished", label: "Post published", desc: "When a scheduled post goes live" },
    { key: "postFailed", label: "Post failed", desc: "When a post fails to publish" },
    { key: "comments", label: "Comments", desc: "When someone comments on your post" },
    { key: "teamActivity", label: "Team activity", desc: "When teammates publish or edit" },
    { key: "weeklyDigest", label: "Weekly digest", desc: "A Monday morning summary of last week" },
    { key: "productUpdates", label: "Product updates", desc: "New features and changelog" },
  ];

  async function toggle(key: string, value: boolean) {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    // Auto-save to DB
    try {
      const res = await authenticatedFetch("/api/v1/auth/me/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ notifications: newSettings }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success(`${items.find((i) => i.key === key)?.label} ${value ? "enabled" : "disabled"}`, {
        description: "Saved to database.",
      });
    } catch {
      toast.error("Failed to save notification preference");
      // Revert on failure
      setSettings(settings);
    }
  }

  if (!loaded) {
    return (
      <Card className="border-border">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-lg">Notifications</CardTitle>
        <p className="text-sm text-muted-foreground">Choose what we email you about. Changes auto-save to the database.</p>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-3 py-3"
          >
            <div>
              <div className="text-sm font-medium">{item.label}</div>
              <div className="text-xs text-muted-foreground">{item.desc}</div>
            </div>
            <Switch
              checked={settings[item.key] ?? false}
              onCheckedChange={(v) => toggle(item.key, v)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ----------------------------- Appearance ----------------------------- */
function AppearanceSection() {
  const { user, updateProfile, accessToken } = useSocialFlow();
  const { theme, setTheme } = useTheme();
  const currentTheme = theme ?? user?.theme ?? "dark";
  const options = [
    { id: "dark", label: "Dark", desc: "Loomic's signature look", icon: Moon },
    { id: "light", label: "Light", desc: "Clean and bright", icon: Sun },
  ] as const;

  async function handleThemeChange(newTheme: string) {
    setTheme(newTheme);
    try {
      await updateProfile({ theme: newTheme });
      toast.success(`Theme: ${newTheme}`, { description: "Saved to database." });
    } catch {
      // Theme still applied locally even if DB save fails
    }
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-lg">Appearance</CardTitle>
        <p className="text-sm text-muted-foreground">Choose how Loomic looks. Saved to your account.</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleThemeChange(opt.id)}
              className={cn(
                "rounded-xl border p-4 text-left transition-all",
                currentTheme === opt.id
                  ? "border-primary bg-primary/5 shadow-glow"
                  : "border-border hover:border-primary/40"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    opt.id === "dark"
                      ? "bg-gradient-to-br from-slate-800 to-slate-950 text-white"
                      : "bg-gradient-to-br from-slate-100 to-white text-slate-900"
                  )}
                >
                  <opt.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                </div>
              </div>
              {currentTheme === opt.id && (
                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">
                  <Check className="h-3 w-3" /> Active
                </div>
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ----------------------------- API ----------------------------- */
interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  scopes: string;
  createdAt: string;
  lastUsedAt?: string;
  token?: string; // Only present on creation
}

function ApiSection() {
  const { accessToken } = useSocialFlow();
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newTokenName, setNewTokenName] = useState("");
  const [creating, setCreating] = useState(false);

  // Load tokens from DB
  useEffect(() => {
    authenticatedFetch("/api/v1/tokens", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setTokens(json.data);
      })
      .finally(() => setLoading(false));
  }, [accessToken]);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
    toast.success("Copied to clipboard");
  };

  async function handleCreate() {
    if (!newTokenName.trim()) {
      toast.error("Enter a token name");
      return;
    }
    setCreating(true);
    try {
      const res = await authenticatedFetch("/api/v1/tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name: newTokenName.trim(), scopes: "write" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed to create token");
      setTokens([json.data, ...tokens]);
      setNewTokenName("");
      toast.success("Token generated", {
        description: "Copy it now — you won't see it again.",
      });
    } catch (err) {
      toast.error("Failed to create token", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      const res = await authenticatedFetch(`/api/v1/tokens/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to revoke");
      setTokens(tokens.filter((t) => t.id !== id));
      toast.success("Token revoked", { description: "It can no longer be used." });
    } catch {
      toast.error("Failed to revoke token");
    }
  }

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-lg">API tokens</CardTitle>
        <p className="text-sm text-muted-foreground">Use tokens to authenticate API requests and webhooks. Stored hashed in the database.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create new token */}
        <div className="flex gap-2">
          <Input
            placeholder="Token name (e.g. Production webhook)"
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
            className="h-10"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Button
            onClick={handleCreate}
            disabled={creating}
            className="bg-gradient-to-r from-primary to-accent text-white"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="mr-1 h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </div>

        {/* Token list */}
        {tokens.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No API tokens yet. Generate one above to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {tokens.map((t) => (
              <div key={t.id} className="rounded-xl border border-border bg-card/50 p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="mt-1 flex items-center gap-2">
                      {t.token ? (
                        // Show full token only on creation
                        <>
                          <code className="rounded bg-success/10 px-2 py-0.5 text-xs text-success break-all">
                            {t.token}
                          </code>
                          <button onClick={() => copy(t.token!, t.id)} className="flex-shrink-0">
                            {copiedId === t.id ? (
                              <Check className="h-3.5 w-3.5 text-success" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                        </>
                      ) : (
                        <>
                          <code className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {t.prefix}…
                          </code>
                          <span className="text-xs text-muted-foreground">Created {formatDate(t.createdAt)}</span>
                          {t.scopes && (
                            <Badge variant="outline" className="text-[9px] uppercase">{t.scopes}</Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                    onClick={() => handleRevoke(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ----------------------------- Integrations ----------------------------- */
type IntegrationRow = {
  provider: PlatformId;
  configured: boolean;
  source: "workspace" | "environment" | null;
  clientId: string;
  clientIdMasked?: string | null;
  hasSavedSecret: boolean;
  redirectUri: string;
  redirectManaged?: boolean;
  requiresSecret: boolean;
  enabled: boolean;
};

const PROVIDER_PORTALS: Record<PlatformId, string> = {
  instagram: "https://developers.facebook.com/apps/",
  facebook: "https://developers.facebook.com/apps/",
  threads: "https://developers.facebook.com/apps/",
  linkedin: "https://www.linkedin.com/developers/apps",
  twitter: "https://console.x.com/",
  pinterest: "https://developers.pinterest.com/apps/",
};

const PROVIDER_REQUIREMENTS: Record<PlatformId, string> = {
  instagram: "Instagram API with Instagram Login · professional Business/Creator accounts · basic + content publishing",
  facebook: "Facebook Pages · pages_show_list + pages_manage_posts + pages_read_engagement",
  threads: "Meta Threads use case · threads_basic + threads_content_publish + threads_manage_insights",
  linkedin: "Sign In with LinkedIn (OpenID Connect) + Share on LinkedIn · openid + profile + w_member_social",
  twitter: "OAuth 2.0 Authorization Code with PKCE · tweet.read + tweet.write + users.read + offline.access",
  pinterest: "Pinterest OAuth · user_accounts:read + boards:read + pins:read + pins:write",
};

function IntegrationsSection() {
  const { workspaceId, accessToken, setActiveView } = useSocialFlow();
  const [rows, setRows] = useState<IntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<PlatformId | null>(null);
  const [forms, setForms] = useState<Record<string, { clientId: string; clientSecret: string; redirectUri: string }>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});

  async function load() {
    if (!workspaceId || !accessToken) return;
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/v1/integrations?workspaceId=${encodeURIComponent(workspaceId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Could not load integrations");
      const nextRows = (json.data?.providers ?? []) as IntegrationRow[];
      setRows(nextRows);
      setForms(Object.fromEntries(nextRows.map((row) => [row.provider, {
        clientId: row.clientId ?? "",
        clientSecret: "",
        redirectUri: row.redirectUri ?? "",
      }])));
    } catch (err) {
      toast.error("Could not load integrations", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [workspaceId, accessToken]);

  function patchForm(provider: PlatformId, patch: Partial<{ clientId: string; clientSecret: string; redirectUri: string }>) {
    setForms((current) => {
      const existing = current[provider] ?? { clientId: "", clientSecret: "", redirectUri: "" };
      return {
        ...current,
        [provider]: { ...existing, ...patch },
      };
    });
  }

  async function save(provider: PlatformId) {
    if (!workspaceId || !accessToken) return;
    const form = forms[provider];
    if (!form?.clientId.trim()) {
      toast.error("Client ID is required");
      return;
    }
    setSaving(provider);
    try {
      const res = await authenticatedFetch("/api/v1/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          workspaceId,
          provider,
          clientId: form.clientId.trim(),
          clientSecret: form.clientSecret.trim() || undefined,
          redirectUri: form.redirectUri.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Could not save provider credentials");
      toast.success(`${PLATFORMS[provider].name} integration saved`, {
        description: "You can now connect real accounts from the Accounts screen.",
      });
      await load();
    } catch (err) {
      toast.error("Integration save failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setSaving(null);
    }
  }

  async function remove(provider: PlatformId) {
    if (!workspaceId || !accessToken) return;
    if (!window.confirm(`Remove saved ${PLATFORMS[provider].name} developer app credentials for this workspace?`)) return;
    try {
      const res = await authenticatedFetch(`/api/v1/integrations?workspaceId=${encodeURIComponent(workspaceId)}&provider=${provider}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Could not remove credentials");
      toast.success(`${PLATFORMS[provider].name} workspace credentials removed`);
      await load();
    } catch (err) {
      toast.error("Could not remove integration", { description: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  async function copyValue(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  }

  if (loading) {
    return (
      <Card className="border-border"><CardContent className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/15"><Plug className="h-5 w-5 text-primary" /></div>
            <div>
              <div className="text-sm font-semibold">Connect real social accounts</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Loomic needs one developer app per social platform. Add its Client ID and Client Secret here once. After that, every client account can use the normal OAuth Connect button without entering passwords inside Loomic.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {PLATFORM_LIST.map((platform) => {
        const row = rows.find((item) => item.provider === platform.id);
        const form = forms[platform.id] ?? { clientId: "", clientSecret: "", redirectUri: row?.redirectUri ?? "" };
        const Icon = platform.icon;
        const visible = Boolean(showSecret[platform.id]);
        return (
          <Card key={platform.id} className="border-border">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white", platform.gradient)}><Icon className="h-5 w-5" /></div>
                  <div>
                    <CardTitle className="text-base">{platform.name}</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row?.configured ? `Ready for real OAuth${row.source ? ` · ${row.source}` : ""}` : "Developer app credentials required"}
                    </p>
                  </div>
                </div>
                <Badge className={row?.configured ? "border-success/30 bg-success/10 text-success" : ""} variant={row?.configured ? "outline" : "secondary"}>
                  {row?.configured ? "Configured" : "Not configured"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Client ID / App ID</Label>
                  <Input value={form.clientId} onChange={(e) => patchForm(platform.id, { clientId: e.target.value })} placeholder="Paste provider Client ID" />
                </div>
                <div className="space-y-1.5">
                  <Label>{platform.id === "twitter" ? "Client Secret (optional for public client)" : "Client Secret / App Secret"}</Label>
                  <div className="relative">
                    <Input
                      type={visible ? "text" : "password"}
                      value={form.clientSecret}
                      onChange={(e) => patchForm(platform.id, { clientSecret: e.target.value })}
                      placeholder={row?.hasSavedSecret ? "Saved securely — leave blank to keep it" : "Paste provider secret"}
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowSecret((v) => ({ ...v, [platform.id]: !visible }))} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Show or hide secret">
                      {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Provider setup:</span> {PROVIDER_REQUIREMENTS[platform.id]}
              </div>

              <div className="space-y-1.5">
                <Label>OAuth callback / redirect URI</Label>
                <div className="flex gap-2">
                  <Input value={form.redirectUri} readOnly={Boolean(row?.redirectManaged)} onChange={(e) => patchForm(platform.id, { redirectUri: e.target.value })} />
                  <Button type="button" variant="outline" size="icon" onClick={() => void copyValue(form.redirectUri, "Redirect URI")} title="Copy redirect URI"><Copy className="h-4 w-4" /></Button>
                </div>
                <p className="text-[11px] text-muted-foreground">{row?.redirectManaged ? "Auto-detected from the current public tunnel. Copy this exact URL into the provider developer app; do not edit it here." : "Add this exact URL to the provider developer app before testing OAuth."}</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => window.open(PROVIDER_PORTALS[platform.id], "_blank", "noopener,noreferrer")}>
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open developer portal
                  </Button>
                  {row?.source === "workspace" && (
                    <Button type="button" variant="ghost" size="sm" className="text-danger" onClick={() => void remove(platform.id)}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  {row?.configured && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setActiveView("accounts")}>Go to Accounts</Button>
                  )}
                  <Button type="button" size="sm" disabled={saving === platform.id} onClick={() => void save(platform.id)} className="bg-gradient-to-r from-primary to-accent text-white">
                    {saving === platform.id && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    Save integration
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ----------------------------- AI Provider ----------------------------- */
function AIProviderSection() {
  const { workspaceId, accessToken } = useSocialFlow();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [openaiConfigured, setOpenaiConfigured] = useState(false);
  const [mode, setMode] = useState<"local" | "openai">("local");
  const [source, setSource] = useState<string | null>(null);
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-5.6-luna");
  const [showKey, setShowKey] = useState(false);

  async function loadAI() {
    if (!workspaceId || !accessToken) return;
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/v1/ai/config?workspaceId=${encodeURIComponent(workspaceId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Could not load AI settings");
      setOpenaiConfigured(Boolean(json.data?.openaiConfigured));
      setMode(json.data?.mode === "openai" ? "openai" : "local");
      setSource(json.data?.source ?? null);
      setHasSavedKey(Boolean(json.data?.hasSavedKey));
      setModel(json.data?.model ?? "gpt-5.6-luna");
    } catch (err) {
      toast.error("Could not load AI settings", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAI(); }, [workspaceId, accessToken]);

  async function saveAI() {
    if (!workspaceId || !accessToken) return;
    if (mode === "openai" && !apiKey.trim() && !hasSavedKey && source !== "environment") {
      toast.error("OpenAI mode needs an API key");
      return;
    }
    setSaving(true);
    try {
      const res = await authenticatedFetch("/api/v1/ai/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ workspaceId, mode, apiKey: mode === "openai" ? apiKey.trim() || undefined : undefined, model }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Could not save AI settings");
      setApiKey("");
      toast.success(mode === "local" ? "Local Assist enabled" : "OpenAI provider saved", {
        description: mode === "local"
          ? "Loomic will generate writing suggestions locally without making OpenAI API requests."
          : "Caption, rewrite, tone, hashtags and content ideas can now use OpenAI.",
      });
      await loadAI();
    } catch (err) {
      toast.error("AI setup failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setSaving(false);
    }
  }

  async function testAI() {
    if (!workspaceId || !accessToken) return;
    setTesting(true);
    try {
      const res = await authenticatedFetch("/api/v1/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ workspaceId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "AI test failed");
      toast.success(json.data?.provider === "local" ? "Local Assist works" : "OpenAI connection works", { description: json.data?.message ?? `${json.data?.model ?? model} responded successfully.` });
    } catch (err) {
      toast.error("AI test failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setTesting(false);
    }
  }

  async function removeAI() {
    if (!workspaceId || !accessToken) return;
    if (!window.confirm("Remove the saved OpenAI API key for this workspace?")) return;
    try {
      const res = await authenticatedFetch(`/api/v1/ai/config?workspaceId=${encodeURIComponent(workspaceId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Could not remove AI settings");
      setApiKey("");
      toast.success("Workspace AI key removed");
      await loadAI();
    } catch (err) {
      toast.error("Could not remove AI settings", { description: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  if (loading) {
    return <Card className="border-border"><CardContent className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/15"><BrainCircuit className="h-5 w-5 text-primary" /></div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">Loomic AI <Badge variant="outline" className="border-success/30 bg-success/10 text-success">Ready</Badge></div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Local Assist is the free default and now uses context-aware writing patterns for captions, rewrites, hashtags and content ideas. OpenAI is completely optional and is contacted only when you explicitly select OpenAI API mode. Saved keys are encrypted server-side and are never returned to the browser.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader><CardTitle className="text-base">AI connection</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>AI mode</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("local")}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  mode === "local" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">Local Assist</span>
                  <Badge variant="outline" className="border-success/30 bg-success/10 text-success">Free</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Default mode. No paid API, no OpenAI request, and no billing required.</p>
              </button>
              <button
                type="button"
                onClick={() => setMode("openai")}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  mode === "openai" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">OpenAI API</span>
                  <Badge variant="outline">Optional</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Uses your OpenAI developer API key and separate API billing when selected.</p>
              </button>
            </div>
          </div>

          {mode === "openai" && (
            <>
              <div className="space-y-1.5">
                <Label>OpenAI API key</Label>
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={hasSavedKey ? "Saved securely — leave blank to keep existing key" : source === "environment" ? "Using OPENAI_API_KEY from server environment" : "Paste your OpenAI API key"}
                    className="pr-10"
                    autoComplete="off"
                  />
                  <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Show or hide API key">
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">ChatGPT subscriptions and OpenAI API billing are separate. Local Assist does not need either one.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Model</Label>
                <select value={model} onChange={(e) => setModel(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
                  <option value="gpt-5.6-luna">GPT-5.6 Luna — lower cost / high volume</option>
                  <option value="gpt-5.6-terra">GPT-5.6 Terra — balanced</option>
                  <option value="gpt-5.6">GPT-5.6 Sol — highest capability</option>
                </select>
              </div>
            </>
          )}

          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Status: <span className="font-medium text-foreground">{mode === "local" ? "Local Assist active · Free · no API calls" : openaiConfigured ? `OpenAI ready${source ? ` · ${source}` : ""}` : "OpenAI selected · key required"}</span>.
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <div className="flex flex-wrap gap-2">
              {mode === "openai" && <Button type="button" variant="outline" size="sm" onClick={() => window.open("https://platform.openai.com/api-keys", "_blank", "noopener,noreferrer")}><ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Get API key</Button>}
              {mode === "openai" && hasSavedKey && <Button type="button" variant="ghost" size="sm" className="text-danger" onClick={() => void removeAI()}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove key</Button>}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={testing} onClick={() => void testAI()}>{testing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="mr-1.5 h-3.5 w-3.5" />} {mode === "openai" ? "Test OpenAI" : "Test Local Assist"}</Button>
              <Button type="button" size="sm" disabled={saving} onClick={() => void saveAI()} className="bg-gradient-to-r from-primary to-accent text-white">{saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Save AI settings</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ----------------------------- Data & Backup ----------------------------- */
function DataSection() {
  const { exportData, reloadData, posts, accounts } = useSocialFlow();
  const [exporting, setExporting] = useState(false);
  const [reloading, setReloading] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await exportData();
    } finally {
      setExporting(false);
    }
  }

  async function handleReload() {
    setReloading(true);
    try {
      await reloadData();
      toast.success("Data reloaded from database");
    } catch (err) {
      toast.error("Failed to reload", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setReloading(false);
    }
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-lg">Data &amp; backup</CardTitle>
        <p className="text-sm text-muted-foreground">
          Your data is saved to the Loomic database every time you create or edit a post, connect an account, or update your profile. Use the tools below to export a local backup or refresh from the server.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <div className="text-xs font-medium text-muted-foreground">Posts</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{posts.length}</div>
          </div>
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <div className="text-xs font-medium text-muted-foreground">Connected accounts</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{accounts.length}</div>
          </div>
        </div>

        {/* Export */}
        <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card/50 p-4">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Download all data</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Exports your profile, posts, and connected accounts as a JSON file you can keep anywhere.
            </p>
          </div>
          <Button
            onClick={handleExport}
            disabled={exporting}
            variant="outline"
            size="sm"
            className="flex-shrink-0"
          >
            {exporting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
            Download
          </Button>
        </div>

        {/* Reload from server */}
        <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card/50 p-4">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Reload from database</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Discards local changes and re-fetches the latest state from the server.
            </p>
          </div>
          <Button
            onClick={handleReload}
            disabled={reloading}
            variant="outline"
            size="sm"
            className="flex-shrink-0"
          >
            {reloading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Reload
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}

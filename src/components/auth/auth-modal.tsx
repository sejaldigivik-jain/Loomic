"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, User, ArrowRight, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/brand";
import { useSocialFlow, type AuthMode } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AuthModal() {
  const { authMode, setAuthMode, signIn, register } = useSocialFlow();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = authMode !== null;
  const isSignup = authMode === "signup";
  const isForgot = authMode === "forgot";
  const isReset = authMode === "reset";
  const isRecovery = isForgot || isReset;

  useEffect(() => {
    setError(null);
    if (authMode !== "reset") setPassword("");
  }, [authMode]);

  function resetForm() {
    setEmail("");
    setPassword("");
    setName("");
    setError(null);
  }

  function switchMode(mode: AuthMode) {
    setError(null);
    setAuthMode(mode);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (isForgot) {
      if (!email.trim()) return;
      setLoading(true);
      try {
        const res = await fetch("/api/v1/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.toLowerCase().trim() }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "Password reset request failed");
        const devUrl = json.data?.developmentResetUrl as string | undefined;
        if (devUrl) {
          window.location.href = devUrl;
          return;
        }
        toast.success("Check your email", {
          description: "If that address has a Loomic account, a password reset link has been sent.",
        });
        switchMode("login");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Password reset request failed");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isReset) {
      if (password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }
      const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("reset") : null;
      if (!token) {
        setError("This password reset link is missing or invalid");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/v1/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "Password could not be reset");
        window.history.replaceState({}, "", window.location.pathname);
        toast.success("Password updated", { description: "Log in with your new password." });
        resetForm();
        setAuthMode("login");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Password could not be reset");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email || !password) return;
    if (isSignup && !name.trim()) {
      setError("Please enter your name");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      if (isSignup) await register(name.trim(), email.toLowerCase().trim(), password);
      else await signIn(email.toLowerCase().trim(), password);
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      toast.error(isSignup ? "Registration failed" : "Login failed", { description: message });
    } finally {
      setLoading(false);
    }
  }


  const title = isSignup
    ? "Create your account"
    : isForgot
      ? "Reset your password"
      : isReset
        ? "Choose a new password"
        : "Log in to Loomic";
  const description = isSignup
    ? "Create a workspace and start planning content."
    : isForgot
      ? "Enter your account email and we’ll send an expiring reset link."
      : isReset
        ? "Use at least 8 characters for your new password."
        : "Pick up right where you left off.";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={() => setAuthMode(null)} aria-hidden />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative grid w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-soft md:grid-cols-2"
          >
            <div className="relative hidden flex-col justify-between bg-gradient-to-br from-primary/20 via-card to-accent/20 p-8 md:flex">
              <div className="absolute inset-0 mesh-bg opacity-50" aria-hidden />
              <div className="relative">
                <BrandMark className="h-10 w-10" />
                <h2 className="mt-8 font-display text-3xl font-semibold leading-tight tracking-tight">
                  {isRecovery ? "Secure access to your content workspace." : isSignup ? "Start your content streak." : "Welcome back to Loomic."}
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  {isRecovery
                    ? "Reset links expire after 30 minutes and become invalid immediately after the password changes."
                    : isSignup
                      ? "Plan, review, schedule and measure content from one workspace."
                      : "Your calendar, queue, approvals and analytics are exactly where you left them."}
                </p>
              </div>
              <div className="relative space-y-3">
                {["Multi-workspace planning", "Team approvals and permissions", "Real Instagram publishing"].map((t) => (
                  <div key={t} className="flex items-center gap-2 text-sm text-foreground/90">
                    <Sparkles className="h-4 w-4 text-primary" />{t}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative p-6 sm:p-8">
              <button onClick={() => setAuthMode(null)} className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
              <div className="mb-6 md:hidden"><BrandMark className="h-8 w-8" /></div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>

              {error && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className={`${isRecovery ? "mt-6 " : ""}mb-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger`}>
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" /><span>{error}</span>
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className={`${isRecovery ? "mt-6 " : ""}space-y-4`}>
                {isSignup && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full name</Label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="name" type="text" placeholder="Maya Chen" value={name} onChange={(e) => setName(e.target.value)} className="h-11 pl-9" required autoComplete="name" />
                    </div>
                  </div>
                )}

                {!isReset && (
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 pl-9" required autoComplete="email" />
                    </div>
                  </div>
                )}

                {!isForgot && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">{isReset ? "New password" : "Password"}</Label>
                      {authMode === "login" && (
                        <button type="button" className="text-xs text-primary hover:underline" onClick={() => switchMode("forgot")}>Forgot password?</button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 pl-9" required autoComplete={isSignup || isReset ? "new-password" : "current-password"} />
                    </div>
                    {(isSignup || isReset) && <p className="text-[11px] text-muted-foreground">Use at least 8 characters.</p>}
                  </div>
                )}

                <Button type="submit" disabled={loading} className="group h-11 w-full bg-gradient-to-r from-primary to-accent text-white shadow-glow">
                  {loading ? (
                    <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Please wait…</span>
                  ) : (
                    <>{isSignup ? "Create account" : isForgot ? "Send reset link" : isReset ? "Update password" : "Log in"}<ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>
                  )}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {isRecovery ? "Remembered your password?" : isSignup ? "Already have an account?" : "New to Loomic?"}{" "}
                <button type="button" onClick={() => switchMode(isRecovery || isSignup ? "login" : "signup")} className={cn("font-medium text-primary hover:underline")}>
                  {isRecovery || isSignup ? "Log in" : "Create one"}
                </button>
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

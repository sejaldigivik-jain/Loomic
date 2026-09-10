"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { PLATFORMS } from "@/lib/platforms";

const PLATFORM_BENEFITS: Record<string, string[]> = {
  instagram: ["OAuth connection", "Image, video & carousel publishing", "Post analytics sync"],
  facebook: ["Page OAuth connection", "Text & link publishing", "Single-image Page posts"],
  threads: ["OAuth connection", "Text, image & video publishing", "Carousel publishing"],
  linkedin: ["Member OAuth connection", "Text publishing", "Single-image publishing"],
  twitter: ["OAuth 2.0 PKCE", "Text publishing", "Automatic token refresh"],
  pinterest: ["OAuth connection", "Board-aware publishing", "Single-image Pins"],
};

export function Platforms() {
  return (
    <section id="platforms" className="relative py-24 sm:py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.03] to-transparent" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }} className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Provider integrations</span>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Your channels. <span className="text-gradient">One publishing flow.</span>
          </h2>
          <p className="mt-4 text-balance text-lg text-muted-foreground">
            Connect supported provider apps to the same workspace, then tailor each post per channel before scheduling or publishing.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.values(PLATFORMS).map((p, i) => {
            const Icon = p.icon;
            const benefits = PLATFORM_BENEFITS[p.id] ?? [];
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, delay: (i % 3) * 0.08 }} className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/40">
                <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${p.gradient} opacity-10 blur-2xl transition-opacity duration-500 group-hover:opacity-25`} aria-hidden />
                <div className="relative flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${p.gradient} text-white shadow-soft`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-display text-base font-semibold">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.handle}</div>
                  </div>
                </div>
                <ul className="relative mt-4 space-y-2">
                  {benefits.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      {b}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

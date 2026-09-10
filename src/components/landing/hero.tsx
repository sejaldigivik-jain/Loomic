"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles, CheckCircle2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSocialFlow } from "@/lib/store";
import { PLATFORMS } from "@/lib/platforms";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
};

export function Hero() {
  const { setAuthMode } = useSocialFlow();

  return (
    <section className="relative overflow-hidden pt-36 pb-24 sm:pt-44 sm:pb-32">
      <div className="absolute inset-0 mesh-bg" aria-hidden />
      <div className="absolute inset-0 grid-pattern opacity-60" aria-hidden />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div variants={container} initial="hidden" animate="show" className="mx-auto max-w-4xl text-center">
          <motion.div variants={item} className="mb-6 flex justify-center">
            <a href="#features" className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur transition-colors hover:text-foreground">
              <span className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                <Sparkles className="h-3 w-3" /> Loomic
              </span>
              A self-hostable social publishing workspace
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </a>
          </motion.div>

          <motion.h1 variants={item} className="font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Plan. Review.
            <br />
            <span className="text-gradient">Publish with confidence.</span>
          </motion.h1>

          <motion.p variants={item} className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
            Manage social accounts, draft channel-specific content, schedule from one calendar,
            collaborate with approvals, and publish through configured provider integrations.
          </motion.p>

          <motion.div variants={item} className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={() => setAuthMode("signup")} className="group h-12 w-full bg-gradient-to-r from-primary to-accent px-8 text-white shadow-glow transition-transform hover:scale-[1.02] sm:w-auto">
              Create workspace
              <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <Button size="lg" variant="outline" className="h-12 w-full px-6 sm:w-auto" onClick={() => document.getElementById("preview")?.scrollIntoView({ behavior: "smooth" })}>
              <Play className="mr-1.5 h-4 w-4" />
              See the workspace
            </Button>
          </motion.div>

          <motion.ul variants={item} className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {["Server-side scheduling", "Team approvals", "Multiple workspaces"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {t}
              </li>
            ))}
          </motion.ul>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.6 }} className="mt-16 flex flex-wrap items-center justify-center gap-3">
          {Object.values(PLATFORMS).map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.id} className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
                <Icon className={`h-3.5 w-3.5 ${p.color}`} />
                {p.name}
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

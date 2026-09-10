"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSocialFlow } from "@/lib/store";
import { BrandMark } from "@/components/brand";

export function CTA() {
  const { setAuthMode } = useSocialFlow();
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.7 }} className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-accent/15 p-10 sm:p-16">
          <div className="absolute inset-0 mesh-bg opacity-40" aria-hidden />
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gradient-to-br from-primary to-accent opacity-20 blur-3xl" aria-hidden />
          <BrandMark className="absolute -bottom-8 -right-8 h-48 w-48 opacity-[0.06]" />

          <div className="relative mx-auto max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Built for a real production deployment
            </div>
            <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Bring your social workflow
              <br />
              <span className="text-gradient">into one workspace.</span>
            </h2>
            <p className="mt-4 text-balance text-lg text-muted-foreground">
              Create a workspace, invite your team, connect approved provider apps and start planning your publishing calendar.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" onClick={() => setAuthMode("signup")} className="group h-12 bg-gradient-to-r from-primary to-accent px-8 text-white shadow-glow transition-transform hover:scale-[1.02]">
                Create workspace
                <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-6" onClick={() => setAuthMode("login")}>
                Sign in
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

"use client";

import { motion } from "framer-motion";
import {
  CalendarClock,
  Sparkles,
  BarChart3,
  Users,
  LayoutGrid,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { FEATURES } from "@/lib/mock-data";

const ICON_MAP: Record<string, LucideIcon> = {
  CalendarClock,
  Sparkles,
  BarChart3,
  Users,
  LayoutGrid,
  ShieldCheck,
};

/**
 * Features — bento-style grid of the six core product capabilities.
 * Each card animates into view on scroll and lifts on hover.
 */
export function Features() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Everything you need
          </span>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            One platform.{" "}
            <span className="text-gradient">Every workflow.</span>
          </h2>
          <p className="mt-4 text-balance text-lg text-muted-foreground">
            Stop stitching together five different tools. Loomic brings scheduling,
            analytics, AI and team collaboration under one beautifully designed roof.
          </p>
        </motion.div>

        {/* Bento grid */}
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => {
            const Icon = ICON_MAP[feature.icon] ?? Sparkles;
            const isLarge = i === 0 || i === 5;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
                className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/40 hover:shadow-glow ${
                  isLarge ? "lg:col-span-1" : ""
                }`}
              >
                {/* Hover glow */}
                <div
                  className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                  aria-hidden
                />
                <div className="relative">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary ring-1 ring-inset ring-primary/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

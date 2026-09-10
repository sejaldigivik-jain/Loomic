"use client";

import { motion } from "framer-motion";
import { Calendar, BarChart3, Sparkles, CheckCircle2, Clock } from "lucide-react";
import { PLATFORMS } from "@/lib/platforms";

/**
 * ProductPreview — a static, polished mock of the in-app dashboard.
 * Sells the product visually without needing the user to sign in.
 */
export function ProductPreview() {
  return (
    <section id="preview" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto max-w-5xl"
        >
          {/* Glow behind the window */}
          <div
            className="absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[3rem] bg-gradient-to-tr from-primary/20 via-accent/10 to-transparent blur-3xl"
            aria-hidden
          />

          {/* Browser chrome */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <div className="flex items-center gap-2 border-b border-border bg-background/60 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-500/70" />
                <div className="h-3 w-3 rounded-full bg-amber-500/70" />
                <div className="h-3 w-3 rounded-full bg-emerald-500/70" />
              </div>
              <div className="mx-auto flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                app.socialflow.io/dashboard
              </div>
            </div>

            {/* App body */}
            <div className="grid grid-cols-12 gap-0">
              {/* Mini sidebar */}
              <div className="col-span-3 hidden flex-col gap-1 border-r border-border bg-background/40 p-3 sm:flex">
                <div className="mb-3 flex items-center gap-2 px-2">
                  <div className="h-6 w-6 rounded-md bg-gradient-to-br from-primary to-accent" />
                  <span className="text-sm font-semibold">Loomic</span>
                </div>
                {[
                  { icon: BarChart3, label: "Dashboard", active: true },
                  { icon: Sparkles, label: "Composer" },
                  { icon: Calendar, label: "Calendar" },
                  { icon: BarChart3, label: "Analytics" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                      item.active ? "bg-primary/15 text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </div>
                ))}
              </div>

              {/* Main panel */}
              <div className="col-span-12 sm:col-span-9">
                <div className="border-b border-border p-4">
                  <div className="text-sm font-semibold">Good morning, Maya</div>
                  <div className="text-xs text-muted-foreground">Here&apos;s what&apos;s shipping today.</div>
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-3 gap-3 p-4">
                  {[
                    { label: "Followers", value: "103.4k", delta: "+4.2%" },
                    { label: "Reach", value: "284k", delta: "+12.8%" },
                    { label: "Engagement", value: "5.4%", delta: "+0.6%" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-border bg-card/50 p-3">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {stat.label}
                      </div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="font-display text-lg font-semibold">{stat.value}</span>
                        <span className="text-[10px] font-medium text-success">{stat.delta}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Upcoming list */}
                <div className="px-4 pb-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-semibold text-muted-foreground">UPCOMING</div>
                    <div className="text-[10px] text-primary">View all</div>
                  </div>
                  <div className="space-y-2">
                    {[
                      {
                        platform: "linkedin",
                        content: "Q3 product roadmap update",
                        time: "Tomorrow · 2:00 PM",
                      },
                      {
                        platform: "instagram",
                        content: "Behind every viral post",
                        time: "Today · 5:00 PM",
                      },
                      {
                        platform: "twitter",
                        content: "Three signs your strategy needs a reset",
                        time: "Thu · 10:30 AM",
                      },
                    ].map((post) => {
                      const p = PLATFORMS[post.platform as keyof typeof PLATFORMS];
                      const Icon = p.icon;
                      return (
                        <div
                          key={post.content}
                          className="flex items-center gap-3 rounded-lg border border-border bg-card/40 p-2.5"
                        >
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br ${p.gradient}`}
                          >
                            <Icon className="h-3.5 w-3.5 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium">{post.content}</div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="h-2.5 w-2.5" />
                              {post.time}
                            </div>
                          </div>
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

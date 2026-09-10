"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSocialFlow } from "@/lib/store";
import { PLATFORMS } from "@/lib/platforms";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * CalendarView — a monthly grid of the user's scheduled posts. Supports
 * month navigation and shows each post as a colored chip per platform.
 */
export function CalendarView() {
  const {
    posts, setActiveView, setComposerContent, setComposerMedia,
    setComposerScheduledAt, setComposerAccountIds, setComposerEditingId,
  } = useSocialFlow();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const { weeks, monthLabel } = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Convert JS Sunday=0 to Monday=0
    const startWeekday = (firstDay.getDay() + 6) % 7;
    const daysInMonth = lastDay.getDate();

    const cells: { date: Date; inMonth: boolean }[] = [];
    // Previous month tail
    for (let i = startWeekday - 1; i >= 0; i--) {
      cells.push({ date: new Date(year, month, -i), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), inMonth: true });
    }
    // Next month head to fill the last week
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
    }

    const weeks: { date: Date; inMonth: boolean; posts: typeof posts }[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      const week = cells.slice(i, i + 7).map((cell) => {
        const dayPosts = posts.filter((p) => {
          const target = p.scheduledAt ?? p.publishedAt;
          if (!target) return false;
          const td = new Date(target);
          return (
            td.getFullYear() === cell.date.getFullYear() &&
            td.getMonth() === cell.date.getMonth() &&
            td.getDate() === cell.date.getDate()
          );
        });
        return { ...cell, posts: dayPosts };
      });
      weeks.push(week);
    }

    return {
      weeks,
      monthLabel: cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    };
  }, [cursor, posts]);

  const today = new Date();
  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  const prevMonth = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const nextMonth = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  const goToday = () => setCursor(new Date(today.getFullYear(), today.getMonth(), 1));

  const openPost = (post: (typeof posts)[number]) => {
    setComposerContent(post.content);
    setComposerMedia(post.media.map((media) => ({ type: media.type, url: media.url, alt: media.alt })));
    setComposerScheduledAt(post.status === "published" || post.status === "publishing" ? null : (post.scheduledAt ?? null));
    setComposerAccountIds(post.targets.map((target) => target.accountId));
    setComposerEditingId(post.status === "published" || post.status === "publishing" ? null : post.id);
    setActiveView("composer");
  };

  // Count upcoming this month
  const monthPosts = posts.filter((p) => {
    const t = p.scheduledAt ?? p.publishedAt;
    if (!t) return false;
    const d = new Date(t);
    return d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear();
  });

  return (
    <div className="space-y-4 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Content calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {monthPosts.length} post{monthPosts.length === 1 ? "" : "s"} scheduled in {monthLabel}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => setActiveView("composer")}
            className="bg-gradient-to-r from-primary to-accent text-white shadow-glow"
          >
            <Plus className="mr-1 h-4 w-4" />
            New post
          </Button>
        </div>
      </motion.div>

      {/* Month label */}
      <div className="flex items-center justify-center">
        <span className="font-display text-xl font-semibold">{monthLabel}</span>
      </div>

      {/* Calendar grid */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-border bg-background/40">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d[0]}</span>
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="grid grid-cols-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0">
              {week.map((cell, di) => (
                <div
                  key={di}
                  className={cn(
                    "min-h-[88px] border-r border-border p-1.5 last:border-r-0 sm:min-h-[120px] sm:p-2",
                    !cell.inMonth && "bg-background/30",
                    isToday(cell.date) && "bg-primary/5"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                        isToday(cell.date)
                          ? "bg-gradient-to-br from-primary to-accent text-white"
                          : cell.inMonth
                          ? "text-foreground"
                          : "text-muted-foreground/50"
                      )}
                    >
                      {cell.date.getDate()}
                    </span>
                    {cell.posts.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">{cell.posts.length}</span>
                    )}
                  </div>

                  {/* Post chips */}
                  <div className="mt-1 space-y-1">
                    {cell.posts.slice(0, 3).map((post) => {
                      const p = PLATFORMS[post.platforms[0]];
                      const Icon = p.icon;
                      return (
                        <button
                          type="button"
                          key={post.id}
                          onClick={() => openPost(post)}
                          className={cn(
                            "group flex items-center gap-1 rounded-md bg-gradient-to-r px-1.5 py-1 text-[10px] font-medium text-white transition-transform hover:scale-[1.02]",
                            p.gradient
                          )}
                          title={post.content}
                        >
                          <Icon className="h-2.5 w-2.5 flex-shrink-0" />
                          <span className="truncate">
                            {new Date(post.scheduledAt ?? post.publishedAt!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            {" · "}
                            <span className="hidden sm:inline">{post.content.slice(0, 30)}</span>
                            <span className="sm:hidden">{post.content.slice(0, 12)}</span>
                          </span>
                        </button>
                      );
                    })}
                    {cell.posts.length > 3 && (
                      <div className="px-1 text-[10px] text-muted-foreground">
                        +{cell.posts.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="font-medium">Platforms:</span>
        {Object.values(PLATFORMS).map((p) => (
          <div key={p.id} className="flex items-center gap-1.5">
            <div className={cn("h-2.5 w-2.5 rounded-sm bg-gradient-to-br", p.gradient)} />
            {p.name}
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandWordmark } from "@/components/brand";
import { useSocialFlow } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Product", href: "#preview" },
  { label: "Platforms", href: "#platforms" },
];

/**
 * LandingNavbar — sticky, glassy top navigation for the marketing site.
 * Becomes opaque after scrolling past the hero, includes a mobile sheet
 * menu and the primary auth CTAs.
 */
export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { setAuthMode } = useSocialFlow();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={cn(
            "mt-3 flex h-16 items-center justify-between rounded-2xl px-4 transition-all duration-300 sm:px-6",
            scrolled ? "glass shadow-soft" : "border border-transparent bg-transparent"
          )}
        >
          <BrandWordmark />

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden items-center gap-2 md:flex">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAuthMode("login")}
              className="text-muted-foreground hover:text-foreground"
            >
              Log in
            </Button>
            <Button
              size="sm"
              onClick={() => setAuthMode("signup")}
              className="bg-gradient-to-r from-primary to-accent text-white shadow-glow"
            >
              Get started free
            </Button>
          </div>

          {/* Mobile toggle */}
          <button
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mx-4 mt-2 rounded-2xl glass p-4 md:hidden"
          >
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setMobileOpen(false);
                    setAuthMode("login");
                  }}
                >
                  Log in
                </Button>
                <Button
                  onClick={() => {
                    setMobileOpen(false);
                    setAuthMode("signup");
                  }}
                  className="bg-gradient-to-r from-primary to-accent text-white"
                >
                  Get started free
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

"use client";

import { LandingNavbar } from "./navbar";
import { Hero } from "./hero";
import { ProductPreview } from "./product-preview";
import { Features } from "./features";
import { Platforms } from "./platforms";
import { CTA } from "./cta";
import { Footer } from "./footer";

/**
 * LandingPage — the full marketing experience shown to unauthenticated
 * visitors. Composed of every landing section in narrative order.
 *
 * Pricing has been removed — SocialFlow is configured for personal use.
 */
export function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <LandingNavbar />
      <main className="flex-1">
        <Hero />
        <ProductPreview />
        <Features />
        <Platforms />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

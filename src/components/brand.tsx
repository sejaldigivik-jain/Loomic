/**
 * Loomic brand mark — a stylised "flow" glyph built from three
 * overlapping rounded strokes. Used in the navbar, sidebar, auth screen
 * and footer. Keeps a single source of truth for the brand identity.
 */
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-8 w-8", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sf-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4F46E5" />
          <stop offset="0.5" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#EC4899" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#sf-grad)" />
      <path
        d="M9 11.5c2.5-2.5 6-2.5 8.5 0s6 2.5 8.5 0"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M9 16c2.5-2.5 6-2.5 8.5 0s6 2.5 8.5 0"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M9 20.5c2.5-2.5 6-2.5 8.5 0s6 2.5 8.5 0"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <BrandMark className="h-7 w-7" />
      <span className="font-display text-lg font-semibold tracking-tight">Loomic</span>
    </div>
  );
}

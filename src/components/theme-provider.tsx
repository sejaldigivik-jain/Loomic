"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * ThemeProvider — wraps next-themes so we can toggle between SocialFlow's
 * signature dark theme and a clean light theme. We default to dark because
 * that is the brand's primary visual identity, but users can flip it from
 * the topbar or command palette.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

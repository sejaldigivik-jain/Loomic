import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: `output: "standalone"` was removed for Vercel. It is a Docker/
  // self-hosting build mode; Vercel builds and routes the app itself.
  reactStrictMode: true,

  // SocialFlow can be exposed through a temporary Cloudflare Quick Tunnel
  // during local OAuth testing. Next.js 16 blocks unknown development origins
  // unless they are explicitly allowed.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;

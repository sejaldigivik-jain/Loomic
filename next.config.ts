import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,

  // SocialFlow can be exposed through a temporary Cloudflare Quick Tunnel
  // during local OAuth testing. Next.js 16 blocks unknown development origins
  // unless they are explicitly allowed.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;

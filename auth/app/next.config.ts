import path from "node:path";
import { existsSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

const deploymentRoot = existsSync(path.resolve(process.cwd(), ".env"))
  ? process.cwd()
  : path.resolve(process.cwd(), "..");
loadEnvConfig(deploymentRoot);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  turbopack: { root: path.resolve(process.cwd(), "..") },
  transpilePackages: ["@friink/account-switcher", "@friink/onboarding"],
  // The package manifest lives at auth/, while the Next.js source lives at auth/app/.
  // Emit the build artifact at auth/.next so Vercel can discover the routes manifest.
  distDir: "../.next",
  env: {
    NEXT_PUBLIC_AUTH_TRUSTED_ORIGINS: process.env.AUTH_TRUSTED_ORIGINS ?? "",
  },
  async rewrites() {
    return [{ source: "/auth-api/:path*", destination: "/api/auth/:path*" }];
  },
};

export default nextConfig;

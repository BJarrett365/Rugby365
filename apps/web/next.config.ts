import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Avoid Desktop/iCloud sync races that drop `.next/server` manifests.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: [
    "@rugby365/db",
    "@rugby365/commentary",
    "@rugby365/shared",
    "@rugby365/match-spec",
    "@rugby365/match-operator-agent",
    "@rugby365/commentary-research",
    "@rugby365/import-sdk",
  ],
  serverExternalPackages: ["postgres"],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;

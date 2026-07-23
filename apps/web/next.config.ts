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
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.ps-aws.com", pathname: "/**" },
      { protocol: "https", hostname: "d3gbf3ykm8gp5c.cloudfront.net", pathname: "/**" },
      { protocol: "https", hostname: "www.planetrugby.com", pathname: "/**" },
      { protocol: "https", hostname: "planetrugby.com", pathname: "/**" },
      { protocol: "https", hostname: "upload.wikimedia.org", pathname: "/**" },
      { protocol: "https", hostname: "commons.wikimedia.org", pathname: "/**" },
      { protocol: "https", hostname: "en.wikipedia.org", pathname: "/**" },
      { protocol: "https", hostname: "www.rugbypass.com", pathname: "/**" },
      { protocol: "https", hostname: "rugbypass.com", pathname: "/**" },
      { protocol: "https", hostname: "i0.wp.com", pathname: "/**" },
      { protocol: "https", hostname: "i1.wp.com", pathname: "/**" },
      { protocol: "https", hostname: "i2.wp.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Avoid Desktop/iCloud sync races that drop `.next/server` manifests.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  async redirects() {
    return [
      {
        source: "/competitions/tri-nations",
        destination: "/competitions/rugby-championship",
        permanent: true,
      },
      {
        source: "/competitions/tri-nations/:path*",
        destination: "/competitions/rugby-championship/:path*",
        permanent: true,
      },
      {
        source: "/competitions/the-rugby-championship",
        destination: "/competitions/rugby-championship",
        permanent: true,
      },
      {
        source: "/competitions/the-rugby-championship/:path*",
        destination: "/competitions/rugby-championship/:path*",
        permanent: true,
      },
    ];
  },
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
      { protocol: "https", hostname: "d2amyifwht104i.cloudfront.net", pathname: "/**" },
      { protocol: "https", hostname: "www.planetrugby.com", pathname: "/**" },
      { protocol: "https", hostname: "planetrugby.com", pathname: "/**" },
      { protocol: "https", hostname: "upload.wikimedia.org", pathname: "/**" },
      { protocol: "https", hostname: "commons.wikimedia.org", pathname: "/**" },
      { protocol: "https", hostname: "en.wikipedia.org", pathname: "/**" },
      { protocol: "https", hostname: "www.rugbypass.com", pathname: "/**" },
      { protocol: "https", hostname: "rugbypass.com", pathname: "/**" },
      // Player OG / headshots (e.g. eu-cdn.rugbypass.com/og-images/player/…)
      { protocol: "https", hostname: "eu-cdn.rugbypass.com", pathname: "/**" },
      { protocol: "https", hostname: "cdn.rugbypass.com", pathname: "/**" },
      { protocol: "https", hostname: "**.rugbypass.com", pathname: "/**" },
      { protocol: "https", hostname: "i0.wp.com", pathname: "/**" },
      { protocol: "https", hostname: "i1.wp.com", pathname: "/**" },
      { protocol: "https", hostname: "i2.wp.com", pathname: "/**" },
      // Alamy licensed editorial (c7/c8 zoom comps, static assets)
      { protocol: "https", hostname: "**.alamy.com", pathname: "/**" },
      { protocol: "https", hostname: "c7.alamy.com", pathname: "/**" },
      { protocol: "https", hostname: "c8.alamy.com", pathname: "/**" },
      // Official SA Rugby / Springboks player headshots
      { protocol: "https", hostname: "media-cdn.cortextech.io", pathname: "/**" },
      { protocol: "https", hostname: "springboks.rugby", pathname: "/**" },
      // Rugby365 live (oguq…; former 365 Shared). Empty duplicate abmap… is not the rugby DB.
      {
        protocol: "https",
        hostname: "oguqhyggjbefrhzdxomk.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;

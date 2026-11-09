import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The Google client ID is public (it's in every OAuth URL); One Tap needs it in the browser.
  env: { NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "" },
  partialPrefetching: true,
  experimental: {
    // Turbopack's saved dev cache (.next/dev/cache) made pages reload themselves
    // in a loop after a few dev-server restarts (Next 16.4.5). Rebuilding from
    // scratch on each start is a little slower but stable.
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

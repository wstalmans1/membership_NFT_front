import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Suppress hydration warnings - they're harmless and caused by Next.js Link components
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  // Disable static optimization to reduce hydration mismatches
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;

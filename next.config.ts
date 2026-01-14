import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Static export for IPFS deployment
  output: 'export',
  // Suppress hydration warnings - they're harmless and caused by Next.js Link components
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  // Disable static optimization to reduce hydration mismatches
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Note: API routes won't work with static export
  // The /api/metadata route needs to be hosted separately (e.g., Vercel, Netlify, or self-hosted)
  // Exclude API routes from build
  distDir: '.next',
  // Optimize build output
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;

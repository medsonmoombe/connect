import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  turbopack: {},
  serverExternalPackages: [
    'ioredis',
    '@upstash/ratelimit',
    '@upstash/redis',
  ],
};

export default nextConfig;

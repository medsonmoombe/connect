/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.storage',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://*.supabase.storage https://api.resend.com https://*.googleapis.com https://*.generativeai.google; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },

  // Production optimizations
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // Standalone output: ~85% smaller deploy artifact for the Docker image
  // (server.js + pruned node_modules). Required by the existing Dockerfile.
  output: 'standalone',

  // Strip routine console.* from production bundles (keeps error/warn so
  // Sentry-style capture and server diagnostics keep working).
  compiler: process.env.NODE_ENV === 'production'
    ? { removeConsole: { exclude: ['error', 'warn'] } }
    : undefined,
};

module.exports = nextConfig;

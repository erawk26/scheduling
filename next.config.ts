import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  turbopack: {},
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],

  reactStrictMode: true,

  poweredByHeader: false,

  compress: true,

  experimental: {
    typedRoutes: true,
  },

  // Headers for PWA and security
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ]
  },
}

export default nextConfig

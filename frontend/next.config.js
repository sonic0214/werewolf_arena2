/** @type {import('next').NextConfig} */
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https: blob:;
  font-src 'self' data:;
  connect-src 'self' https://werewolf-arena-backend.fly.dev https://werewolf-arena.onrender.com http://localhost:8000 http://localhost:3000 ws://localhost:8000 ws://localhost:3000 wss://werewolf-arena-backend.fly.dev wss://werewolf-arena.onrender.com;
  frame-ancestors 'none';
`.replace(/\s{2,}/g, ' ').trim();

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://werewolf-arena-backend.fly.dev';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  // Enable standalone output for Docker
  output: 'standalone',
  // Optimize for production deployment
  compress: true,
  poweredByHeader: false,
  // Disable experimental features for production stability
  experimental: {
    serverComponentsExternalPackages: [],
  },
  // Environment variables with production fallbacks
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV === 'production' ? 'https://werewolf-arena-backend.fly.dev' : 'http://localhost:8000'),
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL ||
      (process.env.NODE_ENV === 'production' ? 'wss://werewolf-arena-backend.fly.dev' : 'ws://localhost:8000'),
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
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
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: ContentSecurityPolicy,
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

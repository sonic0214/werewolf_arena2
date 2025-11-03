import type { NextConfig } from 'next';

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https://werewolf-arena-backend.fly.dev https://werewolf-arena.onrender.com http://localhost:8000 http://localhost:3000 ws://localhost:8000 ws://localhost:3000 wss://werewolf-arena-backend.fly.dev wss://werewolf-arena.onrender.com;
  frame-ancestors 'none';
`.replace(/\s{2,}/g, ' ').trim();

const nextConfig: NextConfig = {
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
  output: 'standalone',
  compress: true,
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: [],
  },
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://werewolf-arena-backend.fly.dev'
        : 'http://localhost:8000'),
    NEXT_PUBLIC_WS_URL:
      process.env.NEXT_PUBLIC_WS_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'wss://werewolf-arena-backend.fly.dev'
        : 'ws://localhost:8000'),
  },
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

export default nextConfig;

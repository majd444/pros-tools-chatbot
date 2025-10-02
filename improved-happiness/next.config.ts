import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    // Lint locally, but don't fail the CI/production build on lint errors
    ignoreDuringBuilds: true,
  },
  images: {
    domains: [
      's.w.org',
      'upload.wikimedia.org',
      'assets-global.website-files.com',
      'example.com' // Add any other domains you need
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/chat/widget/:path*',
        destination: 'https://superb-eagle-611.convex.cloud/api/chat/widget/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/api/chat/widget/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

export default nextConfig;

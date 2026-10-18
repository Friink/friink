import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@friink/auth-ui'],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Vercel treats `auth/` as the project root, while the Next app source lives
  // in `auth/app/`. Keep the build artifact at the Vercel-expected location.
  distDir: '../.next',
  transpilePackages: ['@friink/auth-ui'],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

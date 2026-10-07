/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow the platform preview domain(s) to hit the dev server.
  allowedDevOrigins: [
    '.monkeycode-ai.live',
    '*.monkeycode-ai.live',
    '.monkeycode-ai.online',
    '*.monkeycode-ai.online',
  ],
  experimental: {
    // Lightweight-charts is ESM-only; transpile it for the server bundle too.
    optimizePackageImports: ['lightweight-charts'],
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // This is the crucial line for Docker optimization
  async rewrites() {
    // At build-time inside Docker, GATEWAY_URL is not available, so we
    // rely on the run-time value.  Next.js standalone mode evaluates
    // rewrites at startup, so the env var just needs to be present when
    // the container boots.
    const gateway = process.env.GATEWAY_URL || 'http://gateway:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${gateway}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
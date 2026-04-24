/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // This is the crucial line for Docker optimization
};

module.exports = nextConfig;
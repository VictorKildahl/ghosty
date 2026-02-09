/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  assetPrefix: './',
  reactStrictMode: true,
  images: {
    unoptimized: true
  }
};

module.exports = nextConfig;

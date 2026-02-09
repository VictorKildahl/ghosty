import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  assetPrefix: "./",
  reactStrictMode: true,
  reactCompiler: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

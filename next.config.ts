import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    domains: ["images.unsplash.com"],
  },
};

export default nextConfig;

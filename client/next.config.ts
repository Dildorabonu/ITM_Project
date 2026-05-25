import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  allowedDevOrigins: [
    "localhost:3000",
  ],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.30.55",
    "192.168.30.55:3000",
    "localhost:3000",
  ],
};

export default nextConfig;

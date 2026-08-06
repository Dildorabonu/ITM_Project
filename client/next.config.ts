import type { NextConfig } from "next";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:5223";

const nextConfig: NextConfig = {
  output: "standalone",
  productionBrowserSourceMaps: false,
  allowedDevOrigins: [
    "localhost:3000",
    "192.168.30.16:3000",
    // Vaqtinchalik Cloudflare Quick Tunnel demo havolasi uchun
    "*.trycloudflare.com",
    "loans-investigator-flip-bowling.trycloudflare.com",
  ],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${BACKEND}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;

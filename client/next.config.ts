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
  // Xavfsizlik headerlari — barcha javoblar uchun. CSP bu yerda emas,
  // middleware.ts da beriladi, chunki u har bir so'rov uchun alohida nonce talab qiladi.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
          },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        ],
      },
    ];
  },
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

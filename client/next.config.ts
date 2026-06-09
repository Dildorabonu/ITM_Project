import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  // Dev faqat localhost'da ishlaydi (package.json: next dev -H localhost),
  // shuning uchun LAN origin'lari kerak emas. localhost default ruxsat etilgan.
  allowedDevOrigins: ["localhost:3000"],
};

export default nextConfig;

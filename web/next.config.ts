import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // تحديد root directory لـ Turbopack لتفادي الالتباس مع lockfile الجذر
  turbopack: {
    root: __dirname,
  },
  // رفع حد حجم طلب Server Actions من الافتراضي (1MB) — يسمح برفع عدة صور دفعة واحدة
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;

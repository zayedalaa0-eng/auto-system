import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // تحديد root directory لـ Turbopack لتفادي الالتباس مع lockfile الجذر
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

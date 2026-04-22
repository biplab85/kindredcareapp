import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Repo root has a package-lock.json (husky + lint-staged) that confuses
  // Turbopack's workspace inference, breaking `next dev`. Pin the root to
  // this app's folder explicitly.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

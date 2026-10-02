import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hostinger (and other Node hosts) deploy the self-contained server in .next/standalone
  output: "standalone",
};

export default nextConfig;

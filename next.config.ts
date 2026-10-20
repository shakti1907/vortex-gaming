import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* the sandbox live-preview proxy serves the dev build from this host */
  allowedDevOrigins: ["*.e2b.app"],
};

export default nextConfig;

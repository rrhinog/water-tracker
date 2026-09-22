import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output: the Docker image ships only what server.js needs.
  output: "standalone",
};

export default nextConfig;

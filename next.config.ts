import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: [
    "@anthropic-ai/claude-agent-sdk",
    "@composio/core",
  ],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle in .next/standalone, which is what you
  // copy into a container or an EC2 AMI for the public-subnet tier.
  output: "standalone",
  // Don't generate AGENTS.md / CLAUDE.md into the repo on every dev start.
  agentRules: false,
  /* config options here */
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@langchain/core",
    "@langchain/openai",
    "@langchain/textsplitters",
    "langsmith",
  ],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: [
    "@langchain/core",
    "@langchain/openai",
    "@langchain/textsplitters",
    "langsmith",
    "mammoth",
    "pdf-parse",
  ],
};

export default nextConfig;

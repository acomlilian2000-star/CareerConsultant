import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

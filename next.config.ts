import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@resvg/resvg-js", "sharp", "fontkit"],
};

export default nextConfig;

import type { NextConfig } from "next";

const imageRemotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
  {
    protocol: "http",
    hostname: "localhost",
    port: "4000",
    pathname: "/uploads/**",
  },
  {
    protocol: "https",
    hostname: "ellyshop-backend.onrender.com",
    pathname: "/uploads/**",
  },
];

if (process.env.NEXT_PUBLIC_ASSET_BASE_URL) {
  try {
    const assetUrl = new URL(process.env.NEXT_PUBLIC_ASSET_BASE_URL);
    imageRemotePatterns.push({
      protocol: assetUrl.protocol.replace(":", "") as "http" | "https",
      hostname: assetUrl.hostname,
      port: assetUrl.port,
      pathname: "/uploads/**",
    });
  } catch {
    // Ignore invalid URLs and keep default patterns.
  }
}

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: imageRemotePatterns,
  },
};

export default nextConfig;

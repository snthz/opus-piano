import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sitio 100 % estático: se puede servir desde cualquier hosting o carpeta.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;

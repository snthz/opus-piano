import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Servidor Node en Docker: hacen falta rutas de API (progreso en Postgres, transcripción).
  output: "standalone",
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;

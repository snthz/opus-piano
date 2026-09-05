import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Servidor Node en Docker: hacen falta rutas de API (cuentas y progreso en Postgres).
  output: "standalone",
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;

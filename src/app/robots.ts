import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

/**
 * Se bloquea lo que no aporta nada en un buscador: la API, las páginas con
 * datos del propio usuario (partituras, ajustes, cuenta) y la de «sin conexión»,
 * que es un sustituto vacío del contenido real.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/scores", "/settings", "/account", "/offline"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/").replace(/\/$/, ""),
  };
}

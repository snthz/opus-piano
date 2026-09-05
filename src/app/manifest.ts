import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Opus Piano — Aprende a leer partituras",
    short_name: "Opus Piano",
    description:
      "Aprende solfeo, claves, notas, compases y símbolos de la partitura. Guarda tus partituras en tu teléfono y practica sin conexión.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f3f6",
    theme_color: "#f3f3f6",
    lang: "es",
    dir: "ltr",
    categories: ["education", "music"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    // Sin barra final: con ella el navegador se come una redirección en cada arranque.
    shortcuts: [
      { name: "Práctica de notas", url: "/practice/notes" },
      { name: "Mis partituras", url: "/scores" },
      { name: "Guía para leer partituras", url: "/guide" },
    ],
  };
}

import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/seo";

export const alt = "Opus Piano — aprende a leer partituras y a tocar el piano";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Imagen que se ve al compartir el enlace en WhatsApp, X, Telegram o Slack.
 * Sin ella, el enlace aparece como una tarjeta gris y se comparte mucho menos.
 *
 * Se dibuja con Satori (`next/og`), que solo entiende flexbox y un subconjunto
 * de CSS: nada de grid, y las fuentes .woff2 de Bravura no se pueden cargar,
 * por eso el pentagrama se dibuja con rectángulos.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #f6f5f2 0%, #e9e6f5 55%, #dfeee8 100%)",
          fontFamily: "sans-serif",
          color: "#17171a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 999,
              background: "#17171a",
              color: "#f6f5f2",
              fontSize: 38,
              fontWeight: 700,
            }}
          >
            ♪
          </div>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: -0.5 }}>{SITE_NAME}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 78, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2.5 }}>
            Aprende a leer partituras
          </div>
          <div style={{ fontSize: 78, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2.5 }}>
            y a tocar el piano
          </div>
          <div style={{ marginTop: 26, fontSize: 33, color: "#55555f", lineHeight: 1.35 }}>
            Solfeo, claves, figuras, compases y símbolos · Ejercicios interactivos · Gratis y sin conexión
          </div>
        </div>

        {/* Pentagrama decorativo: cinco líneas de 4 px separadas 18 px. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ width: "100%", height: 4, background: "#17171a", opacity: 0.16 }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}

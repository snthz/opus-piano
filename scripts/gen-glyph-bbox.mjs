/**
 * Genera src/data/smufl-bbox.ts: la caja real de tinta de cada glifo SMuFL.
 *
 * Los glifos SMuFL se dibujan sobre una línea base situada en el centro del
 * pentagrama, y cada uno sobresale por arriba y por abajo de forma muy distinta
 * (la clave de sol es enorme, una cabeza de nota es diminuta). Por eso centrar
 * la *caja de texto* nunca centra el *dibujo*. Midiendo la caja real podemos
 * recortar el glifo exactamente y centrarlo en cualquier contenedor.
 *
 * Se mide con la misma Bravura.woff2 que sirve la app, en Chrome sin interfaz.
 * El resultado se commitea: `bun run build` no necesita navegador.
 * Regenerar con: bun run gen:bbox
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { SMUFL } from "../src/data/smufl-codepoints.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fontB64 = readFileSync(join(root, "public", "fonts", "bravura", "Bravura.woff2")).toString("base64");

const EM = 1000; // se mide a 1000px y se normaliza a unidades em

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
await page.setContent(`<!doctype html><meta charset="utf-8">
<style>
  @font-face {
    font-family: "BravuraMeasure";
    src: url("data:font/woff2;base64,${fontB64}") format("woff2");
  }
  body { margin: 0 }
</style>`);

await page.evaluate(async () => {
  await document.fonts.load("1000px BravuraMeasure");
  await document.fonts.ready;
});

const entries = Object.entries(SMUFL);
const { out: boxes, adv: advances } = await page.evaluate(
  ({ entries, EM }) => {
    // measureText da la caja de tinta real (actualBoundingBox*), no la de maquetado:
    // getBBox() sobre <text> devolvería el alto de línea, igual para todos los glifos.
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.font = `${EM}px BravuraMeasure`;
    ctx.textBaseline = "alphabetic";
    const out = {};
    const adv = {};
    for (const [name, char] of entries) {
      const m = ctx.measureText(char);
      const left = -m.actualBoundingBoxLeft;
      const top = -m.actualBoundingBoxAscent;
      const width = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      const height = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      const r = (v) => Math.round((v / EM) * 10000) / 10000;
      if (width > 0 && height > 0) {
        out[name] = [r(left), r(top), r(width), r(height)];
        // Avance: hace falta para componer varios glifos seguidos (p. ej. nota + puntillo).
        adv[name] = r(m.width);
      }
    }
    return { out, adv };
  },
  { entries, EM },
);
await browser.close();

const missing = entries.filter(([n]) => !boxes[n]).map(([n]) => n);
if (missing.length) console.warn(`Sin caja (glifo vacío en la fuente): ${missing.join(", ")}`);

const sorted = Object.keys(boxes).sort();
const boxLines = sorted.map((n) => `  ${n}: [${boxes[n].join(", ")}],`);
const advLines = sorted.map((n) => `  ${n}: ${advances[n]},`);

writeFileSync(
  join(root, "src", "data", "smufl-bbox.ts"),
  `// Generado por scripts/gen-glyph-bbox.mjs — no editar a mano.
// Caja de tinta de cada glifo en unidades em, medida sobre Bravura.woff2:
// [x, y, ancho, alto], con la línea base en y = 0 e y creciendo hacia abajo.
export const GLYPH_BBOX: Record<string, [number, number, number, number]> = {
${boxLines.join("\n")}
};

// Avance horizontal de cada glifo, en em: la distancia que se desplaza el
// cursor al dibujarlo. Necesario para componer varios glifos seguidos.
export const GLYPH_ADVANCE: Record<string, number> = {
${advLines.join("\n")}
};
`,
);
console.log(`smufl-bbox.ts: ${sorted.length} cajas`);

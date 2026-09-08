/**
 * Genera todos los íconos de la app a partir del logotipo de `src/lib/brand.ts`:
 *
 *   src/app/icon.svg                 favicon SVG (Chrome, Firefox, Edge), cambia de color en modo oscuro
 *   src/app/favicon.ico              favicon clásico (16, 32 y 48 px) para el resto
 *   src/app/apple-icon.png           ícono de pantalla de inicio en iOS (180 px, sin esquinas: iOS las recorta)
 *   public/icons/icon-192.png        íconos del manifiesto (esquinas redondeadas)
 *   public/icons/icon-512.png
 *   public/icons/icon-maskable-512.png  a sangre, con el logo dentro de la zona segura de Android
 *   public/icons/icon.svg            versión vectorial para el manifiesto
 *
 * Uso: bun run gen:icons   (o `node scripts/gen-icons.mjs`; necesita Node ≥ 22.18 para importar el .ts)
 * Los archivos se versionan: solo hace falta volver a ejecutarlo al cambiar el logo.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { BRAND_COLORS, LOGO_MARK_PATH, LOGO_MARK_VIEWBOX } from "../src/lib/brand.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = (p) => path.join(root, p);

/** El logotipo solo, transparente; `color` es el relleno. */
function markSvg({ color, size = 32, darkColor }) {
  const style = darkColor
    ? `<style>path{fill:${color}}@media (prefers-color-scheme:dark){path{fill:${darkColor}}}</style>`
    : "";
  const fill = darkColor ? "" : ` fill="${color}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO_MARK_VIEWBOX}" width="${size}" height="${size}">${style}<path fill-rule="evenodd"${fill} d="${LOGO_MARK_PATH}"/></svg>`;
}

/**
 * Baldosa con fondo: el logo ocupa `scale` del lado (el disco, 0.875·scale).
 * `radius` redondea las esquinas; con 0 la baldosa va a sangre.
 */
function tileSvg({ size, scale, radius }) {
  const mark = size * scale;
  const offset = (size - mark) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BRAND_COLORS.tile}"/>
  <svg x="${offset}" y="${offset}" width="${mark}" height="${mark}" viewBox="${LOGO_MARK_VIEWBOX}">
    <path fill="${BRAND_COLORS.ink}" fill-rule="evenodd" d="${LOGO_MARK_PATH}"/>
  </svg>
</svg>
`;
}

const png = (svg, size) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toBuffer();

/** Empaqueta PNG en un .ico (formato que entienden todos los navegadores desde hace 15 años). */
function ico(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo: ícono
  header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = header.length + dir.length;
  entries.forEach(({ size, buf }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2); // sin paleta
    dir.writeUInt8(0, o + 3); // reservado
    dir.writeUInt16LE(1, o + 4); // planos
    dir.writeUInt16LE(32, o + 6); // bits por píxel
    dir.writeUInt32LE(buf.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += buf.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.buf)]);
}

await mkdir(out("public/icons"), { recursive: true });

// Favicon: el logo suelto, negro en claro y blanco en oscuro.
await writeFile(out("src/app/icon.svg"), markSvg({ color: BRAND_COLORS.ink, darkColor: BRAND_COLORS.inkDark }) + "\n");

// favicon.ico: el logo suelto en tinta sobre transparente.
const plain = markSvg({ color: BRAND_COLORS.ink });
await writeFile(
  out("src/app/favicon.ico"),
  ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, buf: await png(plain, size) })))),
);

// Apple: a sangre (iOS redondea) y el logo algo más grande porque no hay zona segura.
await writeFile(out("src/app/apple-icon.png"), await png(tileSvg({ size: 180, scale: 0.8, radius: 0 }), 180));

// Manifiesto: esquinas redondeadas (≈22 %, como iOS) y el logo al 75 %.
const rounded = (size) => tileSvg({ size, scale: 0.75, radius: size * 0.22 });
await writeFile(out("public/icons/icon-192.png"), await png(rounded(192), 192));
await writeFile(out("public/icons/icon-512.png"), await png(rounded(512), 512));
await writeFile(out("public/icons/icon.svg"), rounded(512));

// Maskable: a sangre y el logo dentro del círculo seguro (80 % del lado).
await writeFile(
  out("public/icons/icon-maskable-512.png"),
  await png(tileSvg({ size: 512, scale: 0.75, radius: 0 }), 512),
);

console.log("Íconos generados en src/app y public/icons");

/**
 * Copia el worker de pdf.js a public/ para que se sirva desde el mismo origen.
 * Se usa la variante «legacy»: la moderna da por hechas cosas que Safari solo
 * trae desde 17.4 (Promise.withResolvers, Uint8Array.toBase64…), y en un iPad
 * con iPadOS 16/17 el PDF se quedaba en gris sin ningún aviso. El worker tiene
 * que ser de la misma versión que la librería, así que se copia en cada build.
 */
import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.min.mjs");
const dest = join(root, "public", "pdf.worker.min.mjs");
copyFileSync(src, dest);
console.log("pdf.worker.min.mjs: copiado (legacy)");

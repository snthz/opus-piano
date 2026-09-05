/**
 * Genera src/data/smufl-codepoints.ts con los puntos de código de los glifos SMuFL
 * que usa la app. Los nombres se extraen del código fuente (glyph: "…", noteGlyph: "…",
 * restGlyph: "…", extraGlyphs: [...] y <Glyph name="…"> / <GlyphIcon name="…">).
 *
 * Fuente de datos: metadata oficial de SMuFL (W3C Music Notation Community Group).
 * Se cachea en node_modules/.cache/smufl/glyphnames.json.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = join(root, "node_modules", ".cache", "smufl");
const cacheFile = join(cacheDir, "glyphnames.json");
const URL = "https://raw.githubusercontent.com/w3c/smufl/gh-pages/metadata/glyphnames.json";

async function loadGlyphNames() {
  if (existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, "utf8"));
  let res;
  try {
    res = await fetch(URL);
  } catch (e) {
    // Sin red (p. ej. en una build de Docker aislada): vale el archivo ya generado y commiteado.
    if (existsSync(join(root, "src", "data", "smufl-codepoints.ts"))) {
      console.warn("smufl-codepoints.ts: sin red, se conserva el archivo existente");
      process.exit(0);
    }
    throw e;
  }
  if (!res.ok) throw new Error(`No se pudo descargar ${URL}: ${res.status}`);
  const text = await res.text();
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cacheFile, text);
  return JSON.parse(text);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p) && !p.endsWith("smufl-codepoints.ts")) out.push(p);
  }
  return out;
}

const used = new Set();
for (const file of walk(join(root, "src"))) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/\b(?:glyph|noteGlyph|restGlyph)\s*:\s*"([A-Za-z0-9]+)"/g)) used.add(m[1]);
  for (const m of src.matchAll(/extraGlyphs\s*:\s*\[([^\]]*)\]/g)) {
    for (const n of m[1].matchAll(/"([A-Za-z0-9]+)"/g)) used.add(n[1]);
  }
  for (const m of src.matchAll(/<Glyph(?:Icon)?\b[^>]*\bname="([A-Za-z0-9]+)"/g)) used.add(m[1]);
  for (const m of src.matchAll(/\bsmufl\(\s*"([A-Za-z0-9]+)"\s*\)/g)) used.add(m[1]);
}

const names = await loadGlyphNames();
const missing = [...used].filter((n) => !names[n]);
if (missing.length) {
  console.error("Glifos SMuFL desconocidos:", missing.join(", "));
  process.exit(1);
}

const sorted = [...used].sort();
const lines = sorted.map((n) => {
  const cp = names[n].codepoint.replace("U+", "");
  return `  ${n}: "\\u{${cp}}", // ${names[n].description}`;
});

const out = `// Generado por scripts/gen-smufl.mjs — no editar a mano.
// Puntos de código SMuFL (https://w3c.github.io/smufl/) de los glifos usados en la app.
export const SMUFL: Record<string, string> = {
${lines.join("\n")}
};

export function smufl(name: string): string {
  const cp = SMUFL[name];
  if (!cp) throw new Error(\`Glifo SMuFL no incluido: \${name}. Ejecuta bun run gen:smufl\`);
  return cp;
}
`;
writeFileSync(join(root, "src", "data", "smufl-codepoints.ts"), out);
console.log(`smufl-codepoints.ts: ${sorted.length} glifos`);

/**
 * Genera public/sw.js a partir de scripts/sw-template.js, sustituyendo
 * __VERSION__ por un hash del código fuente. Así cada compilación con
 * cambios reales invalida la caché anterior y la app se actualiza sola.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|css)$/.test(p)) out.push(p);
  }
  return out;
}

const hash = createHash("sha256");
for (const file of walk(join(root, "src")).sort()) hash.update(readFileSync(file));
hash.update(readFileSync(join(root, "scripts", "sw-template.js")));
const version = hash.digest("hex").slice(0, 12);

const template = readFileSync(join(root, "scripts", "sw-template.js"), "utf8");
writeFileSync(join(root, "public", "sw.js"), template.replace(/__VERSION__/g, version));
console.log(`sw.js: etude-${version}`);

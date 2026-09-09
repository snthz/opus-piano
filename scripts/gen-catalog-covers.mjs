/**
 * Portadas del catálogo: la primera página de cada partitura, grabada de
 * verdad y guardada como JPEG en `public/catalog/covers/<id>.jpg`.
 *
 * Las tarjetas del catálogo enseñan la partitura, no un icono, así que la
 * portada tiene que ser la página tal y como se imprimiría: título, autor,
 * indicación de tempo, ligaduras, matices y digitaciones. Eso lo hace
 * Verovio, un grabador de partituras de verdad (el mismo que usan las
 * bibliotecas digitales), a partir del mismo .mxl que luego suena en la app.
 *
 * Se generan aquí y se suben al repositorio: el servidor de producción no
 * tiene ni Verovio ni un navegador, y una portada que no cambia nunca no
 * tiene por qué calcularse en cada despliegue.
 *
 *   bun run gen:covers            # todas las que falten
 *   bun run gen:covers --force    # todas otra vez
 *
 * Necesita Chrome o Brave instalados (solo para pasar el SVG a JPEG).
 */
import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalogDir = join(root, "public", "catalog");
const coversDir = join(catalogDir, "covers");

/** Tamaño de la portada, 3:4 como la caja de la tarjeta. */
const WIDTH = 900;
const HEIGHT = 1200;
/** JPEG: a este tamaño la diferencia con 85 no se ve y pesa un tercio menos. */
const QUALITY = 74;

/**
 * Escalas a probar, de menor a mayor. Una pieza larga llena la página con la
 * primera; una de dieciséis compases se quedaría a media página, y ahí una
 * escala mayor reparte los mismos compases en más sistemas hasta llenarla,
 * que es justo lo que hace una edición impresa de una pieza corta.
 */
const SCALES = [42, 52, 64, 78];
/** Se da por buena la primera escala que llene esta parte de la página. */
const FILL = 0.8;

const CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => existsSync(p));

const force = process.argv.includes("--force");

async function main() {
  if (!CHROME) {
    console.error("No se ha encontrado Chrome ni Brave; hacen falta para pasar el SVG a JPEG.");
    process.exit(1);
  }
  const ids = readdirSync(catalogDir)
    .filter((f) => f.endsWith(".mxl"))
    .map((f) => f.replace(/\.mxl$/, ""))
    .sort();
  if (!ids.length) {
    console.error(`No hay ningún .mxl en ${catalogDir}`);
    process.exit(1);
  }
  mkdirSync(coversDir, { recursive: true });

  const pending = ids.filter((id) => force || !existsSync(join(coversDir, `${id}.jpg`)));
  if (!pending.length) {
    console.log(`${ids.length} portadas al día. Con --force se rehacen.`);
    return;
  }

  const toolkit = new VerovioToolkit(await createVerovioModule());
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

  for (const id of pending) {
    try {
      const svg = engrave(toolkit, readFileSync(join(catalogDir, `${id}.mxl`)));
      const jpeg = await rasterise(page, svg);
      writeFileSync(join(coversDir, `${id}.jpg`), jpeg);
      console.log(`${id}.jpg · ${Math.round(jpeg.length / 1024)} KB`);
    } catch (e) {
      console.error(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      process.exitCode = 1;
    }
  }

  await browser.close();
}

/** La primera página del .mxl como SVG, a la escala que mejor llena la portada. */
function engrave(toolkit, mxl) {
  const data = mxl.toString("base64");
  // la primera escala que llene la página; si ninguna lo hace, la que más se acerque
  let best = null;
  let bestHeight = -1;
  for (const scale of SCALES) {
    toolkit.setOptions({
      scale,
      pageWidth: Math.round((WIDTH * 100) / scale),
      pageHeight: Math.round((HEIGHT * 100) / scale),
      // recorta el blanco que sobra al final de la página; así se sabe cuánto ocupa de verdad
      adjustPageHeight: true,
      header: "auto",
      footer: "none",
      pageMarginTop: 100,
      pageMarginBottom: 100,
      pageMarginLeft: 100,
      pageMarginRight: 100,
    });
    if (!toolkit.loadZipDataBase64(data)) throw new Error("Verovio no ha podido leer el .mxl");
    const svg = toolkit.renderToSVG(1);
    const height = Number(/height="(\d+(?:\.\d+)?)px"/.exec(svg)?.[1] ?? 0);
    if (height > bestHeight) {
      best = svg;
      bestHeight = height;
    }
    if (height >= HEIGHT * FILL) break;
  }
  if (!best) throw new Error("No se ha podido grabar la página");
  return best;
}

/** El SVG dibujado en una hoja blanca de 3:4 y recortado a ella. */
async function rasterise(page, svg) {
  await page.setContent(
    `<style>html,body{margin:0;background:#fff}#sheet{width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:#fff}` +
      `#sheet svg{display:block;width:${WIDTH}px;height:auto}</style><div id="sheet">${svg}</div>`,
    { waitUntil: "load" },
  );
  return page.screenshot({ type: "jpeg", quality: QUALITY, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
}

await main();

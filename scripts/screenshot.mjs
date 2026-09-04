/**
 * Capturas de pantalla de rutas con viewport móvil usando el Chrome instalado.
 * Uso: node scripts/screenshot.mjs [--dark] [--width=390] [--base=http://localhost:3000] ruta1 ruta2 …
 * Salida: /tmp/pl-<ruta>.png
 */
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const dark = args.includes("--dark");
const width = Number(args.find((a) => a.startsWith("--width="))?.split("=")[1] ?? 390);
const base = args.find((a) => a.startsWith("--base="))?.split("=")[1] ?? "http://localhost:3000";
const routes = args.filter((a) => !a.startsWith("--"));
if (!routes.length) routes.push("/");

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width, height: 844 },
  deviceScaleFactor: 2,
  colorScheme: dark ? "dark" : "light",
  isMobile: width < 700,
  hasTouch: width < 700,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

for (const route of routes) {
  const url = base + (route.startsWith("/") ? route : `/${route}`);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  const name = route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home";
  const file = `/tmp/pl-${name}${dark ? "-dark" : ""}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log(file);
}
if (errors.length) {
  console.log("\nErrores en consola:");
  for (const e of errors) console.log(" -", e);
}
await browser.close();

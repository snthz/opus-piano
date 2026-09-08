/**
 * Lazy-loads VexFlow (browser only) with the local fonts. VexFlow 5 draws
 * glyphs with the Bravura font itself, so notation uses the exact same
 * symbols as the catalog.
 */
export type VexFlowModule = typeof import("vexflow/core");

let promise: Promise<VexFlowModule> | null = null;

export function loadVexFlow(): Promise<VexFlowModule> {
  if (!promise) {
    promise = (async () => {
      const vf = await import("vexflow/core");
      await Promise.allSettled([
        vf.Font.load("Bravura", "/fonts/bravura/Bravura.woff2", { display: "block" }),
        vf.Font.load("Academico", "/fonts/bravura/Academico.woff2", { display: "swap" }),
      ]);
      vf.VexFlow.setFonts("Bravura", "Academico");
      return vf;
    })();
  }
  return promise;
}

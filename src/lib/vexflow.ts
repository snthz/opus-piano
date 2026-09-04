/**
 * Carga perezosa de VexFlow (solo en el navegador) con las fuentes locales.
 * VexFlow 5 dibuja los glifos con la propia fuente Bravura, así que la notación
 * usa exactamente los mismos símbolos originales que el catálogo.
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

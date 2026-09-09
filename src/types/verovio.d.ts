/**
 * Verovio no trae tipos. Aquí está solo lo que usa la app (ver
 * `src/lib/music/engrave.ts` y `scripts/gen-catalog-covers.mjs`); la lista
 * completa de opciones está en https://book.verovio.org/toolkit-reference/.
 */
declare module "verovio/wasm" {
  const createVerovioModule: (options?: Record<string, unknown>) => Promise<unknown>;
  export default createVerovioModule;
}

declare module "verovio/esm" {
  export class VerovioToolkit {
    constructor(module: unknown);
    setOptions(options: Record<string, unknown>): void;
    /** MusicXML o MEI sin comprimir. Devuelve si lo ha entendido. */
    loadData(data: string): boolean;
    /** Un .mxl (zip) en base64. */
    loadZipDataBase64(data: string): boolean;
    renderToSVG(page: number): string;
    /**
     * Cuándo suena cada nota, con su id. `qstamp` va en negras desde el
     * principio, que es justo lo que cuenta el reloj de la reproducción.
     */
    renderToTimemap(options?: { includeMeasures?: boolean; includeRests?: boolean }): {
      qstamp: number;
      tstamp: number;
      on?: string[];
      off?: string[];
      measureOn?: string;
    }[];
    getPageCount(): number;
    getVersion(): string;
  }
}

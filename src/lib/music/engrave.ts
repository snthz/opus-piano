"use client";

import type { VerovioToolkit } from "verovio/esm";

/**
 * La portada de una partitura: su primera página grabada de verdad, como
 * JPEG.
 *
 * Una tarjeta de partitura tiene que enseñar la partitura. Para eso no vale
 * el dibujo de la app —que es lo que suena y se sigue nota a nota, pero
 * aplana las voces y se deja los adornos—, así que la portada la graba
 * Verovio: el mismo grabador que usan las bibliotecas digitales, que lee el
 * MusicXML tal cual y saca una página con su título, sus ligaduras, sus
 * matices y sus digitaciones.
 *
 * Verovio pesa varios megas, así que se carga la primera vez que hace falta
 * una portada y no antes; quien solo abre PDF no lo descarga nunca. Las
 * piezas del catálogo ni siquiera pasan por aquí: sus portadas vienen hechas
 * de `scripts/gen-catalog-covers.mjs`, que hace exactamente esto mismo.
 */

/** La página de referencia, en píxeles; manda la proporción 3:4 de la tarjeta. */
const PAGE = { width: 900, height: 1200 };
/** Lo que se guarda: a 600 px una tarjeta de 300 se ve nítida en pantallas retina. */
const OUT = { width: 600, height: 800 };
const QUALITY = 0.72;

/**
 * Escalas a probar, de menor a mayor, y cuánta página hay que llenar para
 * dar una por buena. Una pieza larga llena con la primera; una de dieciséis
 * compases se quedaría a media página, y ahí una escala mayor reparte los
 * mismos compases en más sistemas. Es lo mismo que hace
 * `scripts/gen-catalog-covers.mjs`, para que todas las portadas se vean
 * iguales vengan de donde vengan.
 */
const SCALES = [42, 52, 64, 78];
const FILL = 0.8;

/** La hoja de leer, en píxeles: un A4 de proporciones (1 : 1,41). */
const SHEET = { width: 900, height: 1273 };
const SHEET_SCALE = 40;

let toolkit: Promise<VerovioToolkit> | null = null;

function getToolkit(): Promise<VerovioToolkit> {
  if (!toolkit) {
    toolkit = (async () => {
      const [{ VerovioToolkit: Toolkit }, { default: createVerovioModule }] = await Promise.all([
        import("verovio/esm"),
        import("verovio/wasm"),
      ]);
      return new Toolkit(await createVerovioModule());
    })();
    toolkit.catch(() => {
      toolkit = null; // un fallo de red no deja el módulo inservible para siempre
    });
  }
  return toolkit;
}

/**
 * Las portadas se hacen de una en una. Grabar es medio segundo de CPU y una
 * biblioteca recién abierta pediría veinte a la vez, con el interfaz parado
 * mientras tanto.
 */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

/** Qué suena en un instante de la partitura, medido en negras desde el principio. */
export interface EngravedEvent {
  /** Negras transcurridas. */
  at: number;
  /**
   * Todo lo que está sonando ahí, por su id en el SVG: no solo lo que ataca,
   * también lo que viene sonando de antes. Una melodía de blancas sobre un
   * acompañamiento de corcheas se queda encendida mientras dura, que es lo
   * que se oye.
   */
  sounding: string[];
}

export interface EngravedScore {
  /** El SVG de cada página. Se escalan solos al ancho que se les dé. */
  pages: string[];
  /** Ordenados por `at`: con la posición de la reproducción se sabe qué suena. */
  events: EngravedEvent[];
  /** En qué página está cada nota, para pasar de hoja mientras suena. */
  pageOf: Map<string, number>;
}

/**
 * La partitura entera, página a página, tal y como se imprimiría, más el mapa
 * de cuándo suena cada nota. Las dos cosas salen del mismo grabado, así que
 * los ids del mapa son los mismos que llevan las notas en el SVG.
 */
export async function engraveScore(xml: string): Promise<EngravedScore> {
  return enqueue(async () => {
    const tk = await getToolkit();
    tk.setOptions({
      scale: SHEET_SCALE,
      pageWidth: Math.round((SHEET.width * 100) / SHEET_SCALE),
      pageHeight: Math.round((SHEET.height * 100) / SHEET_SCALE),
      // la última página se recorta a lo que ocupa: una pieza de veinte
      // compases no tiene por qué acabar en media hoja en blanco
      adjustPageHeight: true,
      header: "auto",
      footer: "none",
      pageMarginTop: 200,
      pageMarginBottom: 200,
      pageMarginLeft: 150,
      pageMarginRight: 150,
    });
    if (!tk.loadData(xml)) throw new Error("Verovio no ha entendido el MusicXML");

    const pages: string[] = [];
    const pageOf = new Map<string, number>();
    for (let page = 1; page <= tk.getPageCount(); page++) {
      const svg = tk.renderToSVG(page);
      pages.push(svg);
      // qué hay en cada página se saca del propio SVG: es un id por elemento
      // dibujado, y sale más barato que preguntárselo a Verovio uno a uno
      for (const [, id] of svg.matchAll(/ id="([^"]+)"/g)) if (!pageOf.has(id)) pageOf.set(id, page - 1);
    }

    // El mapa dice qué entra y qué sale en cada instante; aquí se acumula para
    // tener, en cada uno, la lista de lo que suena.
    const live = new Set<string>();
    const events: EngravedEvent[] = [];
    for (const event of tk.renderToTimemap({ includeRests: false })) {
      for (const id of event.off ?? []) live.delete(id);
      for (const id of event.on ?? []) live.add(id);
      events.push({ at: event.qstamp, sounding: [...live] });
    }

    return { pages, events, pageOf };
  });
}

/** La primera página de un MusicXML como JPEG (data URL), o null si no se ha podido grabar. */
export async function engraveCover(xml: string): Promise<string | null> {
  try {
    return await enqueue(async () => {
      const svg = await engraveFirstPage(xml);
      return rasterise(svg);
    });
  } catch (e) {
    console.warn("engrave: no se ha podido hacer la portada", e);
    return null;
  }
}

/** La primera página como SVG, a la escala que mejor llena la portada. */
async function engraveFirstPage(xml: string): Promise<string> {
  const tk = await getToolkit();
  const zoom = OUT.width / PAGE.width;
  let best: string | null = null;
  let bestHeight = -1;

  for (const scale of SCALES) {
    tk.setOptions({
      scale: scale * zoom,
      pageWidth: Math.round((PAGE.width * 100) / scale),
      pageHeight: Math.round((PAGE.height * 100) / scale),
      // recorta el blanco que sobra al final: así se sabe cuánto ocupa de verdad
      adjustPageHeight: true,
      header: "auto",
      footer: "none",
      pageMarginTop: 100,
      pageMarginBottom: 100,
      pageMarginLeft: 100,
      pageMarginRight: 100,
    });
    if (!tk.loadData(xml)) throw new Error("Verovio no ha entendido el MusicXML");
    const svg = tk.renderToSVG(1);
    const height = Number(/height="(\d+(?:\.\d+)?)px"/.exec(svg)?.[1] ?? 0);
    if (height > bestHeight) {
      best = svg;
      bestHeight = height;
    }
    if (height >= OUT.height * FILL) break;
  }

  if (!best) throw new Error("No se ha podido grabar la página");
  return best;
}

/** El SVG dibujado sobre una hoja blanca de 3:4, recortada por abajo si sobra. */
async function rasterise(svg: string): Promise<string> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = OUT.width;
    canvas.height = OUT.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Sin canvas 2D");
    // el JPEG no tiene transparencia: sin esto el papel saldría negro
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const ratio = image.naturalHeight / image.naturalWidth || OUT.height / OUT.width;
    ctx.drawImage(image, 0, 0, OUT.width, OUT.width * ratio);
    return canvas.toDataURL("image/jpeg", QUALITY);
  } finally {
    URL.revokeObjectURL(url);
  }
}

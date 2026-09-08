import { durationWarnings } from "@/lib/music/musicxml-build";
import type { ParsedScore, XmlMeasure } from "@/lib/music/musicxml";

/**
 * Junta en una sola partitura las páginas que ha reconocido el servicio de OMR.
 *
 * Cada página vuelve del servicio como un MusicXML independiente, con su propia
 * cabecera: el OMR mira una imagen y no sabe que hay una página anterior. Aquí
 * manda la cabecera de la primera —la armadura y el compás de una pieza se
 * escriben al principio y solo cambian si la partitura lo dice— y los compases
 * se numeran de corrido, que es lo que espera el reproductor.
 */

export interface MergedScore {
  score: ParsedScore;
  /** Lo que quedó dudoso; se le enseña al usuario tal cual */
  warnings: string[];
}

export interface MergeOptions {
  /** Título de la pieza: el nombre de la partitura en la biblioteca. oemer solo sabe el del archivo. */
  title?: string;
  /** Números de página, para poder decir en qué página está cada aviso */
  pageNumbers?: number[];
}

export function mergePages(pages: ParsedScore[], options: MergeOptions = {}): MergedScore {
  if (!pages.length) throw new Error("No se ha reconocido ninguna página.");
  const head = pages[0];
  const warnings: string[] = [];
  const measures: XmlMeasure[] = [];
  const label = (index: number) => `Página ${options.pageNumbers?.[index] ?? index + 1}`;

  pages.forEach((page, index) => {
    if (!page.measures.length) {
      warnings.push(`${label(index)}: no se ha reconocido ningún compás.`);
      return;
    }
    if (index > 0) {
      // Un cambio de compás o de armadura a mitad existe en la música, pero en
      // un OMR es casi siempre una lectura floja de la página. Se avisa y se
      // sigue con lo de la primera, que es lo que menos descoloca.
      if (page.time.num !== head.time.num || page.time.den !== head.time.den) {
        warnings.push(`${label(index)}: se ha leído un compás de ${page.time.num}/${page.time.den} y se mantiene el ${head.time.num}/${head.time.den} de la primera página.`);
      }
      if (page.keyVex !== head.keyVex) {
        warnings.push(`${label(index)}: se ha leído la armadura de ${page.keyVex} y se mantiene la de ${head.keyVex} de la primera página.`);
      }
      if (page.clefs.length !== head.clefs.length) {
        warnings.push(`${label(index)}: se han leído ${page.clefs.length} pentagramas y en la primera página ${head.clefs.length}.`);
      }
    }
    for (const measure of page.measures) {
      measures.push({ ...measure, number: String(measures.length + 1) });
    }
  });

  if (!measures.length) throw new Error("No se ha reconocido ningún compás en las páginas elegidas.");

  const score: ParsedScore = {
    title: options.title?.trim() || head.title.trim(),
    keyVex: head.keyVex,
    time: head.time,
    tempo: head.tempo,
    clefs: head.clefs,
    measures,
  };
  warnings.push(...durationWarnings(score));
  return { score, warnings };
}

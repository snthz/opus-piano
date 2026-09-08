import { durationWarnings } from "@/lib/music/musicxml-build";
import type { ParsedScore, XmlMeasure } from "@/lib/music/musicxml";

/**
 * Merges the pages recognized by the OMR service into a single score. Each
 * page comes back as an independent MusicXML with its own header, since OMR
 * looks at one image and knows nothing about a previous page. The first
 * page's header wins, and measures are renumbered in sequence.
 */

export interface MergedScore {
  score: ParsedScore;
  /** What came out uncertain; shown to the user as-is. */
  warnings: string[];
}

export interface MergeOptions {
  /** Piece title from the library; oemer only knows the filename. */
  title?: string;
  /** Page numbers, so each warning can say which page it's about. */
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
      // a mid-piece time/key change happens in real music, but in OMR output
      // it's almost always a misread page; warn and keep the first page's values
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

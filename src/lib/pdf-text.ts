"use client";

/**
 * The text of a PDF, page by page, for documents that are text and not
 * music: a study plan someone wrote. Uses the same legacy pdf.js build as
 * the thumbnails (see `pdf-thumbnail.ts` for why that build).
 */
export async function extractPdfText(blob: Blob, maxPages = 20): Promise<string> {
  const lib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= Math.min(pdf.numPages, maxPages); n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    let line = "";
    const lines: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      // pdf.js marks the end of a visual line; without it the whole page is one string
      if (item.hasEOL) {
        lines.push(line);
        line = "";
      } else if (item.str && !item.str.endsWith(" ")) line += " ";
    }
    if (line) lines.push(line);
    pages.push(lines.join("\n"));
  }
  return pages.join("\n\n").replace(/[ \t]+\n/g, "\n").trim();
}

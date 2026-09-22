"use client";

// The "legacy" build: the modern one assumes Promise.withResolvers,
// Uint8Array.toBase64 and friends, which Safari only has from 17.4. On an
// iPad still on iPadOS 16/17 every PDF failed silently and stayed gray.
// The worker in public/ is copied from the same build (scripts/copy-pdf-worker.mjs).
type PdfLib = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfLib: PdfLib | null = null;

async function getPdfLib() {
  if (!pdfLib) {
    pdfLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return pdfLib;
}

/**
 * Biggest canvas iOS Safari paints reliably (about 16.7 million pixels): past
 * it the canvas comes out blank with no error. Rendering caps at this and lets
 * CSS stretch the rest, which at a high zoom is softer but never empty.
 */
export const MAX_CANVAS_PIXELS = 16_000_000;

export async function renderThumbnail(blob: Blob, maxWidth = 300): Promise<{ thumbnail: string; pageCount: number }> {
  const lib = await getPdfLib();
  const arrayBuffer = await blob.arrayBuffer();
  const pdf = await lib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pageCount = pdf.numPages;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const scale = maxWidth / viewport.width;
  const scaled = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(scaled.width);
  canvas.height = Math.round(scaled.height);
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvas, canvasContext: ctx, viewport: scaled }).promise;

  return { thumbnail: canvas.toDataURL("image/jpeg", 0.8), pageCount };
}

// Abrir un PDF es lo caro: se conserva el documento abierto por cada Blob.
const docs = new WeakMap<Blob, Promise<import("pdfjs-dist/legacy/build/pdf.mjs").PDFDocumentProxy>>();
async function getDocumentCached(blob: Blob) {
  let doc = docs.get(blob);
  if (!doc) {
    doc = (async () => {
      const lib = await getPdfLib();
      return lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
    })().catch((e) => {
      // a failed open must not be cached: the next attempt (after a reload
      // of the worker, say) deserves a fresh try
      docs.delete(blob);
      throw e;
    });
    docs.set(blob, doc);
  }
  return doc;
}

/** Tamaño de la página a escala 1 (puntos PDF), sin dibujarla. */
export async function getPageSize(blob: Blob, pageNum: number): Promise<{ width: number; height: number }> {
  const pdf = await getDocumentCached(blob);
  const page = await pdf.getPage(pageNum);
  const v = page.getViewport({ scale: 1 });
  return { width: v.width, height: v.height };
}

export async function renderPage(blob: Blob, pageNum: number, scale: number): Promise<HTMLCanvasElement> {
  const pdf = await getDocumentCached(blob);
  const page = await pdf.getPage(pageNum);
  let viewport = page.getViewport({ scale });
  const pixels = viewport.width * viewport.height;
  if (pixels > MAX_CANVAS_PIXELS) viewport = page.getViewport({ scale: scale * Math.sqrt(MAX_CANVAS_PIXELS / pixels) });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas;
}

export async function getPageCount(blob: Blob): Promise<number> {
  const lib = await getPdfLib();
  const arrayBuffer = await blob.arrayBuffer();
  const pdf = await lib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  return pdf.numPages;
}

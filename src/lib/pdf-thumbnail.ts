"use client";

let pdfLib: typeof import("pdfjs-dist") | null = null;

async function getPdfLib() {
  if (!pdfLib) {
    pdfLib = await import("pdfjs-dist");
    pdfLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return pdfLib;
}

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

export async function renderPage(blob: Blob, pageNum: number, scale: number): Promise<HTMLCanvasElement> {
  const lib = await getPdfLib();
  const arrayBuffer = await blob.arrayBuffer();
  const pdf = await lib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

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

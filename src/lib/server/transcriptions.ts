import type { Transcription } from "@prisma/client";
import { prisma } from "@/lib/db";
import { MAX_OMR_PAGES, type TranscriptionJob, type TranscriptionStatus } from "@/lib/omr/shared";
import { OmrError, recognisePage } from "./omr";
import { readPageImage, readPagesXml, removeTranscriptionFiles, writePageImage, writePageXml } from "./transcription-files";

/**
 * Reconocer una partitura tarda minutos por página, así que no puede vivir en
 * la pestaña del navegador: se encarga aquí y aquí sigue aunque el navegador
 * se vaya. El dispositivo manda las páginas ya renderizadas, este servidor
 * las pasa por el servicio de OMR una a una y guarda el MusicXML de cada
 * una; cuando el usuario vuelve, se lo lleva.
 *
 * Solo lo para el usuario, cancelándolo a mano.
 *
 * El trabajo corre suelto, fuera del ciclo de vida de la petición que lo
 * creó: la app se despliega como un proceso Node de larga vida (contenedor
 * propio), no como funciones que mueren al responder. Si aun así el proceso
 * se reinicia, el latido de abajo lo delata y el encargo se marca como
 * fallido en vez de quedarse colgado para siempre.
 */

/** Encargos en marcha en este proceso, para poder cancelarlos. */
const running = new Map<string, AbortController>();

/** Cada cuánto se toca la fila mientras se reconoce una página. */
const HEARTBEAT_MS = 20_000;
/** Sin latido en este tiempo, el encargo es de un proceso que ya no existe. */
const STALE_MS = 2 * 60_000;

const asStatus = (value: string): TranscriptionStatus =>
  value === "running" || value === "done" || value === "error" ? value : "pending";

export function toJob(row: Transcription): TranscriptionJob {
  return {
    id: row.id,
    scoreId: row.scoreId,
    scoreName: row.scoreName,
    status: asStatus(row.status),
    pages: row.pages,
    donePages: row.donePages,
    fromPage: row.fromPage,
    error: row.error ?? undefined,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

/** Actualiza la fila sin romperse si el usuario ya la ha cancelado (y borrado). */
async function patch(id: string, data: Parameters<typeof prisma.transcription.update>[0]["data"]): Promise<void> {
  try {
    await prisma.transcription.update({ where: { id }, data });
  } catch {
    // fila borrada: el encargo se canceló mientras se reconocía
  }
}

/**
 * Marca como fallidos los encargos que dejaron de latir: son de un proceso
 * que se reinició a mitad. Se comprueba al mirar la lista, que es cuando
 * importa.
 */
async function reapStale(userId: string): Promise<void> {
  const stale = await prisma.transcription.findMany({
    where: { userId, status: { in: ["pending", "running"] }, updatedAt: { lt: new Date(Date.now() - STALE_MS) } },
    select: { id: true },
  });
  const orphans = stale.filter((row) => !running.has(row.id)).map((row) => row.id);
  if (!orphans.length) return;
  await prisma.transcription.updateMany({
    where: { id: { in: orphans } },
    data: { status: "error", error: "El servidor se reinició mientras reconocía la partitura. Vuelve a intentarlo." },
  });
}

/** Los encargos de un usuario, del más reciente al más antiguo. */
export async function listTranscriptions(userId: string): Promise<TranscriptionJob[]> {
  await reapStale(userId);
  const rows = await prisma.transcription.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 });
  return rows.map(toJob);
}

export async function getTranscription(userId: string, id: string): Promise<TranscriptionJob | null> {
  const row = await prisma.transcription.findFirst({ where: { id, userId } });
  if (!row) return null;
  if (row.status === "pending" || row.status === "running") await reapStale(userId);
  const fresh = await prisma.transcription.findFirst({ where: { id, userId } });
  return fresh ? toJob(fresh) : null;
}

/** Hay uno sin terminar: el servicio de OMR atiende de uno en uno. */
export async function hasUnfinished(userId: string): Promise<boolean> {
  await reapStale(userId);
  const count = await prisma.transcription.count({ where: { userId, status: { in: ["pending", "running"] } } });
  return count > 0;
}

export interface NewTranscription {
  userId: string;
  scoreId: string;
  scoreName: string;
  fromPage: number;
  /** Las páginas ya renderizadas por el navegador, en orden. */
  images: Uint8Array[];
}

/** Guarda las páginas, crea el encargo y lo pone en marcha. */
export async function startTranscription(input: NewTranscription): Promise<TranscriptionJob> {
  const pages = Math.min(input.images.length, MAX_OMR_PAGES);
  const row = await prisma.transcription.create({
    data: {
      userId: input.userId,
      scoreId: input.scoreId,
      scoreName: input.scoreName,
      pages,
      fromPage: input.fromPage,
      status: "pending",
    },
  });
  try {
    for (let page = 1; page <= pages; page++) await writePageImage(row.userId, row.id, page, input.images[page - 1]);
  } catch (e) {
    await removeTranscription(row.userId, row.id);
    throw e;
  }
  // suelto a propósito: la respuesta sale ya y el reconocimiento sigue por su cuenta
  void run(row.id, row.userId, row.pages);
  return toJob(row);
}

/** Cancela lo que esté en marcha y borra el encargo con sus archivos. */
export async function removeTranscription(userId: string, id: string): Promise<boolean> {
  const row = await prisma.transcription.findFirst({ where: { id, userId } });
  if (!row) return false;
  running.get(id)?.abort();
  running.delete(id);
  await prisma.transcription.delete({ where: { id } }).catch(() => {});
  await removeTranscriptionFiles(userId, id);
  return true;
}

/** El MusicXML de cada página reconocida, en orden. */
export async function transcriptionPages(userId: string, id: string): Promise<string[] | null> {
  const row = await prisma.transcription.findFirst({ where: { id, userId } });
  if (!row) return null;
  return readPagesXml(userId, id, row.pages);
}

/** El reconocimiento en sí: una página detrás de otra, hasta acabar o fallar. */
async function run(id: string, userId: string, pages: number): Promise<void> {
  const abort = new AbortController();
  running.set(id, abort);
  const beat = setInterval(() => void patch(id, { status: "running" }), HEARTBEAT_MS);

  try {
    await patch(id, { status: "running" });
    for (let page = 1; page <= pages; page++) {
      if (abort.signal.aborted) return;
      const image = await readPageImage(userId, id, page);
      const recognised = await recognisePage(new Blob([new Uint8Array(image)], { type: "image/png" }), abort.signal);
      if (abort.signal.aborted) return;
      await writePageXml(userId, id, page, recognised.musicxml);
      await patch(id, { donePages: page });
    }
    await patch(id, { status: "done" });
  } catch (e) {
    if (abort.signal.aborted) return; // cancelado por el usuario: la fila ya no existe
    if (!(e instanceof OmrError)) console.error("omr: fallo inesperado reconociendo", e);
    const message = e instanceof OmrError ? e.message : "No se ha podido reconocer la partitura.";
    await patch(id, { status: "error", error: message });
  } finally {
    clearInterval(beat);
    running.delete(id);
  }
}

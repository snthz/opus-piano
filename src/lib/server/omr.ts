/**
 * Client for the OMR service (oemer over FastAPI, see `omr-service/`), a
 * separate container due to its CPU/memory cost; deployed on Cloud Run.
 * Disabled without `OMR_URL`.
 */

const SECOND = 1000;

/** No trailing slash, gets concatenated later. */
const baseUrl = () => (process.env.OMR_URL ?? "").trim().replace(/\/+$/, "");

export const omrEnabled = () => !!baseUrl();

/** Margin above the service's own timeout plus the instance's cold start. */
const timeoutMs = () => Number(process.env.OMR_TIMEOUT_MS || 15 * 60 * SECOND);

/** Pages per user per hour. */
export const omrLimit = () => ({ max: Number(process.env.OMR_PAGES_PER_HOUR || 20), windowMs: 60 * 60 * SECOND });

export class OmrError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** User-facing messages; technical detail stays in the log. */
const MESSAGES: Record<string, string> = {
  UNSUPPORTED_TYPE: "El servicio no ha reconocido el formato de la imagen.",
  TOO_LARGE: "La página pesa demasiado para enviarla.",
  IMAGE_TOO_SMALL: "La página se ha enviado a muy poca resolución para leerla.",
  BAD_PDF: "No se ha podido leer el PDF.",
  EMPTY_SCORE: "No se han encontrado pentagramas en esta página. Suele pasar con páginas de texto, portadas o escaneos torcidos.",
  OMR_TIMEOUT: "El reconocimiento ha tardado demasiado y se ha cortado. Prueba con una página con menos compases.",
  BUSY: "El servicio está ocupado con otra partitura. Prueba dentro de un minuto.",
  CRASHED: "El servicio se ha caído a mitad de esta página, casi siempre por quedarse sin memoria. Vuelve a intentarlo; si se repite, esa página es demasiado para él.",
  UNAUTHORIZED: "El servidor no ha podido identificarse ante el servicio de reconocimiento.",
};

const message = (code: string) => MESSAGES[code] ?? "No se ha podido reconocer la partitura.";

export interface OmrPage {
  musicxml: string;
  /** How long recognition took, for the log. */
  seconds: number;
}

/** Sends one page to the service (one request per page) and returns its MusicXML. */
export async function recognisePage(image: Blob, signal?: AbortSignal): Promise<OmrPage> {
  const base = baseUrl();
  if (!base) throw new OmrError("DISABLED", "El reconocimiento de partituras no está disponible.");

  const form = new FormData();
  form.append("file", image, "page.png");

  const token = (process.env.OMR_TOKEN ?? "").trim();
  const timeout = AbortSignal.timeout(timeoutMs());

  let response: Response;
  try {
    response = await fetch(`${base}/v1/transcribe`, {
      method: "POST",
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (e) {
    if (signal?.aborted) throw e; // cancelled by the user, not a real failure
    console.error("omr: no se ha podido llamar al servicio", e);
    throw new OmrError("UNREACHABLE", "El servicio de reconocimiento no responde. Inténtalo más tarde.");
  }

  if (!response.ok) {
    const code = await errorCode(response);
    console.error(`omr: el servicio ha devuelto ${response.status} (${code})`);
    throw new OmrError(code, message(code));
  }

  const body = (await response.json()) as { musicxml?: unknown; seconds?: unknown };
  if (typeof body.musicxml !== "string" || !body.musicxml.includes("<score-partwise")) {
    throw new OmrError("OMR_FAILED", message("OMR_FAILED"));
  }
  return { musicxml: body.musicxml, seconds: typeof body.seconds === "number" ? body.seconds : 0 };
}

/** The service's own error code if any; otherwise a synthetic one for a platform-level failure. */
async function errorCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { code?: string } };
    if (body.error?.code) return body.error.code;
  } catch {
    // non-JSON response: platform-level failure (Cloud Run)
  }
  if (response.status === 429) return "BUSY"; // no free instance
  if (response.status === 502 || response.status === 503) return "CRASHED";
  return "OMR_FAILED";
}

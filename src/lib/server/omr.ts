/**
 * Cliente del servicio de reconocimiento óptico de partituras (OMR).
 *
 * El servicio es un contenedor aparte —oemer sobre FastAPI, ver `omr-service/`—
 * porque necesita 2 GB de memoria y la CPU entera durante un minuto por página:
 * ni cabe en el VPS junto a la aplicación ni tendría sentido tenerlo encendido
 * todo el día para lo poco que se usa. Se despliega en Cloud Run, que lo apaga
 * cuando nadie lo usa, y aquí solo se le llama.
 *
 * Sin `OMR_URL` la función queda desactivada y la aplicación no ofrece la opción.
 */

const SECOND = 1000;

/** Sin barra final, que luego se concatena. */
const baseUrl = () => (process.env.OMR_URL ?? "").trim().replace(/\/+$/, "");

export const omrEnabled = () => !!baseUrl();

/**
 * Margen por encima de todo lo que puede tardar el servicio: su propio corte
 * (`OMR_TIMEOUT`, 600 s), el arranque en frío de la instancia y la subida de la
 * imagen. Quien decide antes es el usuario, que puede cancelar cuando quiera.
 */
const timeoutMs = () => Number(process.env.OMR_TIMEOUT_MS || 15 * 60 * SECOND);

/** Páginas por usuario y hora. Es el gasto de CPU de la cuenta de Google. */
export const omrLimit = () => ({ max: Number(process.env.OMR_PAGES_PER_HOUR || 20), windowMs: 60 * 60 * SECOND });

export class OmrError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Lo que el usuario lee cuando algo falla; el detalle técnico se queda en el registro. */
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
  /** Lo que ha tardado el reconocimiento, para el registro */
  seconds: number;
}

/**
 * Manda una página al servicio y devuelve su MusicXML. Una petición, una
 * página: el servicio atiende de una en una y es la aplicación la que recorre
 * el PDF.
 */
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
    if (signal?.aborted) throw e; // lo ha cancelado el usuario: no es un fallo
    // Instancia apagada que no llega a arrancar, red caída, DNS…
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

/**
 * El código del servicio si lo hay; si no, el fallo lo ha puesto la plataforma
 * y hay que distinguirlo. Un 503 del servicio quiere decir «estoy con otra
 * página»; un 503 de Cloud Run quiere decir que la instancia se ha muerto por
 * el camino —normalmente sin memoria— y decirle al usuario que espere un
 * minuto sería mandarle a repetir lo mismo.
 */
async function errorCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { code?: string } };
    if (body.error?.code) return body.error.code;
  } catch {
    // Cuando el problema es de Cloud Run, la respuesta no es JSON.
  }
  if (response.status === 429) return "BUSY"; // no hay instancia libre
  if (response.status === 502 || response.status === 503) return "CRASHED";
  return "OMR_FAILED";
}

/** Error de una petición a la IA, con mensaje ya pensado para mostrarlo tal cual. */
export class AiError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
  }
}

export const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

/** Fetch que distingue el corte por el usuario (AbortError) del fallo de red. */
export async function safeFetch(url: string, init: RequestInit, who: string): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    if (isAbort(e)) throw e;
    throw new AiError(`No hay conexión con ${who}. Comprueba la red e inténtalo de nuevo.`);
  }
}

/** Lee `{ error: { message, code, type } }` de una respuesta fallida. */
export async function errorBody(res: Response): Promise<{ message: string; code: string; type: string }> {
  const data = (await res.json().catch(() => null)) as { error?: { message?: string; code?: string; type?: string } } | null;
  return { message: data?.error?.message ?? `Error ${res.status}`, code: data?.error?.code ?? "", type: data?.error?.type ?? "" };
}

/* ---------- Lo que comparten las dos implementaciones ---------- */

export type InputPart = { type: "text"; text: string } | { type: "image"; dataUrl: string };

export type Effort = "low" | "medium" | "high";

export interface JsonRequest {
  instructions: string;
  content: InputPart[];
  schemaName: string;
  /** Esquema neutro; cada proveedor lo emite en su variante */
  schema: import("./schema").SchemaNode;
  effort: Effort;
  maxOutputTokens: number;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface StreamRequest {
  instructions: string;
  history: ChatTurn[];
  effort: Effort;
  maxOutputTokens: number;
}

/** Separa «data:image/jpeg;base64,…» en tipo y datos. */
export function splitDataUrl(dataUrl: string): { mediaType: string; data: string } {
  const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!m) throw new AiError("Imagen de página no válida.");
  return { mediaType: m[1], data: m[2] };
}

/** Lector de eventos SSE: llama a `onEvent` con cada objeto `data:` JSON. */
export async function readSse(res: Response, onEvent: (ev: Record<string, unknown>) => void): Promise<void> {
  if (!res.body) throw new AiError("El proveedor no ha devuelto ninguna respuesta.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const handle = (block: string) => {
    const data = block
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .join("");
    if (!data || data === "[DONE]") return;
    let ev: Record<string, unknown>;
    try {
      ev = JSON.parse(data) as Record<string, unknown>;
    } catch {
      return;
    }
    onEvent(ev);
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      handle(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
    }
  }
  if (buffer.trim()) handle(buffer);
}

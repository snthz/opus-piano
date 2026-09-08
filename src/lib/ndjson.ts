/**
 * Lector de un flujo de líneas JSON (NDJSON), que es como `/api/omr` va
 * contando por dónde va el reconocimiento sin dejar la petición muda durante
 * minutos.
 *
 * Los trozos que llegan no coinciden con las líneas: una línea puede venir
 * partida en dos lecturas y dos líneas juntas en una. Por eso se acumula en un
 * buffer y solo se entrega lo que ya tiene su salto de línea, más lo que quede
 * suelto al cerrarse el flujo.
 */
export async function readNdjson(body: ReadableStream<Uint8Array>, onLine: (value: Record<string, unknown>) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handle = (line: string) => {
    if (!line.trim()) return;
    try {
      const value = JSON.parse(line) as unknown;
      if (value && typeof value === "object") onLine(value as Record<string, unknown>);
    } catch {
      // Una línea a medias o basura por el camino no tira el reconocimiento:
      // lo que importa es la última, y si nunca llega ya se avisa aparte.
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index: number;
    while ((index = buffer.indexOf("\n")) >= 0) {
      handle(buffer.slice(0, index));
      buffer = buffer.slice(index + 1);
    }
  }
  handle(buffer);
}

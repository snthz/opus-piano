/**
 * Reads NDJSON from a stream line by line. Chunks don't align with lines (one
 * line can arrive split across reads), so they're buffered and only handed
 * off once a newline shows up.
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
      // a half line or junk in transit: ignored, reported separately if the last one never arrives
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

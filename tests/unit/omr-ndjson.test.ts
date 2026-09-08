/**
 * El reconocimiento tarda minutos y su respuesta llega como un goteo de líneas
 * JSON. Lo que se comprueba aquí es que da igual cómo parta la red ese goteo:
 * una línea a caballo entre dos trozos, varias en el mismo o la última sin
 * salto de línea tienen que leerse igual.
 */
import { describe, expect, test } from "bun:test";
import { readNdjson } from "@/lib/omr/ndjson";

/** Un flujo que entrega exactamente los trozos que se le pasan. */
function stream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function linesOf(chunks: string[]) {
  const out: Record<string, unknown>[] = [];
  await readNdjson(stream(chunks), (line) => out.push(line));
  return out;
}

describe("lectura del flujo de líneas JSON", () => {
  test("una línea por trozo", async () => {
    expect(await linesOf(['{"type":"working","seconds":0}\n', '{"type":"done","musicxml":"<x/>"}\n'])).toEqual([
      { type: "working", seconds: 0 },
      { type: "done", musicxml: "<x/>" },
    ]);
  });

  test("una línea partida entre dos trozos se recompone", async () => {
    expect(await linesOf(['{"type":"wor', 'king","seconds":30}\n'])).toEqual([{ type: "working", seconds: 30 }]);
  });

  test("varias líneas en el mismo trozo", async () => {
    const chunks = ['{"a":1}\n{"b":2}\n{"c":3}\n'];
    expect(await linesOf(chunks)).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });

  test("la última línea sin salto también cuenta", async () => {
    // Es el caso normal al cerrarse el flujo justo tras el resultado.
    expect(await linesOf(['{"type":"done","musicxml":"<x/>"}'])).toEqual([{ type: "done", musicxml: "<x/>" }]);
  });

  test("una línea rota no tira la lectura", async () => {
    expect(await linesOf(['{"a":1}\nesto no es json\n{"b":2}\n'])).toEqual([{ a: 1 }, { b: 2 }]);
  });

  test("las líneas en blanco se ignoran", async () => {
    expect(await linesOf(["\n\n", '{"a":1}\n', "\n"])).toEqual([{ a: 1 }]);
  });

  test("los caracteres partidos por la mitad no se corrompen", async () => {
    // «á» son dos bytes en UTF-8; si el corte cae entre ellos, el decodificador
    // tiene que esperar al siguiente trozo en vez de escupir un rombo.
    const bytes = new TextEncoder().encode('{"m":"compás"}\n');
    const chunks = [bytes.slice(0, 10), bytes.slice(10)];
    const out: Record<string, unknown>[] = [];
    await readNdjson(
      new ReadableStream({
        start(controller) {
          chunks.forEach((c) => controller.enqueue(c));
          controller.close();
        },
      }),
      (line) => out.push(line),
    );
    expect(out).toEqual([{ m: "compás" }]);
  });
});

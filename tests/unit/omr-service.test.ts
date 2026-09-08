/**
 * El cliente del servicio de OMR es la frontera entre un servicio que habla en
 * códigos y una aplicación que habla en español: lo que se prueba aquí es esa
 * traducción, el token y que nada de lo que diga el servicio se le enseñe al
 * usuario tal cual.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { OmrError, omrEnabled, omrLimit, recognisePage } from "@/lib/server/omr";

const MUSICXML = '<?xml version="1.0"?><score-partwise version="4.0"><part id="P1"/></score-partwise>';

const realFetch = globalThis.fetch;
let calls: { url: string; init: RequestInit }[] = [];

/** Sustituye a fetch por algo que devuelve siempre lo mismo y apunta la llamada. */
function reply(body: unknown, status = 200) {
  globalThis.fetch = (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

const page = () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });

beforeEach(() => {
  calls = [];
  process.env.OMR_URL = "http://omr.test/";
  delete process.env.OMR_TOKEN;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.OMR_URL;
  delete process.env.OMR_TOKEN;
});

describe("cliente del servicio de OMR", () => {
  test("sin OMR_URL la función está apagada", async () => {
    delete process.env.OMR_URL;
    expect(omrEnabled()).toBe(false);
    await expect(recognisePage(page())).rejects.toThrow(OmrError);
  });

  test("con OMR_URL manda la página y devuelve el MusicXML", async () => {
    reply({ musicxml: MUSICXML, seconds: 214.3 });
    const result = await recognisePage(page());
    expect(result.musicxml).toBe(MUSICXML);
    expect(result.seconds).toBe(214.3);
    // La barra de más de OMR_URL no debe duplicarse en la ruta.
    expect(calls[0].url).toBe("http://omr.test/v1/transcribe");
    expect(calls[0].init.method).toBe("POST");
  });

  test("el token va como Bearer solo si está configurado", async () => {
    reply({ musicxml: MUSICXML });
    await recognisePage(page());
    expect(calls[0].init.headers).toBeUndefined();

    process.env.OMR_TOKEN = "secreto";
    await recognisePage(page());
    expect(calls[1].init.headers).toEqual({ Authorization: "Bearer secreto" });
  });

  test("cada código del servicio tiene su explicación en español", async () => {
    reply({ error: { code: "EMPTY_SCORE", message: "No staves were found in the image" } }, 422);
    const error = (await recognisePage(page()).catch((e: unknown) => e)) as OmrError;
    expect(error).toBeInstanceOf(OmrError);
    expect(error.code).toBe("EMPTY_SCORE");
    expect(error.message).toContain("pentagramas");
    // El texto del servicio (en inglés, con sus detalles) no se propaga.
    expect(error.message).not.toContain("staves");
  });

  test("un código desconocido no deja al usuario sin mensaje", async () => {
    reply({ error: { code: "SOMETHING_NEW", message: "boom" } }, 500);
    const error = (await recognisePage(page()).catch((e: unknown) => e)) as OmrError;
    expect(error.code).toBe("SOMETHING_NEW");
    expect(error.message).toBe("No se ha podido reconocer la partitura.");
  });

  test("una respuesta que no es JSON (Cloud Run caído) se trata como fallo del servicio", async () => {
    reply("<html>502 Bad Gateway</html>", 502);
    const error = (await recognisePage(page()).catch((e: unknown) => e)) as OmrError;
    expect(error.code).toBe("OMR_FAILED");
  });

  test("un 503 sin cuerpo se lee como «ocupado»", async () => {
    reply("", 503);
    const error = (await recognisePage(page()).catch((e: unknown) => e)) as OmrError;
    expect(error.code).toBe("BUSY");
    expect(error.message).toContain("ocupado");
  });

  test("un 200 que no trae MusicXML tampoco cuela", async () => {
    reply({ musicxml: "vaya" });
    const error = (await recognisePage(page()).catch((e: unknown) => e)) as OmrError;
    expect(error.code).toBe("OMR_FAILED");
  });

  test("si el servicio no responde, se dice que no responde", async () => {
    globalThis.fetch = (() => Promise.reject(new Error("ECONNREFUSED"))) as unknown as typeof fetch;
    const error = (await recognisePage(page()).catch((e: unknown) => e)) as OmrError;
    expect(error.code).toBe("UNREACHABLE");
  });

  test("el límite por usuario se puede ajustar por entorno", () => {
    expect(omrLimit()).toEqual({ max: 20, windowMs: 60 * 60 * 1000 });
    process.env.OMR_PAGES_PER_HOUR = "5";
    expect(omrLimit().max).toBe(5);
    delete process.env.OMR_PAGES_PER_HOUR;
  });
});

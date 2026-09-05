"use client";

import { getPageCount, getPageSize, renderPage } from "@/lib/pdf-thumbnail";
import { parseMusicXml } from "@/lib/music/musicxml";

/**
 * Transcripción de un PDF a MusicXML con un modelo de visión de OpenAI.
 *
 * Se envía cada página como imagen. La primera devuelve el documento completo;
 * las siguientes solo sus compases, que se añaden a la parte. El resultado es
 * un borrador —los modelos se equivocan en ritmos y notas— y se valida con el
 * mismo lector que usa Etude antes de darlo por bueno.
 */

export interface OmrOptions {
  apiKey: string;
  model: string;
  /** Páginas como máximo (cada una es una petición con imagen) */
  maxPages?: number;
  onProgress?: (message: string) => void;
}

const SYSTEM = `Eres un sistema de reconocimiento óptico de partituras (OMR) para piano.
Transcribes la imagen de una partitura a MusicXML 4.0 en formato partwise.
Reglas:
- Una sola <part> (piano) con <staves>2</staves>: mano derecha en staff 1 (clave de sol), izquierda en staff 2 (clave de fa), salvo que la partitura tenga un solo pentagrama.
- Indica <divisions>, <key><fifths>, <time> y <clef number="1"/"2"> en los <attributes> del primer compás. Usa <backup> para volver al inicio del compás antes de la segunda mano.
- Cada nota con <pitch>, <duration>, <voice>, <type>, <staff>; acordes con <chord/>; silencios con <rest/>; puntillos con <dot/>; ligaduras con <tie> y <tied>; alteraciones impresas con <accidental>.
- Si hay indicación de tempo, inclúyela como <direction> con <sound tempo="…"/>.
- Omite letras, digitaciones, dinámicas y adornos si no estás seguro. No inventes compases.
- Responde ÚNICAMENTE con XML: sin explicaciones, sin comentarios y sin bloques de código.`;

const FIRST_PAGE = "Transcribe esta página (la primera de la pieza) a un documento MusicXML completo: declaración XML, <score-partwise>, <part-list> y <part>.";

function continuationPrompt(page: number, lastMeasure: number, attributes: string) {
  return `Esta es la página ${page} de la misma pieza. Ya tengo transcritos los compases 1 a ${lastMeasure}.
Devuelve SOLO los elementos <measure> de esta página, numerados a partir de ${lastMeasure + 1}, uno tras otro, sin <score-partwise>, sin <part> y sin cabecera.
Se mantienen estos atributos salvo que la partitura los cambie (en ese caso incluye <attributes> con el cambio):
${attributes}`;
}

/** Página como JPEG de unos 1600 px de ancho: suficiente para leer las notas sin disparar el tamaño. */
async function pageImage(file: Blob, page: number): Promise<string> {
  const { width } = await getPageSize(file, page);
  const canvas = await renderPage(file, page, Math.min(3, 1600 / width));
  return canvas.toDataURL("image/jpeg", 0.85);
}

async function ask(opts: OmrOptions, prompt: string, image: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify({
      model: opts.model,
      max_completion_tokens: 16000,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: image, detail: "high" } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.error?.message ?? "";
    } catch {
      /* sin cuerpo legible */
    }
    if (res.status === 401) throw new Error("OpenAI rechazó la clave de API. Revísala en Ajustes.");
    if (res.status === 429) throw new Error("OpenAI: límite de uso o sin crédito. " + detail);
    throw new Error(`OpenAI (${res.status}): ${detail || res.statusText}`);
  }
  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("OpenAI devolvió una respuesta vacía.");
  return text;
}

/** Quita bloques de código y cualquier texto antes del XML. */
function clean(text: string): string {
  let t = text.replace(/```(?:xml)?/gi, "").trim();
  const start = t.search(/<\?xml|<score-partwise|<measure/);
  if (start > 0) t = t.slice(start);
  return t;
}

function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("La respuesta del modelo no es XML bien formado.");
  return doc;
}

export async function transcribePdf(file: Blob, opts: OmrOptions): Promise<string> {
  const progress = opts.onProgress ?? (() => {});
  const total = await getPageCount(file);
  const pages = Math.min(total, opts.maxPages ?? 8);

  progress(`Preparando la página 1 de ${pages}…`);
  const first = await pageImage(file, 1);
  progress(`Transcribiendo la página 1 de ${pages}… (puede tardar un minuto)`);
  const doc = parseXml(clean(await ask(opts, FIRST_PAGE, first)));
  const part = doc.querySelector("score-partwise > part");
  if (!part) throw new Error("El modelo no devolvió una partitura MusicXML (falta <score-partwise>/<part>).");

  let count = part.querySelectorAll(":scope > measure").length;
  const attributes = part.querySelector("measure > attributes")?.outerHTML ?? "";

  for (let p = 2; p <= pages; p++) {
    progress(`Preparando la página ${p} de ${pages}…`);
    const img = await pageImage(file, p);
    progress(`Transcribiendo la página ${p} de ${pages}…`);
    const frag = parseXml(`<measures>${clean(await ask(opts, continuationPrompt(p, count, attributes), img))}</measures>`);
    for (const m of frag.querySelectorAll("measures > measure")) {
      count++;
      m.setAttribute("number", String(count));
      part.appendChild(doc.importNode(m, true));
    }
  }

  const xml = new XMLSerializer().serializeToString(doc);
  // Si nuestro lector no lo entiende, mejor avisar ahora que guardar algo inservible.
  const parsed = parseMusicXml(xml);
  if (!parsed.measures.length) throw new Error("La transcripción no contiene compases.");
  progress(`Listo: ${parsed.measures.length} compases${total > pages ? ` (solo las ${pages} primeras páginas)` : ""}.`);
  return xml;
}

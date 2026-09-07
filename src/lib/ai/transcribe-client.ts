"use client";

import { getPageSize, renderPage } from "@/lib/pdf-thumbnail";
import { buildMusicXml } from "@/lib/music/musicxml-build";
import type { ParsedScore } from "@/lib/music/musicxml";
import { requestJson } from "./client";
import type { AiTarget } from "./config";
import { AiError, type InputPart } from "./errors";
import { maxImageEdge } from "./models";
import {
  assemble,
  headerOf,
  transcribeInstructions,
  transcribeUserMessage,
  transcriptionSchema,
  TRANSCRIPTION_SCHEMA,
  type KnownHeader,
  type Transcription,
} from "./transcribe";

export interface TranscribeInput {
  target: AiTarget;
  scoreName: string;
  pdf: Blob;
  /** Primera y última página del PDF que se transcriben, ambas incluidas */
  from: number;
  to: number;
  onStatus?: (text: string) => void;
  signal?: AbortSignal;
}

export interface TranscribeOutcome {
  /** MusicXML listo para vincular a la partitura */
  xml: string;
  score: ParsedScore;
  warnings: string[];
  pages: number;
  model: string;
}

/**
 * Hasta dónde puede llegar el modelo. Con Anthropic el razonamiento cuenta
 * dentro de este límite, así que va holgado; si aun así se queda corto, el
 * proveedor devuelve el aviso de respuesta incompleta.
 */
const MAX_OUTPUT_TOKENS = 16_000;

/** Una página como PNG: línea fina de alto contraste, que es donde el JPEG deja artefactos. */
async function pageImage(pdf: Blob, page: number, maxEdge: number): Promise<string> {
  const { width, height } = await getPageSize(pdf, page);
  const canvas = await renderPage(pdf, page, maxEdge / Math.max(width, height));
  return canvas.toDataURL("image/png");
}

/**
 * Transcribe el PDF página a página: una petición por página, con la cabecera
 * de la primera arrastrada al resto para que la armadura y el compás no cambien
 * de criterio a mitad de la pieza. Se renderiza cada imagen justo antes de
 * enviarla en lugar de todas de golpe, que en un móvil son varios megas de
 * canvas vivos a la vez.
 */
export async function transcribeScore(input: TranscribeInput): Promise<TranscribeOutcome> {
  const edge = maxImageEdge(input.target.provider, input.target.model);
  const instructions = transcribeInstructions();
  const total = input.to - input.from + 1;
  const pages: Transcription[] = [];
  let header: KnownHeader | null = null;
  let firstMeasure = 1;

  for (let page = input.from; page <= input.to; page++) {
    const index = page - input.from + 1;
    input.onStatus?.(total > 1 ? `Preparando la página ${index} de ${total}…` : "Preparando la página…");
    const image = await pageImage(input.pdf, page, edge);

    input.onStatus?.(`Leyendo la página ${index} de ${total}… suele tardar entre medio minuto y dos minutos.`);
    const message = transcribeUserMessage({ scoreName: input.scoreName, page, index, total, firstMeasure, header });
    const content: InputPart[] = [{ type: "text", text: message }, { type: "image", dataUrl: image }];
    const text = await requestJson(
      input.target,
      // Esfuerzo alto: leer bien las figuras es lo que decide si la transcripción sirve o no.
      { instructions, content, schemaName: "transcripcion", schema: TRANSCRIPTION_SCHEMA, effort: "high", maxOutputTokens: MAX_OUTPUT_TOKENS },
      input.signal,
    );

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new AiError(`El modelo no ha devuelto una transcripción legible de la página ${index}. Vuelve a intentarlo.`);
    }
    const parsed = transcriptionSchema.safeParse(raw);
    if (!parsed.success) throw new AiError(`La transcripción de la página ${index} no tiene el formato esperado. Vuelve a intentarlo o prueba otro modelo.`);
    if (!parsed.data.measures.length) throw new AiError(`El modelo no ha encontrado compases en la página ${index}. Comprueba que esa página tiene partitura.`);

    pages.push(parsed.data);
    header ??= headerOf(parsed.data);
    firstMeasure += parsed.data.measures.length;
  }

  input.onStatus?.("Montando el MusicXML…");
  const { score, composer, warnings } = assemble(pages);
  const xml = buildMusicXml(score, { composer, software: `Opus Piano · transcripción con ${input.target.model}` });
  return { xml, score, warnings, pages: total, model: input.target.model };
}

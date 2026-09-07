"use client";

import { toJsonSchema } from "@/lib/study-plan";
import { AiError, errorBody, readSse, safeFetch, splitDataUrl, type JsonRequest, type StreamRequest } from "./errors";
import { modelById } from "./models";

/**
 * API de Anthropic (Messages) llamada desde el navegador con la clave del
 * usuario. Todo va en streaming (también el JSON) para que una respuesta larga
 * no agote el tiempo de espera de la conexión.
 */

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/** Los modelos de la lista dicen qué admiten; si el usuario escribe otro, se supone actual. */
function features(model: string) {
  const known = modelById("anthropic", model);
  if (known) return { adaptive: !!known.adaptive, fallbacks: !!known.fallbacks };
  return { adaptive: !/haiku/.test(model), fallbacks: /opus-5|fable/.test(model) };
}

async function post(apiKey: string, model: string, body: Record<string, unknown>, betas: string[], signal?: AbortSignal): Promise<Response> {
  const res = await safeFetch(
    ENDPOINT,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
        ...(betas.length ? { "anthropic-beta": betas.join(",") } : {}),
      },
      body: JSON.stringify(body),
      signal,
    },
    "Anthropic",
  );
  if (res.ok) return res;
  const err = await errorBody(res);
  if (res.status === 401) throw new AiError("Anthropic no acepta la clave de API. Revísala en Ajustes.", 401);
  if (res.status === 400 && /credit|billing/i.test(err.message)) throw new AiError("Tu cuenta de Anthropic no tiene saldo. Añade crédito en platform.claude.com.", 400);
  if (res.status === 429) throw new AiError("Anthropic ha limitado las peticiones por ahora. Espera un momento y vuelve a intentarlo.", 429);
  if (res.status === 404 || err.type === "not_found_error") throw new AiError(`El modelo «${model}» no está disponible con tu clave. Elige otro en Ajustes.`, 404);
  if (res.status === 529) throw new AiError("Anthropic está saturado en este momento. Inténtalo en unos minutos.", 529);
  throw new AiError(err.message, res.status);
}

/** Consume el stream: acumula el texto y vigila el motivo de parada. */
async function collect(res: Response, onDelta?: (t: string) => void): Promise<string> {
  let text = "";
  let stop = "";
  await readSse(res, (ev) => {
    const type = ev.type as string | undefined;
    if (type === "content_block_delta") {
      const delta = ev.delta as { type?: string; text?: string } | undefined;
      if (delta?.type === "text_delta" && delta.text) {
        text += delta.text;
        onDelta?.(delta.text);
      }
    } else if (type === "message_delta") {
      const delta = ev.delta as { stop_reason?: string } | undefined;
      if (delta?.stop_reason) stop = delta.stop_reason;
    } else if (type === "error") {
      const e = ev.error as { message?: string } | undefined;
      throw new AiError(e?.message ?? "Anthropic ha devuelto un error.");
    }
  });
  if (stop === "refusal") throw new AiError("El modelo no ha querido responder a esta petición.");
  if (stop === "max_tokens") throw new AiError("La respuesta se quedó sin espacio de salida. Prueba con menos páginas o con otro modelo.");
  return text;
}

function common(model: string, effort: JsonRequest["effort"], maxTokens: number, instructions: string) {
  const f = features(model);
  return {
    body: {
      model,
      max_tokens: maxTokens,
      system: instructions,
      stream: true,
      ...(f.adaptive ? { thinking: { type: "adaptive" }, output_config: { effort } } : {}),
      ...(f.fallbacks ? { fallbacks: "default" } : {}),
    } as Record<string, unknown>,
    betas: f.fallbacks ? [FALLBACK_BETA] : [],
  };
}

export async function requestJson(apiKey: string, model: string, req: JsonRequest, signal?: AbortSignal): Promise<string> {
  const content = req.content.map((p) => {
    if (p.type === "text") return { type: "text", text: p.text };
    const { mediaType, data } = splitDataUrl(p.dataUrl);
    return { type: "image", source: { type: "base64", media_type: mediaType, data } };
  });
  const { body, betas } = common(model, req.effort, req.maxOutputTokens, req.instructions);
  const output = (body.output_config as Record<string, unknown> | undefined) ?? {};
  body.output_config = { ...output, format: { type: "json_schema", schema: toJsonSchema(req.schema, "anyOf") } };
  body.messages = [{ role: "user", content }];
  const res = await post(apiKey, model, body, betas, signal);
  return collect(res);
}

export async function streamText(apiKey: string, model: string, req: StreamRequest, onDelta: (text: string) => void, signal?: AbortSignal): Promise<string> {
  const { body, betas } = common(model, req.effort, req.maxOutputTokens, req.instructions);
  body.messages = req.history.map((t) => ({ role: t.role, content: t.content }));
  const res = await post(apiKey, model, body, betas, signal);
  return collect(res, onDelta);
}

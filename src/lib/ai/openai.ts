"use client";

import { toJsonSchema } from "@/lib/study-plan";
import { AiError, errorBody, readSse, safeFetch, type JsonRequest, type StreamRequest } from "./errors";

/** API de OpenAI (Responses) llamada desde el navegador con la clave del usuario. */

const ENDPOINT = "https://api.openai.com/v1/responses";

/** Modelos que aceptan `reasoning` (los de la lista y, si el usuario escribe otro, por prefijo). */
const acceptsReasoning = (model: string) => /^(gpt-5|gpt-6|o[0-9])/.test(model);

async function post(apiKey: string, model: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  const res = await safeFetch(
    ENDPOINT,
    { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body), signal },
    "OpenAI",
  );
  if (res.ok) return res;
  const err = await errorBody(res);
  if (res.status === 401) throw new AiError("OpenAI no acepta la clave de API. Revísala en Ajustes.", 401);
  if (res.status === 429 && err.code === "insufficient_quota") throw new AiError("Tu cuenta de OpenAI no tiene saldo. Añade crédito en platform.openai.com.", 429);
  if (res.status === 429) throw new AiError("OpenAI ha limitado las peticiones por ahora. Espera un momento y vuelve a intentarlo.", 429);
  if (res.status === 404 || err.code === "model_not_found") throw new AiError(`El modelo «${model}» no está disponible con tu clave. Elige otro en Ajustes.`, 404);
  throw new AiError(err.message, res.status);
}

interface ResponseObject {
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output?: { type: string; content?: { type: string; text?: string; refusal?: string }[] }[];
}

/** Texto de salida de una respuesta; lanza si el modelo rehusó o se quedó sin tokens. */
function outputText(r: ResponseObject): string {
  let text = "";
  for (const item of r.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "refusal") throw new AiError(`El modelo no ha querido responder: ${part.refusal ?? ""}`.trim());
      if (part.type === "output_text") text += part.text ?? "";
    }
  }
  if (r.status === "incomplete") {
    const why = r.incomplete_details?.reason === "max_output_tokens" ? "se quedó sin espacio de salida" : "quedó incompleta";
    throw new AiError(`La respuesta ${why}. Prueba con menos páginas o con otro modelo.`);
  }
  return text;
}

export async function requestJson(apiKey: string, model: string, req: JsonRequest, signal?: AbortSignal): Promise<string> {
  const content = req.content.map((p) => (p.type === "text" ? { type: "input_text", text: p.text } : { type: "input_image", image_url: p.dataUrl, detail: "high" }));
  const res = await post(
    apiKey,
    model,
    {
      model,
      instructions: req.instructions,
      input: [{ role: "user", content }],
      text: { format: { type: "json_schema", name: req.schemaName, schema: toJsonSchema(req.schema, "typeArray"), strict: true } },
      ...(acceptsReasoning(model) ? { reasoning: { effort: req.effort } } : {}),
      max_output_tokens: req.maxOutputTokens,
      store: false,
    },
    signal,
  );
  return outputText((await res.json()) as ResponseObject);
}

export async function streamText(apiKey: string, model: string, req: StreamRequest, onDelta: (text: string) => void, signal?: AbortSignal): Promise<string> {
  const res = await post(
    apiKey,
    model,
    {
      model,
      instructions: req.instructions,
      input: req.history.map((t) => ({ role: t.role, content: t.content })),
      ...(acceptsReasoning(model) ? { reasoning: { effort: req.effort } } : {}),
      max_output_tokens: req.maxOutputTokens,
      store: false,
      stream: true,
    },
    signal,
  );
  let full = "";
  await readSse(res, (ev) => {
    const type = ev.type as string | undefined;
    const delta = ev.delta as string | undefined;
    if ((type === "response.output_text.delta" || type === "response.refusal.delta") && delta) {
      full += delta;
      onDelta(delta);
    } else if (type === "response.failed" || type === "error") {
      const r = ev.response as { error?: { message?: string } } | undefined;
      const e = ev.error as { message?: string } | undefined;
      throw new AiError(r?.error?.message ?? e?.message ?? "OpenAI ha devuelto un error.");
    }
  });
  return full;
}

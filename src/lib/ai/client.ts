"use client";

import type { AiTarget } from "./config";
import type { JsonRequest, StreamRequest } from "./errors";
import * as openai from "./openai";
import * as anthropic from "./anthropic";

/** Elige la implementación del proveedor activo. */
const impl = (t: AiTarget) => (t.provider === "anthropic" ? anthropic : openai);

/** Una respuesta JSON que cumple el esquema. Devuelve el texto JSON sin analizar. */
export function requestJson(t: AiTarget, req: JsonRequest, signal?: AbortSignal): Promise<string> {
  return impl(t).requestJson(t.apiKey, t.model, req, signal);
}

/** Respuesta de texto en streaming; `onDelta` recibe cada trozo. Devuelve el texto completo. */
export function streamText(t: AiTarget, req: StreamRequest, onDelta: (text: string) => void, signal?: AbortSignal): Promise<string> {
  return impl(t).streamText(t.apiKey, t.model, req, onDelta, signal);
}

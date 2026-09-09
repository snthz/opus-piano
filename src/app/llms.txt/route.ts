import { llmsTxt } from "@/lib/llms";

export const dynamic = "force-static";

/**
 * `/llms.txt`: el índice del sitio para modelos de lenguaje (llmstxt.org).
 * Se sirve como texto plano porque es lo que saben leer los agentes que lo
 * piden; `charset=utf-8` es obligatorio o los acentos llegan rotos.
 */
export function GET(): Response {
  return new Response(llmsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}

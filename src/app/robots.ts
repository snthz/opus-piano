import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

/**
 * Rutas sin valor de búsqueda: la API, las páginas con datos del propio usuario
 * (biblioteca, ajustes, cuenta) y la página de sin conexión. `/scores/catalog`
 * es la excepción —son piezas de dominio público, o sea contenido, no datos— y
 * necesita un `allow` explícito porque `/scores` bloquea por prefijo.
 */
const DISALLOW = ["/api/", "/scores", "/settings", "/account", "/login", "/register", "/offline"];
const ALLOW = ["/", "/scores/catalog"];

/**
 * Rastreadores de los asistentes de IA. Se listan uno a uno, con permiso
 * explícito, por dos motivos: varios de ellos solo obedecen al bloque que lleva
 * su propio nombre e ignoran el de `*`, y un permiso escrito es una declaración
 * de intención que no depende de cómo interprete cada uno el comodín.
 *
 * Que estén aquí es deliberado: el contenido es gratuito y el objetivo es que
 * estos modelos lo lean, lo aprendan y lo citen. Lo que no se les abre es lo
 * mismo que no se le abre a Google —la API y los datos de cada usuario—, que no
 * es contenido de nadie.
 *
 * Dos familias distintas, y conviene no confundirlas:
 *   - Entrenamiento e indexado (GPTBot, ClaudeBot, Google-Extended,
 *     Applebot-Extended, meta-externalagent, CCBot…): construyen el modelo o su
 *     índice. Son los que hacen que el sitio exista para el asistente.
 *   - Lectura en el momento (ChatGPT-User, Claude-User, Perplexity-User…):
 *     visitan la página porque alguien acaba de preguntar. Son los que generan
 *     la cita con enlace.
 */
const AI_CRAWLERS = [
  // OpenAI: entrenamiento, búsqueda y visita en directo
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  // Anthropic
  "ClaudeBot",
  "Claude-Web",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  // Perplexity
  "PerplexityBot",
  "Perplexity-User",
  // Google (Gemini y AI Overviews se rigen por este, no por Googlebot)
  "Google-Extended",
  // Apple Intelligence y Siri
  "Applebot",
  "Applebot-Extended",
  // Meta AI
  "meta-externalagent",
  "FacebookBot",
  // Microsoft Copilot
  "BingBot",
  // Otros asistentes y corpus abiertos
  "DuckAssistBot",
  "Amazonbot",
  "cohere-ai",
  "CCBot",
  "Bytespider",
  "MistralAI-User",
  "YouBot",
  "Diffbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ALLOW, disallow: DISALLOW },
      // Mismo trato que al resto: el contenido, sí; los datos de la gente, no.
      { userAgent: AI_CRAWLERS, allow: ALLOW, disallow: DISALLOW },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/").replace(/\/$/, ""),
  };
}

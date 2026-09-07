/**
 * Proveedores y modelos disponibles para el plan de estudio. Cada usuario usa
 * su propia clave de API; las peticiones salen del navegador directamente al
 * proveedor. Precios por millón de tokens según las páginas oficiales de
 * precios (septiembre de 2026).
 */

export type Provider = "openai" | "anthropic";

export interface ProviderInfo {
  id: Provider;
  name: string;
  /** Cómo se llama el producto para el usuario */
  product: string;
  keyPrefix: string;
  keysUrl: string;
  /** Dónde se ve el consumo y se añade saldo */
  billingUrl: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "openai",
    name: "OpenAI",
    product: "ChatGPT",
    keyPrefix: "sk-",
    keysUrl: "https://platform.openai.com/api-keys",
    billingUrl: "https://platform.openai.com/settings/organization/billing",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    product: "Claude",
    keyPrefix: "sk-ant-",
    keysUrl: "https://platform.claude.com/settings/keys",
    billingUrl: "https://platform.claude.com/settings/billing",
  },
];

export const providerById = (id: Provider) => PROVIDERS.find((p) => p.id === id)!;

/** 1-5 estrellas en cada eje; «economy» = más estrellas, más barato. */
export interface AiModel {
  provider: Provider;
  id: string;
  name: string;
  tagline: string;
  speed: number;
  precision: number;
  economy: number;
  /** Dólares por millón de tokens */
  input: number;
  output: number;
  /** El recomendado de su proveedor */
  recommended?: boolean;
  /** Anthropic: admite `thinking: adaptive` y `output_config.effort` */
  adaptive?: boolean;
  /** Anthropic: usar `fallbacks: "default"` por si el modelo rehúsa (Opus 5 y Fable) */
  fallbacks?: boolean;
  /** Lado largo en píxeles que procesa sin reescalar, si no es el de su proveedor */
  imageEdge?: number;
}

export const AI_MODELS: AiModel[] = [
  /* ---- OpenAI (developers.openai.com/api/docs/pricing) ---- */
  { provider: "openai", id: "gpt-5.6-terra", name: "GPT-5.6 Terra", tagline: "Equilibrio entre precisión, rapidez y precio.", speed: 4, precision: 4, economy: 3, input: 2, output: 12, recommended: true },
  { provider: "openai", id: "gpt-5.6-sol", name: "GPT-5.6 Sol", tagline: "Máxima precisión leyendo la partitura; más lento y caro.", speed: 3, precision: 5, economy: 2, input: 4, output: 20 },
  { provider: "openai", id: "gpt-6-astra", name: "GPT-6 Astra", tagline: "El modelo más capaz de OpenAI. Muy caro para un plan de estudio.", speed: 2, precision: 5, economy: 1, input: 10, output: 50 },
  { provider: "openai", id: "gpt-5.6-luna", name: "GPT-5.6 Luna", tagline: "Rápido y muy barato; puede equivocarse en detalles de la partitura.", speed: 5, precision: 3, economy: 5, input: 0.2, output: 1.2 },
  { provider: "openai", id: "gpt-5.4-mini", name: "GPT-5.4 mini", tagline: "Generación anterior, ligero y económico.", speed: 4, precision: 3, economy: 4, input: 0.75, output: 4.5 },
  { provider: "openai", id: "gpt-5-mini", name: "GPT-5 mini", tagline: "El más barato de OpenAI; para probar sin gastar.", speed: 4, precision: 2, economy: 5, input: 0.25, output: 2 },

  /* ---- Anthropic (platform.claude.com/docs/en/about-claude/pricing) ---- */
  { provider: "anthropic", id: "claude-sonnet-5", name: "Claude Sonnet 5", tagline: "Equilibrio entre precisión, rapidez y precio.", speed: 4, precision: 4, economy: 3, input: 2, output: 10, recommended: true, adaptive: true },
  { provider: "anthropic", id: "claude-opus-5", name: "Claude Opus 5", tagline: "Máxima precisión leyendo la partitura; más lento y caro.", speed: 3, precision: 5, economy: 2, input: 5, output: 25, adaptive: true, fallbacks: true },
  { provider: "anthropic", id: "claude-fable-5-1", name: "Claude Fable 5.1", tagline: "El modelo más capaz de Anthropic. Muy caro para un plan de estudio.", speed: 2, precision: 5, economy: 1, input: 10, output: 50, adaptive: true, fallbacks: true },
  { provider: "anthropic", id: "claude-haiku-4-5", name: "Claude Haiku 4.5", tagline: "Rápido y barato; puede equivocarse en detalles de la partitura.", speed: 5, precision: 3, economy: 4, input: 1, output: 5, imageEdge: 1568 },
];

export const modelsOf = (provider: Provider) => AI_MODELS.filter((m) => m.provider === provider);
export const modelById = (provider: Provider, id: string) => AI_MODELS.find((m) => m.provider === provider && m.id === id);
export const defaultModel = (provider: Provider) => modelsOf(provider).find((m) => m.recommended)!.id;

/**
 * Lado largo (px) al que conviene rasterizar una página para este modelo: el
 * mayor que procesa sin reescalar. Pasarse no da más detalle, solo engorda la
 * petición, porque el proveedor la reduce igualmente.
 *   · OpenAI con `detail: "high"`: la imagen se encaja en 2048×2048.
 *   · Anthropic desde Claude 4.7: 2576 px (los anteriores, 1568).
 */
export function maxImageEdge(provider: Provider, model: string): number {
  return modelById(provider, model)?.imageEdge ?? (provider === "anthropic" ? 2576 : 2048);
}

/** Coste aproximado de un plan (unos 25 000 tokens de entrada con imágenes y 6 000 de salida), en dólares. */
export function estimatePlanCost(model: AiModel): number {
  return (25_000 * model.input + 6_000 * model.output) / 1_000_000;
}

/**
 * Coste aproximado de transcribir un PDF, en dólares: por página, la imagen y
 * las instrucciones rondan los 4 000 tokens de entrada, y una página densa de
 * piano en notación compacta unos 6 000 de salida contando el razonamiento.
 */
export function estimateTranscriptionCost(model: AiModel, pages: number): number {
  return (pages * (4_000 * model.input + 6_000 * model.output)) / 1_000_000;
}

export function formatCost(dollars: number): string {
  return dollars < 0.01 ? "menos de 1 ¢" : dollars < 1 ? `unos ${Math.round(dollars * 100)} ¢` : `unos ${dollars.toFixed(2)} $`;
}

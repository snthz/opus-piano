"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import { clearAiConfig, setKey, setModel, setProvider, useAiConfig } from "@/lib/ai/config";
import { estimatePlanCost, formatCost, modelById, modelsOf, providerById, PROVIDERS, type AiModel, type Provider } from "@/lib/ai/models";

/** Valor de la opción que abre el campo de identificador libre. */
const CUSTOM = "__custom__";

/**
 * Proveedor, clave de API y modelo para el plan de estudio con IA. Todo se
 * guarda solo en este dispositivo; la clave nunca pasa por el servidor.
 * `compact` es la versión que se muestra dentro del panel del plan cuando aún
 * no hay clave.
 */
export function AiSettings({ compact = false }: { compact?: boolean }) {
  const config = useAiConfig();
  const provider = providerById(config.provider);
  const key = config.keys[config.provider];
  const model = config.models[config.provider];
  const [show, setShow] = useState(false);
  const known = modelById(config.provider, model);
  // Un modelo guardado que ya no está en el catálogo abre el campo libre solo.
  const [customOpen, setCustomOpen] = useState(false);
  const custom = customOpen || !known;

  return (
    <div className="space-y-4">
      {!compact && (
        <p className="text-sm text-ink-2">
          El plan de estudio lo prepara un modelo de IA con <strong>tu propia clave de API</strong>: se guarda solo en este
          dispositivo y las peticiones van directas de tu navegador a {provider.name}. El coste lo pagas tú a{" "}
          {provider.name}; un plan suele salir por céntimos.
        </p>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-medium">Proveedor</p>
        <div className="flex gap-1">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setCustomOpen(false);
                setProvider(p.id);
              }}
              className={`pill text-xs py-1.5 ${config.provider === p.id ? "pill-active" : ""}`}
              aria-pressed={config.provider === p.id}
            >
              {p.product} · {p.name}
            </button>
          ))}
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Clave de API de {provider.name}</span>
        <span className="block text-xs text-ink-2">
          Se crea en{" "}
          <a href={provider.keysUrl} target="_blank" rel="noreferrer" className="underline">
            {provider.keysUrl.replace("https://", "")}
          </a>{" "}
          y empieza por «{provider.keyPrefix}». Hace falta tener saldo en esa cuenta.
        </span>
        <span className="flex gap-2">
          <input
            type={show ? "text" : "password"}
            value={key}
            onChange={(e) => setKey(config.provider, e.target.value)}
            placeholder={`${provider.keyPrefix}…`}
            autoComplete="off"
            spellCheck={false}
            className="flex-1 min-w-0 rounded-2xl px-3 py-2 text-sm bg-surface-2 font-mono focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button type="button" onClick={() => setShow((v) => !v)} className="pill text-xs py-1.5 shrink-0">
            {show ? "Ocultar" : "Ver"}
          </button>
        </span>
        {key && !key.startsWith(provider.keyPrefix) && (
          <span className="block text-xs text-bad">Las claves de {provider.name} empiezan por «{provider.keyPrefix}». Comprueba que la has copiado entera.</span>
        )}
      </label>

      <div className="space-y-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Modelo</span>
          <Select
            value={custom ? CUSTOM : model}
            onChange={(next) => {
              if (next === CUSTOM) {
                setCustomOpen(true);
                return;
              }
              setCustomOpen(false);
              setModel(config.provider, next);
            }}
            options={[
              ...modelsOf(config.provider).map((m) => ({ value: m.id, label: m.name, hint: m.recommended ? "recomendado" : undefined })),
              { value: CUSTOM, label: "Otro modelo…" },
            ]}
          />
        </label>

        {custom ? (
          <label className="block space-y-1">
            <span className="block text-xs text-ink-3">Escribe el identificador exacto del modelo en {provider.name}.</span>
            <input
              value={known ? "" : model}
              onChange={(e) => setModel(config.provider, e.target.value)}
              placeholder={config.provider === "openai" ? "gpt-…" : "claude-…"}
              spellCheck={false}
              className="w-full rounded-2xl px-3 py-2 text-sm bg-surface-2 font-mono focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
        ) : (
          known && <ModelInfo model={known} />
        )}
      </div>

      {!compact && (config.keys.openai || config.keys.anthropic) && (
        <div className="flex justify-end">
          <button type="button" onClick={clearAiConfig} className="text-xs text-bad hover:underline">
            Borrar claves y ajustes de IA de este dispositivo
          </button>
        </div>
      )}
    </div>
  );
}

function ModelInfo({ model }: { model: AiModel }) {
  return (
    <div className="rounded-2xl px-4 py-3 bg-surface-2 space-y-1.5">
      <span className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold">{model.name}</span>
        {model.recommended && <span className="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-accent text-bg">Recomendado</span>}
        <span className="text-xs text-ink-3 ml-auto">{formatCost(estimatePlanCost(model))} por plan</span>
      </span>
      <span className="block text-xs text-ink-2">{model.tagline}</span>
      <span className="grid grid-cols-3 gap-2 text-xs">
        <Stars label="Rapidez" value={model.speed} />
        <Stars label="Precisión" value={model.precision} />
        <Stars label="Economía" value={model.economy} />
      </span>
      <span className="block text-xs text-ink-3 font-mono">{model.id}</span>
    </div>
  );
}

function Stars({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex flex-col" aria-label={`${label}: ${value} de 5`}>
      <span className="text-ink-3">{label}</span>
      <span className="tracking-tight text-accent" aria-hidden>
        {"★".repeat(value)}
        <span className="opacity-30">{"★".repeat(5 - value)}</span>
      </span>
    </span>
  );
}

/** Nombre corto del modelo activo, para pies de página («GPT-5.6 Terra»). */
export function modelLabel(provider: Provider, id: string): string {
  return modelById(provider, id)?.name ?? id;
}

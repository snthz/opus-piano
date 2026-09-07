"use client";

import { useState } from "react";
import { clearAiConfig, setKey, setModel, setProvider, useAiConfig } from "@/lib/ai/config";
import { estimatePlanCost, formatCost, modelById, modelsOf, providerById, PROVIDERS, type AiModel, type Provider } from "@/lib/ai/models";

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
  const [custom, setCustom] = useState(!known && model !== "");

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
              onClick={() => setProvider(p.id)}
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
        <p className="text-sm font-medium">Modelo</p>
        <div className="grid gap-2" role="radiogroup" aria-label="Modelo">
          {modelsOf(config.provider).map((m) => (
            <ModelCard
              key={m.id}
              model={m}
              selected={!custom && model === m.id}
              onSelect={() => {
                setCustom(false);
                setModel(config.provider, m.id);
              }}
            />
          ))}
          <label className={`rounded-2xl px-4 py-3 border-2 cursor-pointer ${custom ? "border-accent bg-accent-soft/40" : "border-transparent bg-surface-2"}`}>
            <span className="flex items-center gap-2">
              <input type="radio" name="ai-model" checked={custom} onChange={() => setCustom(true)} className="accent-(--accent)" />
              <span className="text-sm font-medium">Otro modelo</span>
              <span className="text-xs text-ink-3">escribe su identificador exacto</span>
            </span>
            {custom && (
              <input
                value={known ? "" : model}
                onChange={(e) => setModel(config.provider, e.target.value)}
                placeholder={config.provider === "openai" ? "gpt-…" : "claude-…"}
                spellCheck={false}
                className="mt-2 w-full rounded-2xl px-3 py-2 text-sm bg-surface font-mono focus:outline-none focus:ring-2 focus:ring-accent"
              />
            )}
          </label>
        </div>
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

function ModelCard({ model, selected, onSelect }: { model: AiModel; selected: boolean; onSelect: () => void }) {
  return (
    <label className={`rounded-2xl px-4 py-3 border-2 cursor-pointer ${selected ? "border-accent bg-accent-soft/40" : "border-transparent bg-surface-2"}`}>
      <span className="flex items-start gap-3">
        <input type="radio" name="ai-model" checked={selected} onChange={onSelect} className="accent-(--accent) mt-1" />
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{model.name}</span>
            {model.recommended && <span className="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-accent text-white">Recomendado</span>}
            <span className="text-xs text-ink-3 ml-auto">{formatCost(estimatePlanCost(model))} por plan</span>
          </span>
          <span className="block text-xs text-ink-2">{model.tagline}</span>
          <span className="grid grid-cols-3 gap-2 text-xs">
            <Stars label="Rapidez" value={model.speed} />
            <Stars label="Precisión" value={model.precision} />
            <Stars label="Economía" value={model.economy} />
          </span>
        </span>
      </span>
    </label>
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

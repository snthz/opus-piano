"use client";

import { useEffect, useState } from "react";
import { useSettings } from "@/lib/settings";
import { useProgress, resetProgress, summarize } from "@/lib/progress";
import { clearScores, scoresSize } from "@/lib/scores-db";
import { playNote, unlockAudio } from "@/lib/audio/synth";

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function SettingsPanel() {
  const { settings, update, reset } = useSettings();
  const progress = useProgress();
  const totals = summarize(progress);
  const [library, setLibrary] = useState<{ count: number; bytes: number } | null>(null);
  const [confirm, setConfirm] = useState<"progress" | "scores" | "all" | null>(null);

  const refreshLibrary = () => { void scoresSize().then(setLibrary); };
  useEffect(refreshLibrary, []);

  const preview = async () => {
    await unlockAudio();
    playNote(60, { duration: 0.4 });
  };

  return (
    <div className="space-y-4">
      <section className="card p-5 space-y-4">
        <h2 className="font-bold">Notación</h2>
        <Row label="Nombres de las notas" hint="Cómo se muestran las notas en toda la app.">
          <Segmented
            options={[
              { value: "latino", label: "Do Re Mi" },
              { value: "anglosajon", label: "C D E" },
            ]}
            value={settings.naming}
            onChange={(v) => update({ naming: v as typeof settings.naming })}
          />
        </Row>
        <Row label="Nombres en el teclado" hint="Etiquetas sobre las teclas del piano virtual.">
          <Toggle checked={settings.keyLabels} onChange={(v) => update({ keyLabels: v })} label="Nombres en el teclado" />
        </Row>
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="font-bold">Sonido</h2>
        <Row label="Sonido activado" hint="Piano, metrónomo y ejercicios de oído.">
          <Toggle checked={settings.sound} onChange={(v) => update({ sound: v })} label="Sonido activado" />
        </Row>
        <Row label={`Volumen · ${Math.round(settings.volume * 100)}%`}>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.volume * 100)}
              onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
              className="accent-(--accent) w-36"
              aria-label="Volumen"
              disabled={!settings.sound}
            />
            <button
              type="button"
              onClick={() => void preview()}
              disabled={!settings.sound}
              className="pill text-xs py-1.5 disabled:opacity-40"
            >
              Probar
            </button>
          </div>
        </Row>
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="font-bold">Transcripción con IA</h2>
        <p className="text-sm text-ink-2">
          Con una clave de la API de OpenAI, Etude puede convertir un PDF en MusicXML para escucharlo y ver el
          nombre de cada nota. La clave se guarda solo en este dispositivo y se envía únicamente a api.openai.com.
          Cada transcripción consume crédito de tu cuenta y el resultado es un borrador: revísalo.
        </p>
        <label className="block">
          <span className="text-sm font-medium">Clave de API</span>
          <input
            type="password"
            value={settings.openaiKey}
            onChange={(e) => update({ openaiKey: e.target.value.trim() })}
            placeholder="sk-…"
            autoComplete="off"
            spellCheck={false}
            className="mt-1 w-full rounded-2xl px-4 py-2 text-sm bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Modelo</span>
          <span className="block text-xs text-ink-2">Debe admitir imágenes (gpt-4o, gpt-4.1, gpt-5…).</span>
          <input
            type="text"
            value={settings.openaiModel}
            onChange={(e) => update({ openaiModel: e.target.value.trim() })}
            spellCheck={false}
            className="mt-1 w-full rounded-2xl px-4 py-2 text-sm bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="font-bold">Datos guardados</h2>
        <p className="text-sm text-ink-2">
          Todo se guarda solo en este dispositivo. Nada se envía a ningún servidor.
        </p>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Respuestas" value={String(totals.attempts)} />
          <Stat label="Aciertos" value={`${totals.accuracy}%`} />
          <Stat label="Partituras" value={library ? String(library.count) : "—"} />
        </dl>
        {library && library.count > 0 && (
          <p className="text-xs text-ink-3">La biblioteca ocupa unos {formatBytes(library.bytes)}.</p>
        )}

        <div className="space-y-2 pt-2">
          <DangerRow
            label="Borrar progreso de práctica"
            active={confirm === "progress"}
            onAsk={() => setConfirm("progress")}
            onCancel={() => setConfirm(null)}
            onConfirm={() => { resetProgress(); setConfirm(null); }}
          />
          <DangerRow
            label="Borrar todas las partituras"
            active={confirm === "scores"}
            onAsk={() => setConfirm("scores")}
            onCancel={() => setConfirm(null)}
            onConfirm={() => { void clearScores().then(() => { refreshLibrary(); setConfirm(null); }); }}
          />
          <DangerRow
            label="Borrar todo y restablecer ajustes"
            active={confirm === "all"}
            onAsk={() => setConfirm("all")}
            onCancel={() => setConfirm(null)}
            onConfirm={() => {
              resetProgress();
              reset();
              void clearScores().then(() => { refreshLibrary(); setConfirm(null); });
            }}
          />
        </div>
      </section>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-ink-2 mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 py-3">
      <dd className="text-lg font-bold tabular-nums">{value}</dd>
      <dt className="text-xs text-ink-2">{label}</dt>
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1 shrink-0">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`pill text-xs py-1.5 ${value === o.value ? "pill-active" : ""}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`w-12 h-7 rounded-full p-0.5 shrink-0 transition-colors ${checked ? "bg-ink" : "bg-surface-3"}`}
    >
      <span
        className={`block w-6 h-6 rounded-full bg-surface shadow transition-transform ${checked ? "translate-x-5" : ""}`}
      />
    </button>
  );
}

function DangerRow({
  label,
  active,
  onAsk,
  onCancel,
  onConfirm,
}: {
  label: string;
  active: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (active) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-bad-soft px-4 py-2.5">
        <span className="text-sm font-medium">¿Seguro? No se puede deshacer.</span>
        <span className="flex gap-2 shrink-0">
          <button type="button" onClick={onConfirm} className="pill text-xs py-1 bg-bad text-bg">Borrar</button>
          <button type="button" onClick={onCancel} className="pill text-xs py-1">Cancelar</button>
        </span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onAsk}
      className="w-full text-left text-sm rounded-2xl px-4 py-2.5 bg-surface-2 hover:bg-bad-soft transition-colors"
    >
      {label}
    </button>
  );
}

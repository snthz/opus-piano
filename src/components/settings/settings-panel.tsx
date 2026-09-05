"use client";

import { useEffect, useState } from "react";
import { useSettings } from "@/lib/settings";
import { useProgress, useSyncState, resetProgress, summarize, syncProgress } from "@/lib/progress";
import { getProfile, linkProfile, type Profile } from "@/lib/profile";
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
        <h2 className="font-bold">Progreso y sincronización</h2>
        <p className="text-sm text-ink-2">
          Tu progreso de práctica se guarda en el servidor bajo un perfil sin contraseña, y sigue funcionando sin
          conexión: lo que hagas se envía cuando vuelva la red. Para ver el mismo progreso en otro dispositivo,
          introduce allí el código de este perfil. Las partituras no se sincronizan: se quedan en cada dispositivo.
        </p>
        <SyncPanel />
      </section>

      <section className="card p-5 space-y-2">
        <h2 className="font-bold">Transcripción de PDF</h2>
        <p className="text-sm text-ink-2">
          Convertir un PDF en MusicXML lo hace <strong>oemer</strong>, un reconocedor de partituras de código abierto
          que corre en tu propio servidor. No necesita claves ni servicios externos; tarda varios minutos por página y
          el resultado es un borrador. Se inicia desde el lector de cada PDF con «Escuchar».
        </p>
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
            onConfirm={() => { void resetProgress(); setConfirm(null); }}
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
              void resetProgress();
              reset();
              void clearScores().then(() => { refreshLibrary(); setConfirm(null); });
            }}
          />
        </div>
      </section>
    </div>
  );
}

function SyncPanel() {
  const sync = useSyncState();
  // Este panel solo se monta en cliente (ClientOnly), así que localStorage existe.
  const [profile, setProfile] = useState<Profile | null>(() => getProfile());
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = async () => {
    try {
      const p = await linkProfile(code);
      setProfile(p);
      setCode("");
      setMessage("Dispositivo vinculado. Sincronizando…");
      await syncProgress();
      setMessage("Listo: este dispositivo usa ahora ese perfil.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo vincular.");
    }
  };

  const copy = async () => {
    if (!profile) return;
    try {
      await navigator.clipboard.writeText(profile.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* sin portapapeles */
    }
  };

  const status = sync.busy
    ? "Sincronizando…"
    : sync.error
      ? `Sin sincronizar (${sync.error})${sync.pending ? ` · ${sync.pending} pendientes` : ""}`
      : sync.lastSync
        ? `Última sincronización: ${new Date(sync.lastSync).toLocaleString("es")}`
        : "Todavía no se ha sincronizado.";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-2xl bg-surface-2 px-4 py-3">
        <div>
          <p className="text-xs text-ink-2">Código de este perfil</p>
          <p className="font-mono text-lg font-bold tracking-[0.2em]">{profile?.code ?? "—"}</p>
        </div>
        <button type="button" onClick={() => void copy()} disabled={!profile} className="pill text-xs py-1.5 disabled:opacity-40">
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="text-xs text-ink-3">{status}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void link();
        }}
        className="flex gap-2"
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Código de otro dispositivo"
          maxLength={8}
          spellCheck={false}
          autoCapitalize="characters"
          className="flex-1 rounded-2xl px-4 py-2 text-sm font-mono tracking-widest bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent"
          aria-label="Código de otro dispositivo"
        />
        <button type="submit" disabled={code.trim().length < 8} className="pill pill-active text-xs disabled:opacity-40">
          Vincular
        </button>
      </form>
      {message && <p className="text-xs text-ink-2">{message}</p>}
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

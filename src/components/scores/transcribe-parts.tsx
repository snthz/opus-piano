"use client";

import type { ParsedScore } from "@/lib/music/musicxml";
import { ProgressRing } from "@/components/ui/progress-ring";

/**
 * Lo que comparten las dos formas de sacar el MusicXML de un PDF —el
 * reconocimiento automático y el modelo de visión—: elegir páginas, esperar y
 * ver el resultado. Cambia el motor, no la conversación con el usuario.
 */

/** Páginas del PDF que se van a leer, con el tope que aguanta cada motor. */
export function PageRange({
  from,
  to,
  pageCount,
  max,
  disabled,
  onChange,
}: {
  from: number;
  to: number;
  pageCount: number;
  max: number;
  disabled?: boolean;
  onChange: (range: { from: number; to: number }) => void;
}) {
  const clampFrom = (value: number) => {
    const next = Math.max(1, Math.min(pageCount, value || 1));
    onChange({ from: next, to: Math.max(next, Math.min(to, next + max - 1)) });
  };
  const clampTo = (value: number) => onChange({ from, to: Math.max(from, Math.min(pageCount, from + max - 1, value || 1)) });

  const input = "w-full rounded-2xl px-3 py-2 text-sm bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60";
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Desde la página</span>
        <input type="number" min={1} max={pageCount} value={from} disabled={disabled} onChange={(e) => clampFrom(Number(e.target.value))} className={input} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Hasta la página</span>
        <input type="number" min={from} max={pageCount} value={to} disabled={disabled} onChange={(e) => clampTo(Number(e.target.value))} className={input} />
      </label>
    </div>
  );
}

/** Anillo, texto de por dónde va y botón de cancelar. */
export function Running({ label, progress, onCancel }: { label: string; progress: number | null; onCancel: () => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <ProgressRing progress={progress} className="w-9 h-9 shrink-0 text-ink" />
        <p className="text-sm text-ink-2 flex-1">{label}</p>
        <button type="button" onClick={onCancel} className="pill text-xs py-1.5">
          Cancelar
        </button>
      </div>
      <p className="text-xs text-ink-3">
        Corre en el servidor: puedes cerrar el panel, la partitura y hasta la pestaña. Al volver te espera aquí, y el
        anillo del lector te avisa cuando esté lista. Cancelar la para de verdad y hay que empezar de cero.
      </p>
    </div>
  );
}

export interface ResultProps {
  score: ParsedScore;
  pages: number;
  warnings: string[];
  /** Ya hay un MusicXML vinculado: usar este lo sustituye */
  hasXml: boolean;
  saved: boolean;
  onUse: () => void;
  onDownload: () => void;
  onDiscard: () => void;
}

/**
 * El resultado, sin disimular que es un borrador: cuántos compases han salido,
 * qué compases no cuadran y la opción de descargarlo para arreglarlo en
 * MuseScore antes de darlo por bueno.
 */
export function TranscriptionResult({ score, pages, warnings, hasXml, saved, onUse, onDownload, onDiscard }: ResultProps) {
  const measures = score.measures.length;
  return (
    <section className="mx-1 border-t border-line pt-4 space-y-4">
      <div>
        <h3 className="font-bold text-sm">Transcripción lista</h3>
        <p className="text-xs text-ink-2 mt-1">
          {measures} {measures === 1 ? "compás" : "compases"} en {pages === 1 ? "una página" : `${pages} páginas`} ·{" "}
          {score.clefs.length === 1 ? "un pentagrama" : `${score.clefs.length} pentagramas`} · compás {score.time.num}/{score.time.den}
          {score.tempo ? ` · ♩ = ${score.tempo}` : ""}
        </p>
      </div>

      {warnings.length ? (
        <div className="rounded-2xl bg-surface-2 px-4 py-3 space-y-1">
          <p className="text-xs font-medium text-ink">
            {warnings.length === 1 ? "Hay 1 aviso que revisar" : `Hay ${warnings.length} avisos que revisar`}
          </p>
          <ul className="text-xs text-ink-2 space-y-0.5 max-h-48 overflow-y-auto">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p className="text-xs text-ink-3 pt-1">
            Un compás que no suma casi siempre es una figura mal leída. Se puede usar igualmente, pero esos compases sonarán
            descolocados hasta que los arregles.
          </p>
        </div>
      ) : (
        <p className="text-xs text-ink-2">Todos los compases suman lo que pide el compás. Aun así, comprueba las notas antes de fiarte del todo.</p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={onUse} className="btn-primary text-sm">
          {hasXml ? "Sustituir el MusicXML vinculado" : "Vincular a esta partitura"}
        </button>
        <button type="button" onClick={onDownload} className="pill text-xs py-1.5">
          Descargar .musicxml
        </button>
        {saved ? (
          <span className="text-xs text-ink-2">Vinculado. Ya puedes cerrar y darle a reproducir.</span>
        ) : (
          <button type="button" onClick={onDiscard} className="text-xs text-ink-2 hover:underline">
            Descartar
          </button>
        )}
      </div>
    </section>
  );
}

const XML_TYPE = "application/vnd.recordare.musicxml+xml";

/** Descarga el MusicXML con el nombre de la partitura. */
export function downloadXml(xml: string, scoreName: string) {
  const url = URL.createObjectURL(new Blob([xml], { type: XML_TYPE }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${scoreName.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 80) || "partitura"}.musicxml`;
  a.click();
  URL.revokeObjectURL(url);
}

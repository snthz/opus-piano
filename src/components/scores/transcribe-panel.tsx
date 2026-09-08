"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { activeTarget, isAiReady, useAiConfig } from "@/lib/ai/config";
import { cancelJob, dismissJob, getJob, startJob, useJob } from "@/lib/ai/jobs";
import { estimateTranscriptionCost, formatCost, modelById } from "@/lib/ai/models";
import { transcribeScore, type TranscribeOutcome } from "@/lib/ai/transcribe-client";
import { MAX_TRANSCRIBE_PAGES } from "@/lib/ai/transcribe";
import { AiSettings } from "@/components/settings/ai-settings";
import { ProgressRing } from "@/components/ui/progress-ring";

interface Props {
  scoreId: string;
  scoreName: string;
  pdf: Blob;
  pageCount: number;
  /** Ya hay un MusicXML vinculado: usarlo lo sustituye */
  hasXml: boolean;
  onUse: (xml: string) => void | Promise<void>;
}

const XML_TYPE = "application/vnd.recordare.musicxml+xml";

/**
 * Transcribe las páginas de un PDF a MusicXML con el modelo de visión del
 * usuario. La tarea corre en segundo plano (ver `lib/ai/jobs`): se puede
 * cerrar el panel y volver cuando el anillo del lector diga que ha acabado.
 * El resultado es un borrador y el panel no lo disimula: enseña cuántos
 * compases han salido, qué compases no cuadran y deja descargar el archivo
 * para arreglarlo en MuseScore antes de darlo por bueno.
 */
export function TranscribePanel({ scoreId, scoreName, pdf, pageCount, hasXml, onUse }: Props) {
  const config = useAiConfig();
  const job = useJob("transcribe", scoreId);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(Math.min(pageCount, MAX_TRANSCRIBE_PAGES));
  const [saved, setSaved] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const ready = isAiReady(config);
  const target = activeTarget(config);
  const model = modelById(target.provider, target.model);
  const pages = Math.max(0, to - from + 1);

  const running = job?.status === "running" ? job : null;
  const result = job?.status === "done" ? job.result : null;
  const error = linkError ?? (job?.status === "error" ? job.error : null);

  const clampFrom = (v: number) => {
    const next = Math.max(1, Math.min(pageCount, v || 1));
    setFrom(next);
    setTo((t) => Math.max(next, Math.min(t, next + MAX_TRANSCRIBE_PAGES - 1)));
  };
  const clampTo = (v: number) => setTo(Math.max(from, Math.min(pageCount, from + MAX_TRANSCRIBE_PAGES - 1, v || 1)));

  const run = () => {
    if (!ready || !pages) return;
    setSaved(false);
    setLinkError(null);
    startJob(
      "transcribe",
      { id: scoreId, name: scoreName },
      ({ signal, report }) =>
        transcribeScore({
          target,
          scoreName,
          pdf,
          from,
          to,
          onStatus: (label) => report({ label }),
          onProgress: (progress) => report({ progress }),
          signal,
        }),
      "No se pudo transcribir la partitura. Vuelve a intentarlo.",
    );
  };

  const use = async () => {
    if (!result) return;
    try {
      await onUse(result.xml);
      setSaved(true);
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "No se pudo vincular la transcripción.");
    }
  };

  const download = () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([result.xml], { type: XML_TYPE }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scoreName.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 80) || "partitura"}.musicxml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const discard = () => dismissJob("transcribe", scoreId);

  // Al cerrar la hoja (se cierre como se cierre), lo ya atendido —vinculado o
  // fallido— deja de reclamar atención en el lector.
  const savedRef = useRef(saved);
  useEffect(() => {
    savedRef.current = saved;
  }, [saved]);
  useEffect(
    () => () => {
      const j = getJob("transcribe", scoreId);
      if (j?.status === "error" || (j?.status === "done" && savedRef.current)) dismissJob("transcribe", scoreId);
    },
    [scoreId],
  );

  return (
    <div className="space-y-4">
      <section className="px-1 space-y-4">
        <p className="text-sm text-ink-2">
          Un modelo de visión lee las páginas del PDF y escribe el <strong>MusicXML</strong> de la pieza, para poder escucharla y ver
          los nombres de las notas sin buscar el archivo por internet.
        </p>
        <p className="rounded-2xl bg-surface-2 px-4 py-3 text-xs text-ink-2">
          <strong className="text-ink">Es un borrador.</strong> Estos modelos se equivocan sobre todo en las duraciones, y un compás
          que no cuadra descoloca la reproducción a partir de ahí. Opus Piano comprueba compás a compás que las figuras sumen lo que
          pide el compás y te dice cuáles no. Para una transcripción fiable, el MusicXML de MuseScore sigue siendo mejor.
        </p>

        {!ready ? (
          <div className="space-y-4">
            <p className="text-sm">
              Hace falta la clave de API de <strong>ChatGPT (OpenAI)</strong> o de <strong>Claude (Anthropic)</strong>. Se guarda solo
              en este dispositivo y el coste lo pagas tú al proveedor. También puedes cambiarla en{" "}
              <Link href="/settings" className="underline">Ajustes</Link>.
            </p>
            <AiSettings compact />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-sm font-medium">Desde la página</span>
                <input
                  type="number"
                  min={1}
                  max={pageCount}
                  value={from}
                  disabled={!!running}
                  onChange={(e) => clampFrom(Number(e.target.value))}
                  className="w-full rounded-2xl px-3 py-2 text-sm bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">Hasta la página</span>
                <input
                  type="number"
                  min={from}
                  max={pageCount}
                  value={to}
                  disabled={!!running}
                  onChange={(e) => clampTo(Number(e.target.value))}
                  className="w-full rounded-2xl px-3 py-2 text-sm bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
                />
              </label>
            </div>

            <div className="rounded-2xl bg-surface-2 px-4 py-3 text-xs text-ink-2 space-y-1">
              <p className="font-medium text-ink">Qué se va a hacer</p>
              <p>
                {pages === 1 ? "Una página" : `${pages} páginas`} de las {pageCount} del PDF, una petición por página.
                {pageCount > MAX_TRANSCRIBE_PAGES ? ` Se transcriben ${MAX_TRANSCRIBE_PAGES} como mucho de una vez.` : ""}
              </p>
              {model ? (
                <p>
                  Modelo: {model.name}{model.recommended ? " (recomendado)" : ""} · {formatCost(estimateTranscriptionCost(model, pages))}.{" "}
                  <Link href="/settings" className="underline">Cambiar</Link>
                </p>
              ) : (
                <p>Modelo: {target.model}</p>
              )}
              <p>Cuanto mejor lee el modelo, mejor sale la transcripción: aquí el modelo más preciso compensa más que en el plan de estudio.</p>
            </div>

            {error && <p className="text-sm text-bad">{error}</p>}

            {running ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <ProgressRing progress={running.progress} className="w-9 h-9 shrink-0 text-ink" />
                  <p className="text-sm text-ink-2 flex-1">{running.label}</p>
                  <button type="button" onClick={() => cancelJob("transcribe", scoreId)} className="pill text-xs py-1.5">
                    Cancelar
                  </button>
                </div>
                <p className="text-xs text-ink-3">Puedes cerrar este panel y seguir leyendo: la transcripción continúa en segundo plano y el anillo del lector te avisa cuando esté lista.</p>
              </div>
            ) : (
              <button type="button" onClick={run} disabled={!pages} className="btn-primary text-sm disabled:opacity-50">
                {result ? "Transcribir otra vez" : "Transcribir"}
              </button>
            )}
          </>
        )}
      </section>

      {result && <Result result={result} hasXml={hasXml} saved={saved} onUse={() => void use()} onDownload={download} onDiscard={discard} />}
    </div>
  );
}

function Result({
  result,
  hasXml,
  saved,
  onUse,
  onDownload,
  onDiscard,
}: {
  result: TranscribeOutcome;
  hasXml: boolean;
  saved: boolean;
  onUse: () => void;
  onDownload: () => void;
  onDiscard: () => void;
}) {
  const measures = result.score.measures.length;
  return (
    <section className="mx-1 border-t border-line pt-4 space-y-4">
      <div>
        <h3 className="font-bold text-sm">Transcripción lista</h3>
        <p className="text-xs text-ink-2 mt-1">
          {measures} {measures === 1 ? "compás" : "compases"} en {result.pages === 1 ? "una página" : `${result.pages} páginas`} ·{" "}
          {result.score.clefs.length === 1 ? "un pentagrama" : `${result.score.clefs.length} pentagramas`} · compás{" "}
          {result.score.time.num}/{result.score.time.den}
          {result.score.tempo ? ` · ♩ = ${result.score.tempo}` : ""}
        </p>
      </div>

      {result.warnings.length ? (
        <div className="rounded-2xl bg-surface-2 px-4 py-3 space-y-1">
          <p className="text-xs font-medium text-ink">
            {result.warnings.length === 1 ? "Hay 1 compás que revisar" : `Hay ${result.warnings.length} avisos que revisar`}
          </p>
          <ul className="text-xs text-ink-2 space-y-0.5 max-h-48 overflow-y-auto">
            {result.warnings.map((w) => (
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

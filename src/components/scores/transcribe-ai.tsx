"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { activeTarget, isAiReady, useAiConfig } from "@/lib/ai/config";
import { estimateTranscriptionCost, formatCost, modelById } from "@/lib/ai/models";
import { transcribeScore } from "@/lib/ai/transcribe-client";
import { MAX_TRANSCRIBE_PAGES } from "@/lib/ai/transcribe";
import { cancelJob, dismissJob, getJob, startJob, useJob } from "@/lib/jobs";
import { AiSettings } from "@/components/settings/ai-settings";
import { PageRange, Running, TranscriptionResult, downloadXml } from "./transcribe-parts";

/**
 * Transcripción con un modelo de visión y la clave del propio usuario. Lee las
 * páginas y escribe el MusicXML entendiendo lo que ve, así que saca cosas que
 * el reconocimiento automático no —una segunda voz apretada, una figura poco
 * clara—, pero se equivoca justo donde más se nota, en las duraciones, y cada
 * página se paga al proveedor.
 */
export function TranscribeWithAi({
  scoreId,
  scoreName,
  pdf,
  pageCount,
  hasXml,
  onUse,
}: {
  scoreId: string;
  scoreName: string;
  pdf: Blob;
  pageCount: number;
  hasXml: boolean;
  onUse: (xml: string) => void | Promise<void>;
}) {
  const config = useAiConfig();
  const job = useJob("transcribe", scoreId);
  const [range, setRange] = useState({ from: 1, to: Math.min(pageCount, MAX_TRANSCRIBE_PAGES) });
  const [saved, setSaved] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const ready = isAiReady(config);
  const target = activeTarget(config);
  const model = modelById(target.provider, target.model);
  const pages = Math.max(0, range.to - range.from + 1);

  const running = job?.status === "running" ? job : null;
  const result = job?.status === "done" ? job.result : null;
  const error = linkError ?? (job?.status === "error" ? job.error : null);

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
          from: range.from,
          to: range.to,
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
          Un modelo de visión lee las páginas del PDF y escribe el <strong>MusicXML</strong> de la pieza. Entiende lo que ve, así que
          se defiende mejor con partituras densas, pero cada página se paga con tu clave de API.
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
            <PageRange {...range} pageCount={pageCount} max={MAX_TRANSCRIBE_PAGES} disabled={!!running} onChange={setRange} />

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
              <Running label={running.label} progress={running.progress} onCancel={() => cancelJob("transcribe", scoreId)} />
            ) : (
              <button type="button" onClick={run} disabled={!pages} className="btn-primary text-sm disabled:opacity-50">
                {result ? "Transcribir otra vez" : "Transcribir"}
              </button>
            )}
          </>
        )}
      </section>

      {result && (
        <TranscriptionResult
          score={result.score}
          pages={result.pages}
          warnings={result.warnings}
          hasXml={hasXml}
          saved={saved}
          onUse={() => void use()}
          onDownload={() => downloadXml(result.xml, scoreName)}
          onDiscard={() => dismissJob("transcribe", scoreId)}
        />
      )}
    </div>
  );
}

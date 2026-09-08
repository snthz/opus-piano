"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { openAuthModal } from "@/lib/auth-modal";
import { cancelJob, dismissJob, getJob, startJob, useJob } from "@/lib/jobs";
import { MAX_OMR_PAGES, transcribeWithOmr } from "@/lib/omr/client";
import { PageRange, Running, TranscriptionResult, downloadXml } from "./transcribe-parts";

/**
 * Reconocimiento automático (OMR): el servidor pasa cada página por oemer, unos
 * modelos entrenados para leer partituras impresas. No hace falta clave de API
 * ni pagar nada, pero tarda unos minutos por página y solo se le da bien lo que
 * está impreso y limpio.
 */
export function TranscribeWithOmr({
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
  const { user } = useAuth();
  const job = useJob("omr", scoreId);
  const [range, setRange] = useState({ from: 1, to: Math.min(pageCount, MAX_OMR_PAGES) });
  const [saved, setSaved] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const pages = Math.max(0, range.to - range.from + 1);
  const running = job?.status === "running" ? job : null;
  const result = job?.status === "done" ? job.result : null;
  const error = linkError ?? (job?.status === "error" ? job.error : null);

  const run = () => {
    if (!user || !pages) return;
    setSaved(false);
    setLinkError(null);
    startJob(
      "omr",
      { id: scoreId, name: scoreName },
      ({ signal, report }) =>
        transcribeWithOmr({
          scoreName,
          pdf,
          from: range.from,
          to: range.to,
          onStatus: (label) => report({ label }),
          onProgress: (progress) => report({ progress }),
          signal,
        }),
      "No se pudo reconocer la partitura. Vuelve a intentarlo.",
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

  const savedRef = useRef(saved);
  useEffect(() => {
    savedRef.current = saved;
  }, [saved]);
  useEffect(
    () => () => {
      const j = getJob("omr", scoreId);
      if (j?.status === "error" || (j?.status === "done" && savedRef.current)) dismissJob("omr", scoreId);
    },
    [scoreId],
  );

  return (
    <div className="space-y-4">
      <section className="px-1 space-y-4">
        <p className="text-sm text-ink-2">
          El servidor lee las páginas con un reconocedor de partituras y monta el <strong>MusicXML</strong>. Es <strong>gratis</strong>,
          no necesita ninguna clave y la partitura no sale de Opus Piano.
        </p>
        <p className="rounded-2xl bg-surface-2 px-4 py-3 text-xs text-ink-2">
          <strong className="text-ink">Saca las notas; el ritmo, regular.</strong> Suele acertar las alturas, las claves y la
          armadura, pero reparte mal las figuras, y un compás que no cuadra descoloca la reproducción a partir de ahí: cuenta con
          repasarlo. Sirve sobre todo para tener el esqueleto y ver los nombres de las notas. Opus Piano comprueba compás a compás
          que las figuras sumen lo que pide el compás y te dice cuáles no.
        </p>
        <p className="rounded-2xl bg-surface-2 px-4 py-3 text-xs text-ink-2">
          Está entrenado con partituras <strong className="text-ink">impresas y limpias</strong>: con una edición escaneada de
          frente se defiende; con una foto torcida, una partitura manuscrita o una página muy apretada, casi seguro que no.
        </p>

        {!user ? (
          <div className="rounded-2xl bg-surface-2 px-4 py-3 space-y-2">
            <p className="text-sm font-semibold">Hace falta una cuenta</p>
            <p className="text-xs text-ink-2">
              El reconocimiento corre en el servidor de Opus Piano y gasta un buen rato de máquina por página, así que se reserva a
              quien tiene cuenta. Es gratis. La transcripción con IA, en cambio, funciona sin cuenta porque la pagas tú al proveedor.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button type="button" onClick={() => openAuthModal("register")} className="pill pill-active text-xs py-1.5">
                Crear cuenta
              </button>
              <button type="button" onClick={() => openAuthModal("login")} className="pill text-xs py-1.5">
                Ya tengo una
              </button>
            </div>
          </div>
        ) : (
          <>
            <PageRange {...range} pageCount={pageCount} max={MAX_OMR_PAGES} disabled={!!running} onChange={setRange} />

            <div className="rounded-2xl bg-surface-2 px-4 py-3 text-xs text-ink-2 space-y-1">
              <p className="font-medium text-ink">Qué se va a hacer</p>
              <p>
                {pages === 1 ? "Una página" : `${pages} páginas`} de las {pageCount} del PDF, una detrás de otra.
                {pageCount > MAX_OMR_PAGES ? ` Se reconocen ${MAX_OMR_PAGES} como mucho de una vez.` : ""}
              </p>
              <p>
                Cada página tarda <strong>dos o tres minutos</strong>. Puedes cerrar el panel y seguir leyendo la partitura
                mientras tanto; si cierras la pestaña, se pierde.
              </p>
            </div>

            {error && <p className="text-sm text-bad">{error}</p>}

            {running ? (
              <Running label={running.label} progress={running.progress} onCancel={() => cancelJob("omr", scoreId)} />
            ) : (
              <button type="button" onClick={run} disabled={!pages} className="btn-primary text-sm disabled:opacity-50">
                {result ? "Reconocer otra vez" : "Reconocer la partitura"}
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
          onDiscard={() => dismissJob("omr", scoreId)}
        />
      )}
    </div>
  );
}

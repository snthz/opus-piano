"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { ProgressRing } from "@/components/ui/progress-ring";
import { useAuth } from "@/lib/auth";
import { openAuthModal } from "@/lib/auth-modal";
import { extractPdfText } from "@/lib/pdf-text";
import { planService } from "@/lib/plan/client";
import { importRouteFromText } from "@/lib/routes/client";
import { IMPORT_TEXT_MAX, type StudyRoute } from "@/lib/study-route";
import { isAbort, UserError } from "@/lib/user-error";

/**
 * "Read a plan": a sheet with a text box and a PDF picker. The PDF's text
 * is pulled out in the browser (pdf.js), so what leaves the device is text
 * either way; the server has the model turn it into a route. Needs an
 * account, because the server pays for the call.
 */
export function RouteImport({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: (r: StudyRoute) => void }) {
  const { user, status: auth } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    planService().then((s) => alive && setEnabled(s.enabled));
    return () => {
      alive = false;
    };
  }, [open]);

  // leaving the sheet mid-read cancels the request: nothing to pay for a route nobody will see
  useEffect(() => {
    if (!open) abort.current?.abort();
  }, [open]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy("Leyendo el PDF…");
    try {
      const extracted = await extractPdfText(file);
      if (extracted.length < 40) throw new UserError("Este PDF no tiene texto que leer: parece escaneado como imagen.");
      setText(extracted.slice(0, IMPORT_TEXT_MAX));
      setFileName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido leer el PDF.");
    } finally {
      setBusy(null);
    }
  };

  const run = async () => {
    if (!user) {
      openAuthModal("register");
      return;
    }
    setError(null);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const route = await importRouteFromText(text, { onStatus: setBusy, signal: controller.signal });
      setText("");
      setFileName(null);
      onImported(route);
      onClose();
    } catch (e) {
      if (isAbort(e)) return;
      setError(e instanceof UserError ? e.message : "No se ha podido leer el plan. Vuelve a intentarlo.");
    } finally {
      setBusy(null);
      abort.current = null;
    }
  };

  const ready = text.trim().length >= 40 && !busy;

  return (
    <Sheet open={open} onClose={onClose} title="Leer un plan de estudio" subtitle="El texto de un plan, o su PDF, convertido en una ruta">
      <div className="space-y-4 pb-2">
        {enabled === false && (
          <p className="rounded-2xl bg-surface-2 p-3 text-sm text-ink-2">La lectura de planes con IA no está disponible en este servidor. Puedes crear la ruta a mano o partir de una plantilla.</p>
        )}

        <div className="space-y-2">
          <label htmlFor="route-import-text" className="block px-1 text-xs font-semibold uppercase tracking-wider text-ink-3">
            Texto del plan
          </label>
          <textarea
            id="route-import-text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setFileName(null);
            }}
            disabled={!!busy}
            rows={9}
            maxLength={IMPORT_TEXT_MAX}
            placeholder="Pega aquí el plan: las piezas en orden, la rutina diaria, los objetivos…"
            className="field h-auto resize-y py-3 text-sm leading-relaxed"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-ink-3">
            <span>{fileName ? `Texto sacado de «${fileName}».` : `${text.length.toLocaleString("es")} de ${IMPORT_TEXT_MAX.toLocaleString("es")} caracteres`}</span>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy} className="font-semibold text-ink hover:underline disabled:opacity-50">
              Subir un PDF
            </button>
            <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          </div>
        </div>

        {error && <p className="px-1 text-sm text-bad">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void run()} disabled={!ready || enabled === false} className="btn-primary text-sm disabled:opacity-50">
            {busy && busy !== "Leyendo el PDF…" ? <ProgressRing progress={null} className="h-4 w-4" /> : null}
            {busy && busy !== "Leyendo el PDF…" ? "Leyendo…" : "Convertir en ruta"}
          </button>
          {busy && <span className="text-sm text-ink-2">{busy}</span>}
          {!busy && !user && auth !== "loading" && <span className="text-sm text-ink-2">Hace falta una cuenta: la lectura la paga el servidor.</span>}
        </div>

        <p className="px-1 text-xs leading-relaxed text-ink-3">
          La ruta se crea en tu dispositivo y puedes corregirla después: cambiar el orden, quitar piezas, enlazar las partituras. Un PDF escaneado como imagen no se puede leer; copia el texto en su lugar.
        </p>
      </div>
    </Sheet>
  );
}

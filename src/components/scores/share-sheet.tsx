"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { openAuthModal } from "@/lib/auth-modal";
import { sharedUrl } from "@/lib/community";
import { updateScoreSharing, type ScoreRecord, type Visibility } from "@/lib/scores-db";
import { Sheet } from "@/components/ui/sheet";

/**
 * Quién puede ver una partitura. Tres opciones, de menos a más: solo yo,
 * quien tenga el enlace, cualquiera desde la lista de la comunidad. Lo que
 * se comparte es el archivo, el nombre, la portada y la presentación de
 * abajo; las notas, los trazos y el análisis no salen de la biblioteca.
 *
 * Compartir pasa por el servidor, así que pide cuenta, y el enlace funciona
 * cuando la partitura ha terminado de subir.
 */

const DESCRIPTION_MAX = 600;

const OPTIONS: { value: Visibility; title: string; text: string }[] = [
  { value: "private", title: "Solo yo", text: "Como hasta ahora: nadie más la ve." },
  { value: "link", title: "Quien tenga el enlace", text: "No aparece en ninguna lista; se abre con la dirección que copies aquí." },
  { value: "public", title: "Cualquiera", text: "Sale en la lista de partituras compartidas, con tu nombre." },
];

interface Props {
  record: ScoreRecord;
  open: boolean;
  onClose: () => void;
  onChange: (patch: Partial<ScoreRecord>) => void;
}

export function ShareSheet({ record, open, onClose, onChange }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Compartir" subtitle={record.name} maxHeight="min(92dvh, 46rem)">
      {/* El formulario se monta al abrir: así arranca siempre de lo guardado (otro dispositivo pudo cambiarlo) sin un efecto que lo reponga. */}
      {open && <ShareForm record={record} onClose={onClose} onChange={onChange} />}
    </Sheet>
  );
}

function ShareForm({ record, onClose, onChange }: Omit<Props, "open">) {
  const { user } = useAuth();
  const [visibility, setVisibility] = useState<Visibility>(record.visibility ?? "private");
  const [description, setDescription] = useState(record.description ?? "");
  const [rights, setRights] = useState((record.visibility ?? "private") !== "private");
  const [copied, setCopied] = useState(false);

  const shared = visibility !== "private";
  const changed = visibility !== (record.visibility ?? "private") || description.trim() !== (record.description ?? "");
  const canSave = !!user && changed && (!shared || rights);

  const save = async () => {
    const patch = { visibility, description: description.trim() };
    await updateScoreSharing(record.id, patch);
    onChange(patch);
    onClose();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sharedUrl(record.id));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      {!user ? (
        <div className="space-y-3 py-2">
          <p className="text-sm leading-relaxed text-ink-2">
            Para compartir hace falta una cuenta: es el servidor el que enseña la partitura a los demás, y sin cuenta la partitura solo está en este dispositivo.
          </p>
          <button type="button" onClick={() => { onClose(); openAuthModal("register"); }} className="pill pill-active">
            Crear una cuenta o entrar
          </button>
        </div>
      ) : (
        <div className="space-y-4 py-2">
          <fieldset className="space-y-2">
            <legend className="sr-only">Quién puede verla</legend>
            {OPTIONS.map((o) => (
              <label key={o.value} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors ${visibility === o.value ? "border-ink bg-surface-2" : "border-line hover:bg-surface-2"}`}>
                <input type="radio" name="visibility" value={o.value} checked={visibility === o.value} onChange={() => setVisibility(o.value)} className="mt-1 accent-(--ink)" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{o.title}</span>
                  <span className="block text-xs leading-relaxed text-ink-2">{o.text}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {shared && (
            <>
              <label className="block">
                <span className="block text-xs font-semibold text-ink-2">Presentación (opcional)</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
                  rows={3}
                  placeholder="De qué es, para quién, cómo te ha ido con ella…"
                  className="mt-1 w-full resize-none rounded-2xl border border-surface-3 bg-surface px-4 py-3 text-sm focus:border-accent focus:outline-none"
                />
                <span className="block text-right text-[11px] text-ink-3">{description.length}/{DESCRIPTION_MAX}</span>
              </label>

              <label className="flex items-start gap-3 rounded-2xl bg-surface-2 p-3">
                <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-1 accent-(--ink)" />
                <span className="text-xs leading-relaxed text-ink-2">
                  Esta partitura es de dominio público, es mía, o tengo permiso para compartirla. (Las ediciones modernas de obras antiguas suelen tener derechos aunque la obra no.)
                </span>
              </label>

              <div className="rounded-2xl border border-line p-3">
                <p className="text-xs font-semibold text-ink-2">Enlace</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate text-xs">{sharedUrl(record.id)}</code>
                  <button type="button" onClick={() => void copy()} className="pill shrink-0 py-1 text-xs">
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                </div>
                {!record.syncedAt && <p className="mt-2 text-[11px] text-ink-3">Funcionará en cuanto la partitura termine de subir a tu cuenta.</p>}
              </div>

              <p className="text-[11px] leading-relaxed text-ink-3">
                Se comparten el archivo, el nombre, la portada y la presentación. Tus notas, tus trazos y tu análisis siguen siendo solo tuyos.
              </p>
            </>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="pill">
              Cancelar
            </button>
            <button type="button" onClick={() => void save()} disabled={!canSave} className="pill pill-active disabled:opacity-50">
              Guardar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

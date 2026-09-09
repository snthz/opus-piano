"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { dismissJob, onJobsChange, useJobs } from "@/lib/jobs";
import { listScores, deleteScore, onScoresChange, updateScoreName, type ScoreRecord } from "@/lib/scores-db";
import { useScoresSync } from "@/lib/scores-sync";
import { useAuth } from "@/lib/auth";
import { openAuthModal } from "@/lib/auth-modal";
import { SignupNudge } from "@/components/account/signup-nudge";
import { JobIndicator } from "./job-indicator";
import { ScoreUpload } from "./score-upload";
import { ScoreViewer } from "./score-viewer";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { PenIcon, PlayIcon } from "./reader-icons";
import { DotsIcon, EmptyLibraryIcon, SearchIcon } from "./library-icons";

/** Ruta de la biblioteca; la partitura abierta va en `?score=<id>`. */
const LIBRARY_PATH = "/scores";
const scorePath = (id: string) => `${LIBRARY_PATH}?score=${encodeURIComponent(id)}`;

export function ScoreLibrary() {
  const router = useRouter();
  const params = useSearchParams();
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [added, setAdded] = useState(false);
  const sync = useScoresSync();
  const { user } = useAuth();

  // La partitura abierta la manda la URL: así sobrevive a recargar la página y
  // el botón «atrás» del navegador vuelve a la biblioteca.
  const viewingId = params.get("score");
  const viewing = viewingId ? (scores.find((s) => s.id === viewingId) ?? null) : null;
  const open = (id: string) => router.push(scorePath(id), { scroll: false });
  const close = () => router.replace(LIBRARY_PATH, { scroll: false });

  const reload = () => listScores().then((s) => { setScores(s); setLoaded(true); });
  useEffect(() => { void reload(); }, []);
  // Lo que llega del servidor (otro dispositivo) aparece sin recargar la página.
  useEffect(() => onScoresChange((c) => { if (c.type !== "put" || c.source === "remote") void reload(); }), []);

  // Un id que ya no existe (borrada, o de otra cuenta) devuelve a la biblioteca.
  useEffect(() => {
    if (loaded && viewingId && !scores.some((s) => s.id === viewingId)) router.replace(LIBRARY_PATH, { scroll: false });
  }, [loaded, viewingId, scores, router]);

  const onAdded = (r: ScoreRecord) => {
    setScores((prev) => [r, ...prev]);
    setAdded(true);
  };

  const onDelete = async (id: string) => {
    await deleteScore(id);
    setScores((prev) => prev.filter((s) => s.id !== id));
  };

  const patch = (id: string, changes: Partial<ScoreRecord>) => {
    setScores((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)));
  };

  // Un plan preparado en segundo plano (la propia tarea ya lo guardó en la base
  // de datos) se aplica al registro en cuanto acaba, esté la partitura abierta
  // o no; el panel del plan lo recibe por el registro.
  useEffect(
    () =>
      onJobsChange((all) => {
        for (const j of all) {
          if (j.kind !== "plan" || j.status !== "done") continue;
          const { scoreId, result: plan } = j;
          setScores((prev) => prev.map((s) => (s.id === scoreId ? { ...s, plan } : s)));
          dismissJob("plan", scoreId);
        }
      }),
    [],
  );

  const rename = (id: string, name: string) => {
    patch(id, { name });
    void updateScoreName(id, name);
  };

  // Con una partitura en la URL, no enseñar la biblioteca mientras se lee la base de datos.
  if (viewingId && !loaded) return <p className="text-sm text-ink-2 text-center">Cargando…</p>;

  if (viewing) {
    return (
      <ScoreViewer
        record={viewing}
        // Al volver se relee la biblioteca: notas, trazos y vínculos guardados mientras se veía.
        onClose={() => { close(); void reload(); }}
        onDelete={() => void onDelete(viewing.id)}
        onNotesChange={(notes) => patch(viewing.id, { notes })}
        onRename={(name) => patch(viewing.id, { name })}
        onPlanChange={(plan) => patch(viewing.id, { plan })}
      />
    );
  }

  const filtered = scores.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <SignupNudge
        when={added}
        title="¿La guardamos en tu cuenta?"
        text="Con una cuenta, tus partituras, anotaciones y notas se guardan en el servidor y las abres desde cualquier dispositivo."
      />
      <ScoreUpload onAdded={onAdded} />

      {/* La biblioteca vacía no puede ser un callejón sin salida: si no hay
          nada que subir todavía, el catálogo da algo que tocar hoy mismo. */}
      <Link href="/scores/catalog" className="card flex items-center gap-3 p-4 hover:bg-surface-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-bg">
          <GlyphIcon name="noteQuarterUp" size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Piezas libres para empezar</span>
          <span className="mt-0.5 block text-xs text-ink-2">
            Obras de dominio público, por dificultad. Suenan y se analizan como cualquier partitura tuya.
          </span>
        </span>
        <ArrowIcon className="h-5 w-5 shrink-0 text-ink-3" />
      </Link>

      {user ? (
        <p className="px-1 text-xs text-ink-3">
          {sync.busy
            ? "Sincronizando biblioteca…"
            : sync.error
              ? `Sin sincronizar: ${sync.error}`
              : sync.lastSync
                ? `Biblioteca sincronizada con tu cuenta${sync.quota ? ` · ${Math.round(sync.used / 1048576)} de ${Math.round(sync.quota / 1048576)} MB` : ""}`
                : "Biblioteca guardada en tu cuenta."}
        </p>
      ) : (
        <p className="px-1 text-xs text-ink-3">
          Tus partituras se guardan solo en este dispositivo.{" "}
          <button type="button" onClick={() => openAuthModal("register")} className="font-semibold text-ink hover:underline">
            Crea una cuenta
          </button>{" "}
          para tenerlas en todos.
        </p>
      )}

      {scores.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar partitura…"
              className="w-full rounded-2xl border border-line bg-surface py-2.5 pl-11 pr-4 text-sm text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
            />
          </div>
          <span className="shrink-0 text-xs text-ink-3">
            {scores.length} {scores.length === 1 ? "partitura" : "partituras"}
          </span>
        </div>
      )}

      {!loaded && <p className="text-center text-sm text-ink-2">Cargando…</p>}

      {loaded && scores.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-surface px-6 py-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-ink-3">
            <EmptyLibraryIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold">Tu biblioteca está vacía</p>
            <p className="mt-1 text-xs text-ink-2">Añade arriba tu primer PDF o MusicXML y aparecerá aquí.</p>
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
          {filtered.map((s) => (
            <ScoreCard
              key={s.id}
              record={s}
              onOpen={() => open(s.id)}
              onDelete={() => void onDelete(s.id)}
              onRename={(name) => rename(s.id, name)}
            />
          ))}
        </div>
      )}

      {search && filtered.length === 0 && (
        <p className="text-center text-sm text-ink-2">Sin resultados para «{search}».</p>
      )}
    </div>
  );
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

/** Insignia pequeña de una capacidad de la partitura (se puede escuchar, tiene trazos). */
function Capability({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span
      title={label}
      aria-label={label}
      className="grid h-6 w-6 place-items-center rounded-full bg-surface/85 text-ink-2 ring-1 ring-line backdrop-blur"
    >
      {children}
    </span>
  );
}

function ScoreCard({
  record,
  onOpen,
  onDelete,
  onRename,
}: {
  record: ScoreRecord;
  onOpen: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(record.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  // Tarea larga de esta partitura (en marcha, lista o fallida): se ve desde la biblioteca.
  const job = useJobs().find((j) => j.scoreId === record.id);

  const isXml = record.kind === "musicxml";
  const playable = isXml || !!record.linkedXml;
  const annotated = Object.values(record.annotations ?? {}).some((s) => s.length > 0);

  // El menú se cierra al tocar fuera o con Escape: `onMouseLeave` no basta en táctil.
  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e.type === "pointerdown" && cardRef.current?.contains(e.target as Node)) return;
      setMenu(false);
      setConfirmDelete(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  const commit = () => {
    const clean = draft.trim();
    setEditing(false);
    if (clean && clean !== record.name) onRename(clean);
    else setDraft(record.name);
  };

  return (
    <article
      ref={cardRef}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-surface transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow)] focus-within:-translate-y-0.5"
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full p-2.5 pb-1.5 text-left focus:outline-none"
        aria-label={`Abrir ${record.name}`}
      >
        {/* La miniatura va montada sobre una lámina con contorno: se lee como una hoja, no como un recorte. */}
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line">
          {record.thumbnail ? (
            // La miniatura es un data URL generado en el dispositivo: next/image no puede optimizarla.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={record.thumbnail}
              alt=""
              className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            // MusicXML no tiene páginas que miniaturizar: una hoja de pentagramas
            // con las dos claves, para que la portada se lea como partitura.
            <div className="flex h-full w-full flex-col justify-center gap-6 px-3.5">
              {[0, 1, 2].map((system) => (
                <div key={system} className="relative">
                  <div className="space-y-[6px]" aria-hidden>
                    {[0, 1, 2, 3, 4].map((line) => (
                      <div key={line} className="h-px bg-ink-3 opacity-40" />
                    ))}
                  </div>
                  {system === 0 && (
                    <div className="absolute inset-y-0 left-0.5 flex items-center gap-2 text-ink">
                      <GlyphIcon name="gClef" size={34} fit="em" />
                      <GlyphIcon name="fClef" size={34} fit="em" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Formato y capacidades sobre la portada: dejan libre la línea de metadatos. */}
          <span className="absolute bottom-2 left-2 rounded-md bg-surface/85 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-ink-2 ring-1 ring-line backdrop-blur">
            {isXml ? "MusicXML" : "PDF"}
          </span>
          {(playable || annotated) && (
            <span className="absolute bottom-2 right-2 flex items-center gap-1">
              {playable && (
                <Capability label="Se puede escuchar">
                  <PlayIcon className="h-2.5 w-2.5" />
                </Capability>
              )}
              {annotated && (
                <Capability label="Con anotaciones">
                  <PenIcon className="h-3 w-3" />
                </Capability>
              )}
            </span>
          )}
        </div>
      </button>

      <div className="flex flex-1 flex-col gap-1 px-3.5 pb-3.5 pt-2">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setDraft(record.name); setEditing(false); }
            }}
            className="w-full rounded-xl bg-surface-2 px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Nombre de la partitura"
          />
        ) : (
          <p className="line-clamp-2 text-sm font-semibold leading-snug">{record.name}</p>
        )}

        <p className="mt-auto pt-0.5 text-[11px] text-ink-3">
          {isXml
            ? `${record.pageCount} ${record.pageCount === 1 ? "compás" : "compases"}`
            : `${record.pageCount} ${record.pageCount === 1 ? "página" : "páginas"}`}
          {" · "}
          {formatDate(record.addedAt)}
        </p>
      </div>

      {job && (
        <div className="absolute left-4 top-4">
          <JobIndicator job={job} onOpen={onOpen} className="h-8 w-8 shadow backdrop-blur" />
        </div>
      )}

      {/* Menú ⋯: siempre visible en táctil, al pasar por encima en escritorio. */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setMenu((v) => !v); setConfirmDelete(false); }}
        className={`absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-surface/90 text-ink-2 ring-1 ring-line backdrop-blur transition hover:text-ink focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 ${
          menu ? "text-ink sm:opacity-100" : ""
        }`}
        aria-label="Opciones"
        aria-haspopup="menu"
        aria-expanded={menu}
      >
        <DotsIcon className="h-4 w-4" />
      </button>
      {menu && (
        <div className="absolute right-4 top-13 z-10 min-w-40 rounded-2xl border border-line bg-surface p-1.5 text-sm shadow-lg">
          <button
            type="button"
            onClick={() => { setMenu(false); setDraft(record.name); setEditing(true); }}
            className="w-full rounded-xl px-3 py-1.5 text-left hover:bg-surface-2"
          >
            Renombrar
          </button>
          {!confirmDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)} className="w-full rounded-xl px-3 py-1.5 text-left text-bad hover:bg-bad-soft">
              Eliminar
            </button>
          ) : (
            <div className="space-y-1.5 px-3 py-1.5">
              <p className="text-xs text-ink-2">¿Eliminar «{record.name}»?</p>
              <div className="flex gap-1.5">
                <button type="button" onClick={onDelete} className="pill bg-bad px-3 py-1 text-xs text-white">Sí, borrar</button>
                <button type="button" onClick={() => { setConfirmDelete(false); setMenu(false); }} className="pill px-3 py-1 text-xs">No</button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

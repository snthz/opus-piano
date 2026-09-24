"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { ROUTE_TEMPLATES } from "@/data/route-templates";
import { pastelOf } from "@/lib/pastel";
import { currentPiece, newRoute, routeProgress, type StudyRoute, type StudyRouteRecord } from "@/lib/study-route";
import { RouteImport } from "./route-import";

/**
 * The routes page when no route is open: the ones in progress as cards, and
 * three ways to start a new one — adopt a ready-made plan, have the app read
 * one you were given (PDF or text), or start from a blank name.
 */
export function RouteList({ routes, onCreate, onOpen }: { routes: StudyRouteRecord[]; onCreate: (r: StudyRoute) => void; onOpen: (id: string) => void }) {
  const [importing, setImporting] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const active = routes.filter((r) => !r.archived);
  const archived = routes.filter((r) => r.archived);

  const createBlank = () => {
    const clean = name.trim();
    if (!clean) return;
    onCreate(newRoute({ name: clean }));
  };

  return (
    <div>
      <PageHeader
        eyebrow="Rutas de estudio"
        title="Tus rutas"
        intro="Un plan de repertorio con las piezas en orden, la rutina diaria y los objetivos. Cada pieza se enlaza con su partitura para abrirla al momento."
      />

      {active.length > 0 && (
        <ul className="mb-8 grid gap-3 sm:grid-cols-2">
          {active.map((r) => (
            <li key={r.id}>
              <RouteCard route={r} onOpen={() => onOpen(r.id)} />
            </li>
          ))}
        </ul>
      )}

      <section>
        <h2 className="mb-3 px-1 text-xl font-semibold tracking-tight">{active.length ? "Otra ruta" : "Empieza una ruta"}</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {ROUTE_TEMPLATES.map((t) => (
            <button key={t.id} type="button" onClick={() => onCreate(newRoute(t.draft))} className="card group flex flex-col justify-between p-4 text-left">
              <span>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-3">Plantilla</span>
                <span className="mt-1 block font-semibold leading-tight tracking-tight">{t.draft.name}</span>
                <span className="mt-1.5 block text-sm leading-snug text-ink-2">{t.audience}</span>
              </span>
              <span className="mt-4 flex items-center justify-between text-xs text-ink-3">
                {t.draft.pieces?.length ?? 0} piezas · {t.draft.level}
                <span className="btn-circle h-9 w-9 group-hover:-translate-y-0.5">
                  <ArrowIcon className="h-4 w-4" />
                </span>
              </span>
            </button>
          ))}

          <button type="button" onClick={() => setImporting(true)} className="card-pastel bg-mint group flex flex-col justify-between p-4 text-left">
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-2">Con IA</span>
              <span className="mt-1 block font-semibold leading-tight tracking-tight">Leer un plan que ya tienes</span>
              <span className="mt-1.5 block text-sm leading-snug text-ink-2">Pega el texto o sube el PDF de un plan de estudio y la app lo convierte en una ruta con sus piezas, rutina y objetivos.</span>
            </span>
            <span className="mt-4 flex justify-end">
              <span className="btn-circle h-9 w-9 group-hover:-translate-y-0.5">
                <ArrowIcon className="h-4 w-4" />
              </span>
            </span>
          </button>

          <div className="card flex flex-col justify-between p-4">
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-3">Desde cero</span>
              <span className="mt-1 block font-semibold leading-tight tracking-tight">Tu propia ruta</span>
              <span className="mt-1.5 block text-sm leading-snug text-ink-2">Ponle nombre y añade las piezas una a una.</span>
            </div>
            {naming ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createBlank();
                }}
                className="mt-4 flex gap-2"
              >
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la ruta" aria-label="Nombre de la ruta" className="field h-11 min-w-0 flex-1 text-sm" />
                <button type="submit" disabled={!name.trim()} className="btn-circle h-11 w-11 shrink-0 disabled:opacity-40" aria-label="Crear la ruta">
                  <ArrowIcon className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <button type="button" onClick={() => setNaming(true)} className="btn-secondary mt-4 w-full text-sm">
                Crear una ruta vacía
              </button>
            )}
          </div>
        </div>
      </section>

      {archived.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wider text-ink-3">Archivadas</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {archived.map((r) => (
              <li key={r.id}>
                <RouteCard route={r} onOpen={() => onOpen(r.id)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <RouteImport open={importing} onClose={() => setImporting(false)} onImported={onCreate} />
    </div>
  );
}

function RouteCard({ route, onOpen }: { route: StudyRouteRecord; onOpen: () => void }) {
  const piece = currentPiece(route);
  const { done, total } = routeProgress(route);
  return (
    <button type="button" onClick={onOpen} className={`card-pastel ${route.archived ? "bg-ash opacity-80" : pastelOf(route.id)} group flex w-full flex-col justify-between p-5 text-left`}>
      <span className="min-w-0">
        {route.level && <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-2">{route.level}</span>}
        <span className="mt-0.5 block text-lg font-semibold leading-tight tracking-tight">{route.name}</span>
        <span className="mt-2 block text-sm leading-snug text-ink-2">
          {piece ? (
            <>
              Ahora: <span className="font-medium text-ink">{piece.title}</span>
              {piece.detail && <span className="text-ink-3"> · {piece.detail}</span>}
            </>
          ) : total ? (
            "Ruta completa."
          ) : (
            "Aún sin piezas."
          )}
        </span>
      </span>
      <span className="mt-4 flex items-center gap-3">
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
          <span className="block h-full rounded-full bg-ink transition-[width]" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </span>
        <span className="text-xs tabular-nums text-ink-2">
          {done} de {total}
        </span>
        <span className="btn-circle h-9 w-9 group-hover:-translate-y-0.5">
          <ArrowIcon className="h-4 w-4" />
        </span>
      </span>
    </button>
  );
}

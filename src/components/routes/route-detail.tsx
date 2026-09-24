"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronIcon } from "@/components/ui/arrow-icon";
import { DotsIcon } from "@/components/scores/library-icons";
import { StatusLabel } from "@/components/scores/score-status";
import { dayKey, parseDay } from "@/lib/agenda";
import { pastelOf } from "@/lib/pastel";
import { scoreStatus } from "@/lib/score-status";
import type { ScoreRecord } from "@/lib/scores-db";
import {
  corePieces,
  currentPiece,
  goalsByHorizon,
  movePiece,
  newBlock,
  newGoal,
  patchPiece,
  removePiece,
  routeProgress,
  routineMinutes,
  setPieceDone,
  sidePieces,
  type PieceKind,
  type RoutePiece,
  type RoutineBlock,
  type StudyRoute,
} from "@/lib/study-route";
import { PieceForm } from "./piece-form";
import { PieceLinker } from "./piece-linker";
import { RouteNotes } from "./route-notes";

/**
 * One route, open: the piece in hand on top, then the repertoire in order,
 * the side pieces, the daily routine, the goals by horizon and the notes.
 * Everything edits in place; each change goes up through `onChange` and is
 * saved at once — there is no "save" button to forget.
 */
export function RouteDetail({ route, scores, onChange, onClose, onDelete }: { route: StudyRoute; scores: ScoreRecord[]; onChange: (r: StudyRoute) => void; onClose: () => void; onDelete: () => void }) {
  const [form, setForm] = useState<{ piece: RoutePiece | null; kind: PieceKind } | null>(null);
  const [linking, setLinking] = useState<RoutePiece | null>(null);
  const [renaming, setRenaming] = useState(false);
  const today = dayKey(new Date());

  const scoreOf = (p: RoutePiece) => (p.scoreId ? (scores.find((s) => s.id === p.scoreId) ?? null) : null);
  const now = currentPiece(route);
  const { done, total } = routeProgress(route);

  const savePiece = (p: RoutePiece) => {
    const exists = route.pieces.some((x) => x.id === p.id);
    onChange(exists ? patchPiece(route, p.id, p) : { ...route, pieces: [...route.pieces, p] });
  };
  const toggleDone = (p: RoutePiece) => onChange(setPieceDone(route, p.id, !p.done, today));
  const link = (scoreId: string) => {
    if (linking) onChange(patchPiece(route, linking.id, { scoreId, startedAt: linking.startedAt ?? (linking.id === now?.id ? today : null) }));
    setLinking(null);
  };

  return (
    <div className="space-y-8">
      <header>
        <div className="mb-4 flex items-center justify-between">
          <button type="button" onClick={onClose} aria-label="Volver a las rutas" className="card grid h-11 w-11 place-items-center text-ink hover:bg-surface-2">
            <ChevronIcon dir="left" />
          </button>
          <RouteMenu route={route} onRename={() => setRenaming(true)} onArchive={() => onChange({ ...route, archived: !route.archived })} onDelete={onDelete} />
        </div>
        <p className="text-sm text-ink-2">Ruta de estudio{route.level ? ` · ${route.level}` : ""}</p>
        {renaming ? (
          <RenameField value={route.name} onDone={(name) => { setRenaming(false); if (name) onChange({ ...route, name }); }} />
        ) : (
          <h1 className="mt-1 text-3xl font-bold leading-tight tracking-tight md:text-4xl">{route.name}</h1>
        )}
        {route.goal && <p className="mt-3 max-w-prose leading-relaxed text-ink-2">{route.goal}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {route.practice && <Chip>{route.practice}</Chip>}
          {route.startDate && <Chip>Desde el {longDay(route.startDate)}</Chip>}
          {route.archived && <Chip>Archivada</Chip>}
          <Chip>
            {done} de {total} piezas
          </Chip>
        </div>
        {total > 0 && (
          <div className="mt-3 flex h-2 gap-1" role="img" aria-label={`${done} de ${total} piezas terminadas`}>
            {corePieces(route).map((p) => (
              <span key={p.id} className={`min-w-1 flex-1 rounded-full ${p.done ? "bg-ok" : p.id === now?.id ? "bg-ink" : "bg-ink/15"}`} />
            ))}
          </div>
        )}
      </header>

      {/* The piece in hand: what the route says to do today. */}
      <section>
        <SectionTitle>Ahora</SectionTitle>
        {now ? (
          <NowCard piece={now} index={corePieces(route).indexOf(now) + 1} score={scoreOf(now)} routeId={route.id} onLink={() => setLinking(now)} onDone={() => toggleDone(now)} />
        ) : total > 0 ? (
          <p className="card p-5 text-sm text-ink-2">Ruta completa: has terminado las {total} piezas. Puedes añadir más o archivarla.</p>
        ) : (
          <p className="card p-5 text-sm text-ink-2">Aún no hay piezas. Añade la primera abajo, o enlaza las que ya tienes en la biblioteca.</p>
        )}
      </section>

      <section>
        <SectionTitle action={<AddButton onClick={() => setForm({ piece: null, kind: "core" })} />}>Repertorio en orden</SectionTitle>
        {corePieces(route).length === 0 ? (
          <p className="px-1 text-sm text-ink-2">Las piezas obligatorias, una detrás de otra. Cada una existe para atacar una debilidad concreta.</p>
        ) : (
          <ol className="space-y-2">
            {corePieces(route).map((p, i) => (
              <PieceRow
                key={p.id}
                piece={p}
                index={i + 1}
                current={p.id === now?.id}
                score={scoreOf(p)}
                onEdit={() => setForm({ piece: p, kind: p.kind })}
                onLink={() => setLinking(p)}
                onUnlink={() => onChange(patchPiece(route, p.id, { scoreId: null }))}
                onDone={() => toggleDone(p)}
                onMove={(dir) => onChange(movePiece(route, p.id, dir))}
                onRemove={() => onChange(removePiece(route, p.id))}
              />
            ))}
          </ol>
        )}
      </section>

      <section>
        <SectionTitle action={<AddButton onClick={() => setForm({ piece: null, kind: "side" })} />}>Por gusto · en paralelo</SectionTitle>
        {sidePieces(route).length === 0 ? (
          <p className="px-1 text-sm text-ink-2">Una a la vez, elegida solo porque gusta. No cuenta para el avance: existe para mantener las ganas.</p>
        ) : (
          <ul className="space-y-2">
            {sidePieces(route).map((p) => (
              <PieceRow
                key={p.id}
                piece={p}
                score={scoreOf(p)}
                onEdit={() => setForm({ piece: p, kind: p.kind })}
                onLink={() => setLinking(p)}
                onUnlink={() => onChange(patchPiece(route, p.id, { scoreId: null }))}
                onDone={() => toggleDone(p)}
                onMove={(dir) => onChange(movePiece(route, p.id, dir))}
                onRemove={() => onChange(removePiece(route, p.id))}
              />
            ))}
          </ul>
        )}
      </section>

      <RoutineSection route={route} onChange={onChange} />
      <GoalsSection route={route} onChange={onChange} />

      <section>
        <SectionTitle>Notas del plan</SectionTitle>
        <div className="card p-5">
          <RouteNotes notes={route.notes} onChange={(notes) => onChange({ ...route, notes })} />
        </div>
      </section>

      <PieceForm open={!!form} piece={form?.piece} kind={form?.kind} onClose={() => setForm(null)} onSave={savePiece} />
      <PieceLinker open={!!linking} piece={linking} scores={scores} onClose={() => setLinking(null)} onLink={link} />
    </div>
  );
}

/* ---------- Pieces ---------- */

function NowCard({ piece, index, score, routeId, onLink, onDone }: { piece: RoutePiece; index: number; score: ScoreRecord | null; routeId: string; onLink: () => void; onDone: () => void }) {
  return (
    <article className={`card-pastel ${pastelOf(routeId)} space-y-4 p-4 md:p-5`}>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold tabular-nums text-bg">{index}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold leading-tight">{piece.title}</h3>
          {piece.detail && <p className="text-sm text-ink-2">{piece.detail}</p>}
          {piece.why && <p className="mt-2 max-w-prose text-sm leading-relaxed">{piece.why}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {piece.estimate && <Chip>{piece.estimate}</Chip>}
            {piece.tag && <Chip>{piece.tag}</Chip>}
            {piece.startedAt && <Chip>Desde el {shortDay(piece.startedAt)}</Chip>}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {score ? (
          <Link href={`/scores?score=${encodeURIComponent(score.id)}`} className="btn-primary flex-1 text-sm sm:flex-none">
            Abrir la partitura
          </Link>
        ) : (
          <button type="button" onClick={onLink} className="btn-primary flex-1 text-sm sm:flex-none">
            Vincular la partitura
          </button>
        )}
        <button type="button" onClick={onDone} className="btn-secondary text-sm">
          Marcar terminada
        </button>
        {score && (
          <span className="ml-auto text-xs text-ink-2">
            <StatusLabel status={scoreStatus(score)} />
          </span>
        )}
      </div>
    </article>
  );
}

function PieceRow({ piece, index, current, score, onEdit, onLink, onUnlink, onDone, onMove, onRemove }: { piece: RoutePiece; index?: number; current?: boolean; score: ScoreRecord | null; onEdit: () => void; onLink: () => void; onUnlink: () => void; onDone: () => void; onMove: (dir: -1 | 1) => void; onRemove: () => void }) {
  return (
    <li className={`card flex gap-3 p-3.5 ${piece.done ? "opacity-70" : ""} ${current ? "ring-2 ring-ink" : ""}`}>
      <button
        type="button"
        onClick={onDone}
        aria-pressed={piece.done}
        aria-label={piece.done ? "Marcar como pendiente" : "Marcar como terminada"}
        className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold tabular-nums transition-colors ${
          piece.done ? "border-transparent bg-ok text-bg" : current ? "border-transparent bg-ink text-bg" : "border-line bg-surface-2 text-ink-2 hover:text-ink"
        }`}
      >
        {piece.done ? <CheckIcon /> : (index ?? "·")}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className={`font-semibold leading-tight ${piece.done ? "line-through" : ""}`}>{piece.title}</p>
          {piece.tag && <span className="rounded-md border border-line px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-2">{piece.tag}</span>}
        </div>
        {piece.detail && <p className="text-xs text-ink-2">{piece.detail}</p>}
        {piece.why && <p className="mt-1 text-sm leading-snug text-ink-2">{piece.why}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {piece.estimate && <span className="text-ink-3">{piece.estimate}</span>}
          {piece.doneAt && <span className="text-ink-3">Terminada el {shortDay(piece.doneAt)}</span>}
          {score ? (
            <Link href={`/scores?score=${encodeURIComponent(score.id)}`} className="inline-flex items-center gap-1 font-semibold text-ink hover:underline">
              <ScoreIcon />
              <span className="max-w-48 truncate">{score.name}</span>
            </Link>
          ) : (
            <button type="button" onClick={onLink} className="inline-flex items-center gap-1 font-semibold text-ink hover:underline">
              <ScoreIcon />
              Vincular partitura
            </button>
          )}
        </div>
      </div>
      <RowMenu
        items={[
          { label: "Editar", onClick: onEdit },
          { label: "Subir", onClick: () => onMove(-1) },
          { label: "Bajar", onClick: () => onMove(1) },
          ...(score ? [{ label: "Desvincular la partitura", onClick: onUnlink }] : []),
          { label: "Quitar de la ruta", onClick: onRemove, danger: true },
        ]}
      />
    </li>
  );
}

/* ---------- Routine ---------- */

function RoutineSection({ route, onChange }: { route: StudyRoute; onChange: (r: StudyRoute) => void }) {
  const [adding, setAdding] = useState(false);
  const total = routineMinutes(route);
  const patch = (id: string, changes: Partial<RoutineBlock>) => onChange({ ...route, routine: route.routine.map((b) => (b.id === id ? { ...b, ...changes } : b)) });

  return (
    <section>
      <SectionTitle action={<AddButton onClick={() => setAdding(true)} />}>Rutina diaria{total ? ` · ${total} min` : ""}</SectionTitle>
      {route.routine.length === 0 && !adding && <p className="px-1 text-sm text-ink-2">Los bloques de cada día y sus minutos: calentamiento, técnica, lectura, repertorio.</p>}
      {route.routine.length > 0 && (
        <div className="card space-y-3 p-4">
          <div className="flex h-2.5 gap-1" role="list" aria-label="Bloques de la rutina">
            {route.routine.map((b, i) => (
              <span key={b.id} role="listitem" aria-label={`${b.title}, ${b.minutes} minutos`} style={{ flexGrow: b.minutes / (total || 1), flexBasis: 0 }} className={`min-w-2 rounded-full ${i % 2 ? "bg-ink/45" : "bg-ink"}`} />
            ))}
          </div>
          <ol className="divide-y divide-line">
            {route.routine.map((b) => (
              <li key={b.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="w-14 shrink-0 text-sm font-semibold tabular-nums">{b.minutes} min</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{b.title}</span>
                  {b.content && <span className="block text-sm leading-snug text-ink-2">{b.content}</span>}
                </span>
                <RowMenu
                  items={[
                    { label: "Menos tiempo (−5)", onClick: () => patch(b.id, { minutes: Math.max(1, b.minutes - 5) }) },
                    { label: "Más tiempo (+5)", onClick: () => patch(b.id, { minutes: Math.min(240, b.minutes + 5) }) },
                    { label: "Quitar", onClick: () => onChange({ ...route, routine: route.routine.filter((x) => x.id !== b.id) }), danger: true },
                  ]}
                />
              </li>
            ))}
          </ol>
        </div>
      )}
      {adding && (
        <BlockForm
          onCancel={() => setAdding(false)}
          onSave={(b) => {
            onChange({ ...route, routine: [...route.routine, b] });
            setAdding(false);
          }}
        />
      )}
    </section>
  );
}

function BlockForm({ onSave, onCancel }: { onSave: (b: RoutineBlock) => void; onCancel: () => void }) {
  const [minutes, setMinutes] = useState("10");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSave(newBlock({ minutes: Math.min(240, Math.max(1, Number(minutes) || 10)), title: title.trim(), content: content.trim() }));
      }}
      className="card mt-2 space-y-2 p-4"
    >
      <div className="flex gap-2">
        <input type="number" min={1} max={240} value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="Minutos" className="field h-11 w-20 text-sm" />
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bloque: Técnica, Lectura…" aria-label="Nombre del bloque" className="field h-11 min-w-0 flex-1 text-sm" required maxLength={300} />
      </div>
      <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Qué se hace (opcional)" aria-label="Contenido del bloque" className="field h-11 text-sm" maxLength={6000} />
      <div className="flex gap-2">
        <button type="submit" disabled={!title.trim()} className="btn-primary text-sm disabled:opacity-50">
          Añadir
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}

/* ---------- Goals ---------- */

function GoalsSection({ route, onChange }: { route: StudyRoute; onChange: (r: StudyRoute) => void }) {
  const [adding, setAdding] = useState(false);
  const [horizon, setHorizon] = useState("");
  const [title, setTitle] = useState("");
  const groups = goalsByHorizon(route);
  const toggle = (id: string) => onChange({ ...route, goals: route.goals.map((g) => (g.id === id ? { ...g, done: !g.done } : g)) });
  const remove = (id: string) => onChange({ ...route, goals: route.goals.filter((g) => g.id !== id) });
  const doneCount = route.goals.filter((g) => g.done).length;

  return (
    <section>
      <SectionTitle action={<AddButton onClick={() => setAdding(true)} />}>Objetivos{route.goals.length ? ` · ${doneCount} de ${route.goals.length}` : ""}</SectionTitle>
      {groups.length === 0 && !adding && <p className="px-1 text-sm text-ink-2">Qué debería ser verdad al mes, a los tres meses, al año. Se marcan cuando lo son.</p>}
      {groups.length > 0 && (
        <div className="card space-y-4 p-4">
          {groups.map((g) => (
            <div key={g.horizon || "_"}>
              {g.horizon && <h3 className="mb-1.5 text-sm font-semibold">{g.horizon}</h3>}
              <ul className="space-y-0.5">
                {g.goals.map((goal) => (
                  <li key={goal.id} className="group flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggle(goal.id)}
                      aria-pressed={goal.done}
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors ${goal.done ? "border-transparent bg-ok text-bg" : "border-line bg-surface-2 hover:border-ink-3"}`}
                    >
                      {goal.done && <CheckIcon className="h-3 w-3" />}
                    </button>
                    <button type="button" onClick={() => toggle(goal.id)} className={`min-w-0 flex-1 py-0.5 text-left text-sm leading-snug ${goal.done ? "text-ink-3 line-through" : "text-ink-2"}`}>
                      {goal.title}
                    </button>
                    <button type="button" onClick={() => remove(goal.id)} aria-label="Quitar el objetivo" className="shrink-0 rounded-md px-1 text-ink-3 opacity-100 hover:text-bad not-any-pointer-coarse:opacity-0 not-any-pointer-coarse:group-hover:opacity-100 not-any-pointer-coarse:focus-visible:opacity-100">
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            onChange({ ...route, goals: [...route.goals, newGoal({ horizon: horizon.trim(), title: title.trim() })] });
            setTitle("");
          }}
          className="card mt-2 space-y-2 p-4"
        >
          <div className="flex gap-2">
            <input value={horizon} onChange={(e) => setHorizon(e.target.value)} placeholder="Plazo: 1 mes" aria-label="Plazo" list="route-horizons" className="field h-11 w-32 text-sm" maxLength={300} />
            <datalist id="route-horizons">
              {groups.map((g) => (
                <option key={g.horizon} value={g.horizon} />
              ))}
            </datalist>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Objetivo" aria-label="Objetivo" className="field h-11 min-w-0 flex-1 text-sm" required maxLength={6000} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={!title.trim()} className="btn-primary text-sm disabled:opacity-50">
              Añadir
            </button>
            <button type="button" onClick={() => setAdding(false)} className="btn-secondary text-sm">
              Listo
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

/* ---------- Bits ---------- */

function RouteMenu({ route, onRename, onArchive, onDelete }: { route: StudyRoute; onRename: () => void; onArchive: () => void; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <RowMenu
      big
      onOpenChange={() => setConfirm(false)}
      items={[
        { label: "Renombrar", onClick: onRename },
        { label: route.archived ? "Reactivar" : "Archivar", onClick: onArchive },
        confirm
          ? { label: "Sí, eliminar la ruta", onClick: onDelete, danger: true, keepOpen: false }
          : { label: "Eliminar…", onClick: () => setConfirm(true), danger: true, keepOpen: true },
      ]}
    />
  );
}

type MenuItem = { label: string; onClick: () => void; danger?: boolean; keepOpen?: boolean };

/** The ⋯ menu of a row. Closes on tap outside or Escape, which `onMouseLeave` can't do on a touch screen. */
function RowMenu({ items, big, onOpenChange }: { items: MenuItem[]; big?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const set = (v: boolean) => {
    setOpen(v);
    onOpenChange?.(v);
  };
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e.type === "pointerdown" && ref.current?.contains(e.target as Node)) return;
      set(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => set(!open)}
        aria-label="Opciones"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`grid place-items-center rounded-full text-ink-2 transition hover:text-ink ${big ? "card h-11 w-11" : "h-8 w-8 hover:bg-surface-2"}`}
      >
        <DotsIcon className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-10 mt-1 min-w-44 rounded-2xl border border-line bg-surface p-1.5 text-sm shadow-lg">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                it.onClick();
                if (!it.keepOpen) set(false);
              }}
              className={`w-full rounded-xl px-3 py-1.5 text-left ${it.danger ? "text-bad hover:bg-bad-soft" : "hover:bg-surface-2"}`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RenameField({ value, onDone }: { value: string; onDone: (name: string | null) => void }) {
  const [draft, setDraft] = useState(value);
  const commit = () => onDone(draft.trim() && draft.trim() !== value ? draft.trim() : null);
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onDone(null);
      }}
      aria-label="Nombre de la ruta"
      maxLength={300}
      className="mt-1 w-full rounded-xl bg-surface-2 px-3 py-2 text-3xl font-bold leading-tight tracking-tight focus:outline-none focus:ring-2 focus:ring-accent md:text-4xl"
    />
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 px-1">
      <h2 className="text-xl font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

const AddButton = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick} className="btn-quiet h-9 px-3 text-xs">
    <span aria-hidden className="text-base leading-none">
      +
    </span>
    Añadir
  </button>
);

const Chip = ({ children }: { children: React.ReactNode }) => <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium tabular-nums text-ink-2 ring-1 ring-line">{children}</span>;

const CheckIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className} aria-hidden>
    <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ScoreIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-3.5 w-3.5" aria-hidden>
    <path d="M6 3h8l4 4v14H6z" strokeLinejoin="round" />
    <path d="M14 3v4h4M9 12h6M9 15.5h6" strokeLinecap="round" />
  </svg>
);

const longDay = (key: string) => parseDay(key).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
const shortDay = (key: string) => parseDay(key).toLocaleDateString("es", { day: "numeric", month: "short" });

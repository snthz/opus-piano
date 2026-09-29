"use client";

import { useState } from "react";
import Link from "next/link";
import { Score } from "@/components/notation/score";
import { ChevronIcon } from "@/components/ui/arrow-icon";
import { ExerciseHeader, useExerciseSession } from "./exercise-shell";
import { BookMetronome } from "./book-metronome";
import { READING_BOOK, bookLocation, neighbours } from "@/data/reading-book";
import {
  HAND_LABEL,
  KIND_HINT,
  KIND_LABEL,
  gradeItems,
  layoutItem,
  measuresPerSystem,
  type BookGrade,
  type BookItem,
  type BookItemKind,
  type BookStage,
} from "@/lib/music/reading-book";
import { randomBookItem } from "@/lib/music/reading-book-random";
import { TIME_SIGNATURE_BY_ID } from "@/lib/music/meter";
import { keyByVex, keyName } from "@/lib/music/keys";
import { countMarked, toggleMark, useReadMarks } from "@/lib/practice/read-marks";
import { useSettings } from "@/lib/settings";

const EXERCISE = "lectura-graduada";

/**
 * El cuaderno de lectura: cinco grados de material para leer en el piano.
 *
 * A diferencia del resto de la sección de práctica, aquí no se contesta nada.
 * La pantalla pone el texto, el orden y el pulso; el ejercicio pasa en el
 * teclado del alumno, y lo único que se guarda es lo que él diga: qué piezas
 * ha leído ya.
 */
export function ReadingBook() {
  const [gradeN, setGradeN] = useState<number | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [random, setRandom] = useState<{ grade: BookGrade; kind: BookItemKind } | null>(null);
  const marks = useReadMarks();

  if (random) {
    return (
      <RandomView
        grade={random.grade}
        kind={random.kind}
        onExit={() => setRandom(null)}
        onKind={(kind) => setRandom({ ...random, kind })}
      />
    );
  }

  const location = itemId ? bookLocation(itemId) : undefined;
  if (location) {
    return (
      <ItemView
        key={location.item.id}
        grade={location.grade}
        stage={location.stage}
        item={location.item}
        read={!!marks[location.item.id]}
        onExit={() => setItemId(null)}
        onGo={setItemId}
      />
    );
  }

  const grade = gradeN ? READING_BOOK.find((g) => g.n === gradeN) : undefined;
  if (grade) {
    return (
      <GradeView
        grade={grade}
        marks={marks}
        onExit={() => setGradeN(null)}
        onPick={setItemId}
        onRandom={(kind) => setRandom({ grade, kind })}
      />
    );
  }

  return <GradeIndex marks={marks} onPick={setGradeN} />;
}

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-20 rounded-full bg-surface-3 overflow-hidden" aria-hidden="true">
        <span className="block h-full bg-ink rounded-full" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </span>
      <span className="text-xs text-ink-2 tabular-nums">
        {done}/{total}
      </span>
    </span>
  );
}

function CheckIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke={on ? "var(--ok)" : "var(--ink-3)"} strokeWidth="1.6" fill={on ? "var(--ok)" : "none"} />
      {on && <path d="M8 12.2l2.6 2.6L16 9.4" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

function GradeIndex({ marks, onPick }: { marks: Record<string, number>; onPick: (n: number) => void }) {
  const all = READING_BOOK.flatMap((g) => gradeItems(g).map((i) => i.id));
  const done = countMarked(all, marks);

  return (
    <div className="space-y-4">
      <ExerciseHeader title="Cuaderno de lectura" />

      <div className="card-pastel bg-mint px-5 py-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-2xl font-bold tabular-nums">
            {done}
            <span className="text-ink-2 text-base font-medium">/{all.length}</span>
          </p>
          <p className="text-xs text-ink-2">piezas leídas</p>
        </div>
        <p className="text-xs text-ink-2 text-right max-w-60">
          Material por grados para leer en tu piano. No hay que teclear nada: se lee, se marca y se pasa a la siguiente.
        </p>
      </div>

      <ul className="space-y-2.5">
        {READING_BOOK.map((grade) => {
          const ids = gradeItems(grade).map((i) => i.id);
          return (
            <li key={grade.n}>
              <button
                type="button"
                onClick={() => onPick(grade.n)}
                className={`w-full text-left card-pastel ${grade.color} p-4 flex items-center gap-3.5 hover:-translate-y-0.5 transition-transform`}
              >
                <span className="w-11 h-11 rounded-full bg-surface/90 flex items-center justify-center font-bold text-lg tabular-nums shrink-0">
                  {grade.n}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-tight">{grade.title} · {grade.subtitle}</span>
                  <span className="block text-xs text-ink-2 mt-0.5">{grade.scope.keys}</span>
                  <span className="block mt-1.5">
                    <Progress done={countMarked(ids, marks)} total={ids.length} />
                  </span>
                </span>
                <ChevronIcon dir="right" />
              </button>
            </li>
          );
        })}
      </ul>

      <p className="card p-4 text-xs text-ink-2">
        Cada grado va por etapas: primero un ritmo para palmear, luego dos fórmulas cortas para cada mano y al final dos piezas, una
        con preguntas de preparación y otra para leer sin ayuda. Dentro de cada grado hay además <strong className="font-semibold text-ink">lectura infinita</strong>:
        material nuevo generado con el temario de ese grado, para cuando lo escrito se te quede corto o te lo sepas de memoria. Si
        quieres que la pantalla te corrija las notas a tiempo, eso está en{" "}
        <Link href="/practice/sight-reading" className="font-semibold text-ink hover:underline">
          Primera vista
        </Link>
        .
      </p>
    </div>
  );
}

function ScopeRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 w-20 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-ink-2 min-w-0">{children}</span>
    </div>
  );
}

function BackHeader({ eyebrow, title, onExit }: { eyebrow: string; title: string; onExit: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onExit}
        aria-label="Volver"
        className="card w-11 h-11 flex items-center justify-center hover:bg-surface-2 shrink-0"
      >
        <ChevronIcon dir="left" />
      </button>
      <div className="min-w-0 text-center">
        <p className="text-xs text-ink-3">{eyebrow}</p>
        <h1 className="text-base font-semibold tracking-tight truncate">{title}</h1>
      </div>
      <span className="w-11 shrink-0" />
    </div>
  );
}

/** Los tres tipos de lectura infinita, en el orden en que se trabajan. */
const RANDOM_KINDS: BookItemKind[] = ["rhythm", "melody", "piece"];

function GradeView({
  grade,
  marks,
  onExit,
  onPick,
  onRandom,
}: {
  grade: BookGrade;
  marks: Record<string, number>;
  onExit: () => void;
  onPick: (id: string) => void;
  onRandom: (kind: BookItemKind) => void;
}) {
  const ids = gradeItems(grade).map((i) => i.id);
  return (
    <div className="space-y-4">
      <BackHeader eyebrow={`Cuaderno de lectura · ${grade.title}`} title={grade.subtitle} onExit={onExit} />

      <div className={`card-pastel ${grade.color} p-5`}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Lo que entra en este grado</p>
        <div className="mt-2 divide-y divide-ink/10">
          <ScopeRow label="Tonalidad">{grade.scope.keys}</ScopeRow>
          <ScopeRow label="Compases">{grade.scope.meters}</ScopeRow>
          <ScopeRow label="Figuras">{grade.scope.figures}</ScopeRow>
          <ScopeRow label="Registro">{grade.scope.range}</ScopeRow>
          <ScopeRow label="Manos">{grade.scope.texture}</ScopeRow>
        </div>
        <p className="mt-3 text-sm text-ink-2 border-t border-ink/10 pt-3">
          <strong className="font-semibold text-ink">Listo para el grado siguiente:</strong> {grade.ready}
        </p>
        <p className="mt-3">
          <Progress done={countMarked(ids, marks)} total={ids.length} />
        </p>
      </div>

      <section className="card p-4 space-y-2.5">
        <div>
          <h2 className="font-semibold leading-tight">Lectura infinita</h2>
          <p className="text-xs text-ink-2 mt-0.5">
            Material nuevo cada vez, con el temario de este grado. Cuando el cuaderno se te acabe —o cuando ya te sepas las piezas de
            memoria, que es lo que arruina una lectura— sigue por aquí.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RANDOM_KINDS.map((kind) => (
            <button key={kind} type="button" onClick={() => onRandom(kind)} className="pill">
              {KIND_LABEL[kind]} al azar
            </button>
          ))}
        </div>
      </section>

      {grade.stages.map((stage) => (
        <StageList key={stage.n} stage={stage} marks={marks} onPick={onPick} />
      ))}
    </div>
  );
}

function StageList({
  stage,
  marks,
  onPick,
}: {
  stage: BookStage;
  marks: Record<string, number>;
  onPick: (id: string) => void;
}) {
  return (
    <section className="card p-4 space-y-2.5">
      <div>
        <h2 className="font-semibold leading-tight">
          Etapa {stage.n} · {stage.title}
        </h2>
        <p className="text-xs text-ink-2 mt-0.5">{stage.goal}</p>
      </div>
      <ul className="space-y-1.5">
        {stage.items.map((item) => {
          const ts = TIME_SIGNATURE_BY_ID[item.tsId];
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onPick(item.id)}
                className="w-full text-left rounded-2xl bg-surface-2 hover:bg-surface-3 p-3 flex items-center gap-3"
              >
                <CheckIcon on={!!marks[item.id]} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium leading-tight truncate">{item.title}</span>
                  <span className="block text-[11px] text-ink-3 mt-0.5 tabular-nums">
                    {KIND_LABEL[item.kind]} · {ts.numerator}/{ts.denominator} · {item.top.length} compases
                    {item.prep?.length ? " · con preguntas" : ""}
                  </span>
                </span>
                <ChevronIcon dir="right" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** La partitura de una pieza, repartida en líneas de dos o cuatro compases. */
function BookScore({ item }: { item: BookItem }) {
  const ts = TIME_SIGNATURE_BY_ID[item.tsId];
  const perSystem = measuresPerSystem(ts);
  const lines = layoutItem(item, perSystem);
  const height = item.bottom ? 215 : 125;
  return (
    <div>
      {lines.map((line, i) => (
        // El dibujo de VexFlow acaba bastante antes que el SVG: la caja de los
        // glifos de la clave y del compás mide por la fuente, no por la tinta,
        // y deja debajo un dedo de papel en blanco. Con ocho compases eso es
        // media pantalla, así que a todas las líneas menos a la última se les
        // recorta. En porcentaje, que se mide sobre el ancho: así el recorte
        // encoge con el dibujo y en el móvil tampoco se come ninguna nota.
        <div key={i} className={i === lines.length - 1 ? "" : "-mb-[6%]"}>
          <Score
            clef={item.clef}
            keySignature={item.kind === "rhythm" ? undefined : item.keyVex}
            time={`${ts.numerator}/${ts.denominator}`}
            showTime={line.first}
            measures={line.measures}
            bassMeasures={line.bass}
            ties={line.ties}
            bassTies={line.bassTies}
            slurs={line.slurs}
            endBar={line.last ? "end" : "single"}
            width={740}
            height={height}
            scale={1.4}
            title={`${item.title}, línea ${i + 1} de ${lines.length}`}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * La pieza en pantalla: los datos, en qué fijarse, las preguntas, la partitura
 * y el metrónomo. Lo comparten el cuaderno escrito y la lectura infinita; lo
 * único que cambia entre los dos son los botones de debajo.
 */
function ItemCard({ item, children }: { item: BookItem; children: React.ReactNode }) {
  const { settings } = useSettings();
  const [bpm, setBpm] = useState(item.bpm[0]);
  const ts = TIME_SIGNATURE_BY_ID[item.tsId];

  return (
    <div className="card p-4 md:p-6 space-y-4">
      <p className="text-center text-[11px] text-ink-3 tabular-nums">
        {item.kind !== "rhythm" && <>{keyName(keyByVex(item.keyVex), settings.naming)} · </>}
        {ts.numerator}/{ts.denominator} · {item.top.length} compases
        {item.hand && <> · {HAND_LABEL[item.hand]}</>}
      </p>

      <p className="text-sm text-ink-2 text-center max-w-xl mx-auto">{item.focus}</p>
      {item.position && (
        <p className="text-xs text-ink-3 text-center">
          <strong className="font-semibold text-ink-2">Colocación:</strong> {item.position}
        </p>
      )}

      {item.prep?.length ? (
        <div className="card-pastel bg-yellow p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Antes de tocar</p>
          <ol className="mt-2 space-y-1.5 text-sm text-ink-2 list-decimal list-inside marker:text-ink-3 marker:font-semibold">
            {item.prep.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ol>
        </div>
      ) : null}

      <BookScore item={item} />

      <p className="text-xs text-ink-3 text-center">{KIND_HINT[item.kind]}</p>

      <BookMetronome ts={ts} bpm={bpm} onBpm={setBpm} target={item.bpm[1]} />

      <div className="flex flex-wrap justify-center gap-2">{children}</div>
    </div>
  );
}

function ItemView({
  grade,
  stage,
  item,
  read,
  onExit,
  onGo,
}: {
  grade: BookGrade;
  stage: BookStage;
  item: BookItem;
  read: boolean;
  onExit: () => void;
  onGo: (id: string) => void;
}) {
  const { answer } = useExerciseSession(EXERCISE);
  const { prev, next } = neighbours(item.id);

  const mark = () => {
    // Marcar cuenta como práctica hecha: leer en el piano es el ejercicio, y
    // si no contara, el cuaderno viviría siempre «sin empezar».
    if (toggleMark(item.id)) answer(true);
  };

  return (
    <div className="space-y-4">
      <BackHeader eyebrow={`${grade.title} · Etapa ${stage.n} · ${KIND_LABEL[item.kind]}`} title={item.title} onExit={onExit} />

      <ItemCard item={item}>
        <button type="button" onClick={mark} aria-pressed={read} className={`pill ${read ? "pill-active" : ""}`}>
          {read ? "✓ Leída" : "Marcar como leída"}
        </button>
      </ItemCard>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={!prev}
          onClick={() => prev && onGo(prev.id)}
          className="pill disabled:opacity-40 disabled:pointer-events-none max-w-[45%]"
        >
          <span className="truncate">← {prev?.title ?? "Principio del grado"}</span>
        </button>
        <button
          type="button"
          disabled={!next}
          onClick={() => next && onGo(next.id)}
          className="pill disabled:opacity-40 disabled:pointer-events-none max-w-[45%]"
        >
          <span className="truncate">{next?.title ?? "Fin del grado"} →</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Lectura infinita: una pieza nueva del grado cada vez que se pide.
 *
 * Aquí no hay nada que marcar —lo que se lee no vuelve a salir—, así que el
 * botón de «leída» solo cuenta la lectura como práctica hecha del día. El
 * contador de la sesión está porque leer cinco cosas nuevas seguidas es el
 * ejercicio, y sin verlo nadie sabe por dónde va.
 */
function RandomView({
  grade,
  kind,
  onExit,
  onKind,
}: {
  grade: BookGrade;
  kind: BookItemKind;
  onExit: () => void;
  onKind: (kind: BookItemKind) => void;
}) {
  const { answer } = useExerciseSession(EXERCISE);
  const [item, setItem] = useState(() => randomBookItem(grade.n, kind));
  const [done, setDone] = useState(0);
  const [read, setRead] = useState(false);

  // El tipo se cambia desde la cabecera sin salir de la pantalla.
  const another = (next: BookItemKind = kind) => {
    setItem(randomBookItem(grade.n, next));
    setRead(false);
  };

  return (
    <div className="space-y-4">
      <BackHeader eyebrow={`${grade.title} · Lectura infinita`} title={item.title} onExit={onExit} />

      <div className="flex justify-center gap-1.5">
        {RANDOM_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              onKind(k);
              another(k);
            }}
            aria-pressed={k === kind}
            className={`pill py-1.5 px-4 text-xs ${k === kind ? "pill-active" : ""}`}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {/* key: cada lectura empieza con el metrónomo parado y a su tempo. */}
      <ItemCard key={item.id} item={item}>
        <button type="button" onClick={() => another()} className="pill pill-active">
          Otra lectura
        </button>
        <button
          type="button"
          disabled={read}
          onClick={() => {
            setRead(true);
            setDone((n) => n + 1);
            answer(true);
          }}
          className="pill disabled:opacity-50"
        >
          {read ? "✓ Leída" : "La he leído"}
        </button>
      </ItemCard>

      <p className="text-center text-xs text-ink-3">
        {done === 0
          ? "Material nuevo cada vez, con el temario del grado. Lee, pide otra y no vuelvas atrás."
          : `${done} lectura${done > 1 ? "s" : ""} nueva${done > 1 ? "s" : ""} en esta sesión.`}
      </p>
    </div>
  );
}

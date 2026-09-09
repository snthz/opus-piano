"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { openAuthModal } from "@/lib/auth-modal";
import { cancelJob, dismissJob, getJob, startJob, useJob } from "@/lib/jobs";
import { askTeacher, generatePlan, planService, type PlanService } from "@/lib/plan/client";
import {
  classifyBlock,
  dayKey,
  defaultSchedule,
  describeSchedule,
  parseDay,
  planSessions,
  scheduleSchema,
  STEP_LABELS,
  WEEKDAY_LETTERS,
  WEEKDAY_NAMES,
  type Schedule,
} from "@/lib/agenda";
import { EXERCISES } from "@/data/exercises";
import { LESSON_SECTIONS } from "@/data/lessons";
import { exercisePath, lessonPath } from "@/lib/routes";
import { updateScorePlan, type ScoreRecord } from "@/lib/scores-db";
import { useSettings } from "@/lib/settings";
import { goalRange, LEVEL_LABELS, LEVELS, MAX_PAGES, type ChatTurn, type Goal, type Level, type PlanState } from "@/lib/study-plan";
import { isAbort, UserError } from "@/lib/user-error";
import { ChevronIcon } from "@/components/ui/arrow-icon";
import { Modal } from "@/components/ui/modal";
import { NumberField } from "@/components/ui/number-field";
import { TimeField } from "@/components/ui/time-field";
import { Select } from "@/components/ui/select";
import { ProgressRing } from "@/components/ui/progress-ring";
import { PlanIcon } from "./reader-icons";
import { useParsedXml } from "./use-score-player";

interface Props {
  record: ScoreRecord;
  /** MusicXML of the piece (the file itself, or the one linked to a PDF). */
  xml?: Blob;
  /** PDF of the piece: its pages are sent as images. */
  pdf?: Blob;
  /** Notifies the parent so its copy of the record has the up-to-date plan. */
  onPlanChange?: (plan: PlanState | undefined) => void;
}

interface FormPrefs {
  level: Level;
  minutesPerDay: number;
  daysPerWeek: number;
  goal: string;
}
const PREFS_KEY = "etude:plan-form";
const DEFAULT_PREFS: FormPrefs = { level: "principiante", minutesPerDay: 20, daysPerWeek: 4, goal: "" };

function readPrefs(): FormPrefs {
  try {
    return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<FormPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * AI-made study plan for a score: analysis, prerequisites, measure-by-measure
 * goals with fingerings, a routine, and a chat with the teacher. The server
 * prepares it with its own API key — the student pays and configures
 * nothing, just needs an account — and it's saved with the score (and the account).
 */
export function StudyPlanPanel({ record, xml, pdf, onPlanChange }: Props) {
  const { user } = useAuth();
  const [service, setService] = useState<PlanService | null>(null);
  const { settings } = useSettings();
  const { parsed } = useParsedXml(xml);
  const job = useJob("plan", record.id);
  const running = job?.status === "running" ? job : null;
  const error = job?.status === "error" ? job.error : null;
  const [state, setState] = useState<PlanState | undefined>(record.plan);
  /** Redoing an existing plan is asked in a modal; with no plan, the form lives in the panel itself. */
  const [formOpen, setFormOpen] = useState(false);
  // this panel only mounts after a user action, so storage is already available
  const [prefs, setPrefs] = useState<FormPrefs>(readPrefs);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // the generated plan arrives via the record: the library applies it when the
  // task finishes, whether this panel is open or not; shown here on change
  const [seenPlan, setSeenPlan] = useState(record.plan);
  if (record.plan !== seenPlan) {
    setSeenPlan(record.plan);
    setState(record.plan);
    if (record.plan) setFormOpen(false);
  }

  // an already-seen error stops flagging the reader once the panel closes
  useEffect(
    () => () => {
      if (getJob("plan", record.id)?.status === "error") dismissJob("plan", record.id);
    },
    [record.id],
  );

  // no server API key means no teacher, and there's no way to know until asking
  useEffect(() => {
    let alive = true;
    void planService().then((s) => {
      if (alive) setService(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  const ready = !!service?.enabled && !!user;
  /** With a half-parsed MusicXML, the teacher would see half the piece. */
  const waitingXml = !!xml && !parsed;

  const save = async (next: PlanState | undefined) => {
    setState(next);
    onPlanChange?.(next);
    await updateScorePlan(record.id, next);
  };

  const create = () => {
    if (!ready || waitingXml) return;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* no storage available */
    }
    // the form only collects data; progress is tracked from the panel, which
    // is what remains if everything else closes
    setFormOpen(false);
    if (job?.status === "error") dismissJob("plan", record.id);
    startJob(
      "plan",
      { id: record.id, name: record.name },
      async ({ signal, report }) => {
        const next = await generatePlan({
          scoreName: record.name,
          notes: record.notes,
          level: prefs.level,
          minutesPerDay: prefs.minutesPerDay,
          daysPerWeek: prefs.daysPerWeek,
          goal: prefs.goal,
          naming: settings.naming,
          parsed,
          pdf: pdf ? { blob: pdf, pageCount: record.pageCount } : null,
          onStatus: (label) => report({ label }),
          onProgress: (progress) => report({ progress }),
          signal,
        });
        // saved here, not in the panel, which may be closed when this finishes
        await updateScorePlan(record.id, next);
        return next;
      },
      "No se pudo crear el plan. Vuelve a intentarlo.",
    );
  };

  const toggleGoal = (id: string) => {
    if (!state) return;
    const progress = { ...state.progress };
    if (progress[id]) delete progress[id];
    else progress[id] = true;
    void save({ ...state, progress });
  };

  const remove = async () => {
    setConfirmDelete(false);
    await save(undefined);
  };

  const setSchedule = (schedule: Schedule | undefined) => {
    if (!state) return;
    void save({ ...state, schedule });
  };

  /**
   * The form, the same in the panel (first plan) or the modal (redo).
   * Before it, two things can be missing: the server having the teacher
   * configured, and an account to count plans against.
   */
  const form = (inModal: boolean) =>
    service === null ? (
      <p className="text-sm text-ink-3">Comprobando si el profesor está disponible…</p>
    ) : !service.enabled ? (
      <p className="text-sm text-ink-2">
        El plan de estudio con IA no está disponible en este servidor. Todo lo demás de la partitura —lectura, reproducción, anotaciones y
        notas— sigue funcionando igual.
      </p>
    ) : !user ? (
      <div className="space-y-3">
        <p className="text-sm">
          El plan lo prepara Opus Piano, sin coste para ti. Solo hace falta <strong>iniciar sesión</strong>: así se guarda con la partitura
          en tu cuenta y se reparten los {service.perDay} planes al día que puede hacer cada persona.
        </p>
        <button type="button" onClick={() => openAuthModal()} className="btn-primary text-sm w-full">
          Iniciar sesión o crear cuenta
        </button>
      </div>
    ) : (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
        className="space-y-4"
      >
        {inModal && state && (
          <p className="rounded-2xl bg-yellow text-ink px-4 py-3 text-xs">
            Ya tienes un plan. Si creas otro, el actual y sus objetivos cumplidos se sustituyen.
          </p>
        )}
        <label className="block space-y-1">
          <span className="text-sm font-medium">Tu nivel</span>
          <Select
            value={prefs.level}
            onChange={(level) => setPrefs({ ...prefs, level })}
            options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l] }))}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Minutos al día</span>
            <NumberField min={5} max={240} step={5} value={prefs.minutesPerDay} onChange={(minutesPerDay) => setPrefs({ ...prefs, minutesPerDay })} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Días por semana</span>
            <NumberField min={1} max={7} value={prefs.daysPerWeek} onChange={(daysPerWeek) => setPrefs({ ...prefs, daysPerWeek })} />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium">¿Qué quieres conseguir?</span>
          <textarea
            value={prefs.goal}
            onChange={(e) => setPrefs({ ...prefs, goal: e.target.value.slice(0, 1000) })}
            rows={3}
            placeholder="Por ejemplo: «aprender hasta el compás 16 para tocarla en la reunión familiar del mes que viene» o «mejorar la mano izquierda»…"
            className="w-full rounded-2xl px-3 py-2 text-sm bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
        </label>

        <div className="rounded-2xl bg-surface-2 px-4 py-3 text-xs text-ink-2 space-y-1">
          <p className="font-medium text-ink">Qué verá el profesor</p>
          {pdf && (
            <p>
              {record.pageCount <= MAX_PAGES ? `Las ${record.pageCount} páginas del PDF` : `Las primeras ${MAX_PAGES} páginas del PDF (de ${record.pageCount})`}
              {xml ? " y el MusicXML vinculado, nota a nota." : "."}
            </p>
          )}
          {!pdf && xml && <p>La partitura MusicXML, nota a nota.</p>}
          {record.notes.trim() && <p>Tus notas personales sobre la partitura.</p>}
          <p>Es gratis; puedes preparar {service.perDay} planes al día.</p>
        </div>

        <div className="flex items-center gap-2">
          <button type="submit" disabled={waitingXml} className="btn-primary text-sm flex-1 disabled:opacity-50">
            {state ? "Crear un plan nuevo" : "Crear mi plan de estudio"}
          </button>
          {inModal && (
            <button type="button" onClick={() => setFormOpen(false)} className="pill text-xs py-1.5 shrink-0">
              Cancelar
            </button>
          )}
        </div>
        <p className="text-xs text-ink-3">
          {waitingXml ? "Leyendo la partitura…" : "Tarda uno o dos minutos. Se prepara en segundo plano, así que puedes seguir con la partitura mientras."}
        </p>
      </form>
    );

  return (
    <div className="space-y-4">
      {running && (
        <section className="rounded-2xl bg-surface-2 p-4 space-y-2">
          <div className="flex items-center gap-3">
            <ProgressRing progress={running.progress} className="w-9 h-9 shrink-0 text-ink" />
            <p className="text-sm text-ink-2 flex-1">{running.label}</p>
            <button type="button" onClick={() => cancelJob("plan", record.id)} className="pill text-xs py-1.5 shrink-0">
              Cancelar
            </button>
          </div>
          <p className="text-xs text-ink-3">
            Puedes cerrar este panel y seguir con la partitura: el plan se prepara en segundo plano y el anillo del lector te avisa cuando esté.
          </p>
        </section>
      )}

      {error && !running && (
        <section className="rounded-2xl bg-bad-soft px-4 py-3 flex items-center gap-3">
          <p className="text-sm text-bad flex-1">{error}</p>
          <button type="button" onClick={() => dismissJob("plan", record.id)} className="pill text-xs py-1.5 shrink-0">
            Descartar
          </button>
        </section>
      )}

      {state ? (
        <>
          <PlanView
            state={state}
            onToggle={toggleGoal}
            onSchedule={setSchedule}
            action={
              !running && (
                <button type="button" onClick={() => setFormOpen(true)} className="pill text-xs py-1.5 shrink-0">
                  Rehacer
                </button>
              )
            }
          />
          <Teacher record={record} state={state} parsed={parsed} />
          <p className="text-xs text-ink-3 px-1 flex items-center gap-2 flex-wrap">
            <span>
              Plan preparado el {new Date(state.createdAt).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })} con {state.model}.
            </span>
            <span className="ml-auto">
              {!confirmDelete ? (
                <button type="button" onClick={() => setConfirmDelete(true)} className="text-bad hover:underline">Borrar plan</button>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="text-bad font-semibold">¿Seguro?</span>
                  <button type="button" onClick={() => void remove()} className="text-bad underline">Sí</button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="text-ink-2 underline">No</button>
                </span>
              )}
            </span>
          </p>

          {/* ---- Rehacer: los datos se piden en un modal para no tapar el plan ---- */}
          <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Crear un plan nuevo" subtitle={record.name}>
            {form(true)}
          </Modal>
        </>
      ) : (
        !running && (
          <section className="px-1 space-y-5">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 shrink-0 rounded-full bg-ash text-ink grid place-items-center" aria-hidden>
                <PlanIcon className="w-5 h-5" />
              </span>
              <div className="space-y-1">
                <h3 className="font-bold">Esta partitura todavía no tiene plan</h3>
                {/* Con el profesor apagado en el servidor, el reclamo sobra: lo dice el propio formulario. */}
                {service?.enabled !== false && (
                  <p className="text-sm text-ink-2">
                    Un profesor con IA lee la pieza y prepara el análisis, los objetivos por compases con sus digitaciones y una rutina a tu
                    medida. Es gratis; el plan se guarda en la partitura y puedes ir marcando lo que cumples.
                  </p>
                )}
              </div>
            </div>
            {form(false)}
          </section>
        )
      )}
    </div>
  );
}

/* ---------- The plan ---------- */

function PlanView({
  state,
  onToggle,
  onSchedule,
  action,
}: {
  state: PlanState;
  onToggle: (id: string) => void;
  onSchedule: (schedule: Schedule | undefined) => void;
  action?: React.ReactNode;
}) {
  const { plan, progress } = state;
  const done = plan.goals.filter((g) => progress[g.id]).length;
  const pct = plan.goals.length ? Math.round((done / plan.goals.length) * 100) : 0;
  const lessonTitle = (slug: string) => LESSON_SECTIONS.flatMap((s) => s.lessons).find((l) => l.slug === slug)?.title ?? slug;
  const exerciseTitle = (id: string) => EXERCISES.find((e) => e.id === id)?.title ?? id;

  return (
    <div>
      {/* header: just enough to recognize the piece; the rest folds, too much to read at once */}
      <header className="px-1 pb-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-lg leading-tight">{plan.title}</h3>
            {plan.composer && <p className="text-sm text-ink-2">{plan.composer}</p>}
          </div>
          {action}
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="pill py-1">{plan.analysis.key}</span>
          <span className="pill py-1">{plan.analysis.timeSignature}</span>
          <span className="pill py-1">Nivel: {plan.analysis.difficulty}</span>
        </div>
        <p className="text-sm text-ink-2">{plan.analysis.character}</p>
      </header>

      {/* what to do each day: the only section that starts open */}
      <Fold title="Objetivos" meta={`${done} de ${plan.goals.length} · ${pct}%`} defaultOpen>
        <div className="h-2 rounded-full bg-surface-2 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-ok transition-all" style={{ width: `${pct}%` }} />
        </div>
        <ol className="space-y-3">
          {plan.goals.map((g, i) => (
            <GoalItem key={g.id} index={i + 1} goal={g} done={!!progress[g.id]} onToggle={() => onToggle(g.id)} />
          ))}
        </ol>
      </Fold>

      <Fold title="Análisis de la pieza">
        <Field label="Tempo">{plan.analysis.tempo}</Field>
        <Field label="Estructura">{plan.analysis.form}</Field>
        <aside className="card-pastel bg-yellow px-4 py-3 text-sm">
          <strong className="block mb-1">Escala y armonía que conviene dominar</strong>
          <span className="text-ink-2">{plan.analysis.scale}</span>
        </aside>
        {plan.analysis.challenges.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-1">Dificultades principales</p>
            <ul className="list-disc pl-5 text-sm text-ink-2 space-y-1">
              {plan.analysis.challenges.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </Fold>

      {plan.prerequisites.length > 0 && (
        <Fold title="Antes de empezar (y mientras estudias)" meta={String(plan.prerequisites.length)}>
          <ul className="space-y-3">
            {plan.prerequisites.map((p, i) => (
              <li key={i} className="text-sm">
                <p className="font-medium">{p.title}</p>
                <p className="text-ink-2">{p.description}</p>
                {(p.lesson || p.exercise) && (
                  <p className="flex flex-wrap gap-1.5 mt-1.5">
                    {p.lesson && (
                      <Link href={lessonPath(p.lesson)} className="pill text-xs py-1">
                        Lección: {lessonTitle(p.lesson)}
                      </Link>
                    )}
                    {p.exercise && (
                      <Link href={exercisePath(p.exercise)} className="pill text-xs py-1">
                        Practicar: {exerciseTitle(p.exercise)}
                      </Link>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Fold>
      )}

      {plan.warmups.length > 0 && (
        <Fold title="Calentamiento" meta={String(plan.warmups.length)}>
          <ul className="list-disc pl-5 text-sm text-ink-2 space-y-1">
            {plan.warmups.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Fold>
      )}

      <Fold title="Rutina de estudio" meta={`${plan.routine.weeks} ${plan.routine.weeks === 1 ? "semana" : "semanas"}`}>
        <p className="text-sm text-ink-2">
          Sesiones de unos {plan.routine.sessionMinutes} minutos; el plan completo, unas {plan.routine.weeks} semanas.
        </p>
        {plan.routine.blocks.length > 0 && (
          <ul className="space-y-1.5 text-sm">
            {plan.routine.blocks.map((b, i) => (
              <li key={i} className="flex gap-3">
                <span className="tabular-nums text-ink-3 w-14 shrink-0">{b.minutes} min</span>
                <span>
                  <span className="font-medium">{STEP_LABELS[b.kind ?? classifyBlock(b.activity)]}: </span>
                  <span className="text-ink-2">{b.activity}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-ink-2">{plan.routine.advice}</p>
        <ScheduleSection state={state} onChange={onSchedule} />
      </Fold>
    </div>
  );
}

/* ---------- Adding the routine to the agenda ---------- */

/** Weekdays in the order they're listed here; `Date.getDay()` starts at Sunday. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"] as const;
const DAY_PRESETS = [
  { label: "Entre semana", days: [1, 2, 3, 4, 5] },
  { label: "Fin de semana", days: [6, 0] },
  { label: "Todos", days: [1, 2, 3, 4, 5, 6, 0] },
];
const TIME_PRESETS = [
  { label: "Mañana", time: "08:00" },
  { label: "Mediodía", time: "14:00" },
  { label: "Tarde", time: "18:00" },
  { label: "Noche", time: "21:00" },
];
const sameDays = (a: number[], b: number[]) => a.length === b.length && a.every((d) => b.includes(d));

/**
 * The plan's routine, put on the calendar: days, time, and start date. From
 * that, the agenda derives one session per day with the right goal on its
 * own (see `src/lib/agenda.ts`), so no session is saved here, only the schedule.
 */
function ScheduleSection({ state, onChange }: { state: PlanState; onChange: (schedule: Schedule | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Schedule | null>(null);
  const schedule = state.schedule;

  const start = () => {
    setDraft(schedule ?? defaultSchedule(readPrefs().daysPerWeek, state.plan.routine.sessionMinutes));
    setOpen(true);
  };

  const doneGoals = state.plan.goals.filter((g) => state.progress[g.id]).map((g) => g.id);
  /** When falling behind, replanning spreads only what's left over from today on. */
  const replan = () => {
    if (!schedule) return;
    onChange({ ...schedule, startDate: dayKey(new Date()), skip: doneGoals.slice(0, 30) });
  };

  const sessions = schedule ? planSessions(state.plan, schedule, state.progress) : [];
  const canReplan = !!schedule && doneGoals.length > 0 && doneGoals.length < state.plan.goals.length;

  return (
    <>
      {schedule ? (
        <div className="card-pastel bg-mint px-4 py-3 space-y-2">
          <p className="text-sm font-medium">{describeSchedule(schedule)}</p>
          <p className="text-xs text-ink-2">
            {sessions.length} {sessions.length === 1 ? "sesión" : "sesiones"} de {schedule.minutes} min
            {sessions.length > 0 && `, del ${shortDay(sessions[0].day)} al ${shortDay(sessions[sessions.length - 1].day)}`}.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <Link href="/calendar" className="pill text-xs py-1 bg-surface">
              Ver mis sesiones
            </Link>
            <button type="button" onClick={start} className="pill text-xs py-1 bg-surface">
              Cambiar
            </button>
            {canReplan && (
              <button type="button" onClick={replan} className="pill text-xs py-1 bg-surface">
                Replanificar desde hoy
              </button>
            )}
            <button type="button" onClick={() => onChange(undefined)} className="pill text-xs py-1 bg-surface text-bad">
              Quitar
            </button>
          </div>
        </div>
      ) : (
        <div className="card-pastel bg-mint px-4 py-3 space-y-2">
          <p className="text-sm">
            <strong>Programa tus sesiones.</strong> Eliges los días (y la hora, si quieres) y cada día tendrás una sesión con sus pasos, su
            cronómetro y la escala que toca calentar.
          </p>
          <button type="button" onClick={start} className="pill text-xs py-1 bg-surface">
            Programar mis sesiones
          </button>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Programar las sesiones" subtitle={state.plan.title}>
        {draft && (
          <ScheduleForm
            state={state}
            draft={draft}
            onDraft={setDraft}
            onSave={() => {
              onChange(draft);
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        )}
      </Modal>
    </>
  );
}

const shortDay = (key: string) => parseDay(key).toLocaleDateString("es", { day: "numeric", month: "short" });

function ScheduleForm({
  state,
  draft,
  onDraft,
  onSave,
  onCancel,
}: {
  state: PlanState;
  draft: Schedule;
  onDraft: (s: Schedule) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const valid = scheduleSchema.safeParse(draft).success;
  // the hour last typed, so switching to "any time" and back doesn't lose it
  const lastTime = useRef(draft.time ?? "18:00");
  // a half-filled draft (no days checked, empty time) has no spread to show
  const sessions = valid ? planSessions(state.plan, draft, state.progress) : [];

  const toggleDay = (d: number) => {
    const weekdays = draft.weekdays.includes(d) ? draft.weekdays.filter((x) => x !== d) : [...draft.weekdays, d];
    onDraft({ ...draft, weekdays });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave();
      }}
      className="space-y-4"
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium mb-1.5">¿Qué días estudias?</legend>
        <div className="grid grid-cols-7 gap-1 rounded-2xl bg-surface-2 p-1">
          {WEEK_ORDER.map((d) => {
            const on = draft.weekdays.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                aria-pressed={on}
                aria-label={WEEKDAY_NAMES[d]}
                className={`flex flex-col items-center justify-center rounded-xl py-2 leading-none transition-colors ${
                  on ? "bg-ink text-bg" : "text-ink-2 hover:bg-ink/5"
                }`}
              >
                <span className="text-sm font-semibold">{WEEKDAY_LETTERS[d]}</span>
                <span className={`mt-1 text-[10px] ${on ? "text-bg/70" : "text-ink-3"}`}>{WEEKDAY_SHORT[d]}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={draft.weekdays.length === 0 ? "text-bad" : "text-ink-2"}>
            {draft.weekdays.length === 0
              ? "Marca al menos un día."
              : `${draft.weekdays.length} ${draft.weekdays.length === 1 ? "día" : "días"} a la semana`}
          </span>
          <span className="flex-1" />
          {DAY_PRESETS.map((p) => {
            const on = sameDays(p.days, draft.weekdays);
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onDraft({ ...draft, weekdays: p.days })}
                aria-pressed={on}
                className={`underline-offset-2 ${on ? "text-ink font-medium" : "text-ink-2 hover:text-ink hover:underline"}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium mb-1.5">¿A qué hora?</legend>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onDraft({ ...draft, time: draft.time ?? lastTime.current })}
            aria-pressed={draft.time !== null}
            className={`pill flex-1 justify-center py-2 text-sm ${draft.time !== null ? "pill-active" : ""}`}
          >
            A una hora fija
          </button>
          <button
            type="button"
            onClick={() => {
              if (draft.time) lastTime.current = draft.time;
              onDraft({ ...draft, time: null });
            }}
            aria-pressed={draft.time === null}
            className={`pill flex-1 justify-center py-2 text-sm ${draft.time === null ? "pill-active" : ""}`}
          >
            Cuando pueda
          </button>
        </div>
        {draft.time !== null ? (
          <div className="flex flex-wrap items-center gap-2">
            <TimeField value={draft.time} onChange={(time) => onDraft({ ...draft, time })} className="w-full sm:w-auto sm:min-w-56" />
            <div className="flex flex-wrap gap-1.5">
              {TIME_PRESETS.map((p) => (
                <button
                  key={p.time}
                  type="button"
                  onClick={() => onDraft({ ...draft, time: p.time })}
                  aria-pressed={draft.time === p.time}
                  className={`pill py-1 px-2.5 text-xs ${draft.time === p.time ? "pill-active" : ""}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink-2">La sesión cuenta ese día a cualquier hora; el objetivo es hacerla.</p>
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Minutos por sesión</span>
          <NumberField min={5} max={240} step={5} value={draft.minutes} onChange={(minutes) => onDraft({ ...draft, minutes })} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Empezar el</span>
          <input
            type="date"
            value={draft.startDate}
            onChange={(e) => onDraft({ ...draft, startDate: e.target.value })}
            className="w-full rounded-2xl px-3 py-2 text-sm bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
      </div>

      <div className="rounded-2xl bg-surface-2 px-4 py-3 text-xs text-ink-2 space-y-1">
        <p className="font-medium text-ink">Cómo queda</p>
        {sessions.length > 0 ? (
          <>
            <p>
              {sessions.length} {sessions.length === 1 ? "sesión" : "sesiones"}, del {shortDay(sessions[0].day)} al{" "}
              {shortDay(sessions[sessions.length - 1].day)}.
            </p>
            <p>Primera: {sessions[0].goal.title}.</p>
          </>
        ) : (
          <p>Elige los días y la hora para ver el reparto.</p>
        )}
        <p>Las sesiones salen de los objetivos del plan: si los cambias o los vas cumpliendo, se ponen al día solas.</p>
      </div>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={!valid} className="btn-primary text-sm flex-1 disabled:opacity-50">
          Guardar las sesiones
        </button>
        <button type="button" onClick={onCancel} className="pill text-xs py-1.5 shrink-0">
          Cancelar
        </button>
      </div>
    </form>
  );
}

/**
 * Collapsible plan section. No card: a white card on the white sheet
 * wouldn't show, so a thin line separates sections instead.
 */
function Fold({
  title,
  meta,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** Summary to the right of the title: a hint of what's inside without opening it. */
  meta?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-line">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full flex items-center gap-3 px-1 py-4 text-left">
        <h3 className="font-bold flex-1 min-w-0">{title}</h3>
        {meta && <span className="text-xs text-ink-2 tabular-nums shrink-0">{meta}</span>}
        <ChevronIcon dir={open ? "up" : "down"} className="w-4 h-4 text-ink-3 shrink-0" />
      </button>
      {open && <div className="px-1 pb-5 space-y-3">{children}</div>}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-sm">
      <span className="font-medium">{label}: </span>
      <span className="text-ink-2">{children}</span>
    </p>
  );
}

function GoalItem({ index, goal, done, onToggle }: { index: number; goal: Goal; done: boolean; onToggle: () => void }) {
  const [open, setOpen] = useState(false);
  const range = goalRange(goal);
  return (
    <li className={`rounded-2xl px-4 py-3 ${done ? "bg-ok-soft/60" : "bg-surface-2"}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={done} onChange={onToggle} aria-label={`Objetivo ${index} cumplido`} className="mt-1 w-4 h-4 accent-(--ok)" />
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex-1 min-w-0 text-left" aria-expanded={open}>
          <p className={`text-sm font-medium ${done ? "line-through text-ink-2" : ""}`}>
            {index}. {goal.title}
          </p>
          <p className="text-xs text-ink-2">
            {range}
            {range ? " · " : ""}
            {goal.sessions} {goal.sessions === 1 ? "sesión" : "sesiones"}
          </p>
        </button>
        <ChevronIcon dir={open ? "up" : "down"} className="w-4 h-4 text-ink-3 mt-1 shrink-0" />
      </div>
      {open && (
        <div className="mt-3 pl-7 space-y-2 text-sm">
          <p className="text-ink-2">{goal.description}</p>
          {goal.tips.length > 0 && (
            <ul className="list-disc pl-5 text-ink-2 space-y-1">
              {goal.tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
          {goal.fingering && (
            <p>
              <span className="font-medium">Digitación: </span>
              <span className="text-ink-2">{goal.fingering}</span>
            </p>
          )}
          {goal.targetTempo && (
            <p>
              <span className="font-medium">Se da por cumplido: </span>
              <span className="text-ink-2">{goal.targetTempo}</span>
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/* ---------- Chat with the teacher ---------- */

function Teacher({ record, state, parsed }: { record: ScoreRecord; state: PlanState; parsed: ReturnType<typeof useParsedXml>["parsed"] }) {
  const { settings } = useSettings();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (turns.length) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [turns]);

  const ask = async () => {
    const q = question.trim();
    if (!q || busy) return;
    setQuestion("");
    setError(null);
    setBusy(true);
    const history: ChatTurn[] = [...turns, { role: "user", content: q }];
    setTurns([...history, { role: "assistant", content: "" }]);
    const ac = new AbortController();
    abort.current = ac;
    try {
      await askTeacher({
        scoreName: record.name,
        naming: settings.naming,
        state,
        parsed,
        history,
        signal: ac.signal,
        onDelta: (t) =>
          setTurns((prev) => {
            const last = prev[prev.length - 1];
            return [...prev.slice(0, -1), { ...last, content: last.content + t }];
          }),
      });
    } catch (e) {
      if (isAbort(e)) {
        setTurns((prev) => (prev[prev.length - 1]?.content ? prev : prev.slice(0, -1)));
      } else {
        setError(e instanceof UserError ? e.message : "No se pudo obtener respuesta.");
        setTurns((prev) => (prev[prev.length - 1]?.content ? prev : prev.slice(0, -1)));
      }
    } finally {
      if (abort.current === ac) abort.current = null;
      setBusy(false);
    }
  };

  const suggestions = ["¿Cómo digito el pasaje más difícil?", "¿Qué escala y arpegio caliento hoy?", "¿Cómo estudio la mano izquierda sola?"];

  return (
    // this one wants a visible card: the rest of the plan is plain text on the
    // sheet, so the pastel card separates "reading the plan" from "talking to the teacher"
    <section className="card-pastel bg-blue p-5 space-y-3">
      <div>
        <h3 className="font-bold">Pregunta al profesor</h3>
        <p className="text-xs text-ink-2">Conoce tu plan y la partitura. Pregunta por un compás, una digitación o cómo organizar la sesión de hoy.</p>
      </div>

      {turns.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {turns.map((t, i) => (
            <div key={i} className={`text-sm whitespace-pre-wrap rounded-2xl px-3 py-2 ${t.role === "user" ? "bg-accent text-bg ml-8" : "bg-surface mr-4"}`}>
              {t.content || <span className="animate-pulse">…</span>}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      {turns.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => setQuestion(s)} className="pill text-xs py-1">
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-bad">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, 2000))}
          placeholder="Escribe tu pregunta…"
          disabled={busy}
          className="flex-1 min-w-0 rounded-2xl px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
        />
        {busy ? (
          <button type="button" onClick={() => abort.current?.abort()} className="pill text-xs py-1.5 shrink-0">
            Parar
          </button>
        ) : (
          <button type="submit" disabled={!question.trim()} className="pill pill-active text-xs py-1.5 shrink-0 disabled:opacity-50">
            Enviar
          </button>
        )}
      </form>
    </section>
  );
}

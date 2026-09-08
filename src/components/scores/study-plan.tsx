"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { activeTarget, isAiReady, useAiConfig } from "@/lib/ai/config";
import { AiError, isAbort, type ChatTurn } from "@/lib/ai/errors";
import { cancelJob, dismissJob, getJob, startJob, useJob } from "@/lib/jobs";
import { estimatePlanCost, formatCost, modelById } from "@/lib/ai/models";
import { askTeacher, generatePlan, MAX_PAGES } from "@/lib/ai/study-plan-client";
import { EXERCISES } from "@/data/exercises";
import { LESSON_SECTIONS } from "@/data/lessons";
import { exercisePath, lessonPath } from "@/lib/routes";
import { updateScorePlan, type ScoreRecord } from "@/lib/scores-db";
import { useSettings } from "@/lib/settings";
import { goalRange, LEVEL_LABELS, LEVELS, type Goal, type Level, type PlanState } from "@/lib/study-plan";
import { AiSettings } from "@/components/settings/ai-settings";
import { ChevronIcon } from "@/components/ui/arrow-icon";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { ProgressRing } from "@/components/ui/progress-ring";
import { PlanIcon } from "./reader-icons";
import { useParsedXml } from "./use-score-player";

interface Props {
  record: ScoreRecord;
  /** MusicXML de la pieza (el archivo, o el vinculado a un PDF) */
  xml?: Blob;
  /** PDF de la pieza: sus páginas se envían como imágenes */
  pdf?: Blob;
  /** Avisa al padre para que su copia del registro tenga el plan al día */
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
 * Plan de estudio de una partitura hecho con IA: análisis, qué saber antes,
 * objetivos por compases con digitaciones, rutina y un chat con el profesor.
 * Se genera en el dispositivo con la clave del usuario y se guarda con la
 * partitura (y en la cuenta, si la hay).
 */
export function StudyPlanPanel({ record, xml, pdf, onPlanChange }: Props) {
  const config = useAiConfig();
  const { settings } = useSettings();
  const { parsed } = useParsedXml(xml);
  const job = useJob("plan", record.id);
  const running = job?.status === "running" ? job : null;
  const error = job?.status === "error" ? job.error : null;
  const [state, setState] = useState<PlanState | undefined>(record.plan);
  /** Rehacer un plan que ya existe se pide en un modal; sin plan, el formulario va en el propio panel. */
  const [formOpen, setFormOpen] = useState(false);
  // El panel solo se monta tras una acción del usuario, así que el almacenamiento ya está disponible.
  const [prefs, setPrefs] = useState<FormPrefs>(readPrefs);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // El plan generado llega por el registro: lo aplica la biblioteca cuando la
  // tarea acaba, esté este panel abierto o no. Al cambiar, se enseña.
  const [seenPlan, setSeenPlan] = useState(record.plan);
  if (record.plan !== seenPlan) {
    setSeenPlan(record.plan);
    setState(record.plan);
    if (record.plan) setFormOpen(false);
  }

  // Un fallo ya visto deja de reclamar atención en el lector al cerrar el panel.
  useEffect(
    () => () => {
      if (getJob("plan", record.id)?.status === "error") dismissJob("plan", record.id);
    },
    [record.id],
  );

  const ready = isAiReady(config);
  const target = activeTarget(config);
  const model = modelById(target.provider, target.model);
  /** Con un MusicXML a medio leer, el profesor vería la pieza a medias. */
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
      /* sin almacenamiento */
    }
    // El formulario solo recoge los datos: el avance se sigue desde el panel,
    // que es lo que queda si se cierra todo.
    setFormOpen(false);
    if (job?.status === "error") dismissJob("plan", record.id);
    startJob(
      "plan",
      { id: record.id, name: record.name },
      async ({ signal, report }) => {
        const next = await generatePlan({
          target,
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
        // Se guarda aquí y no en el panel, que puede estar cerrado cuando acabe.
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

  /**
   * El formulario, igual dentro del panel (primer plan) que en el modal
   * (rehacer): sin clave de API, en su lugar se pide la clave.
   */
  const form = (inModal: boolean) =>
    !ready ? (
      <div className="space-y-4">
        <p className="text-sm">
          Para preparar el plan hace falta la clave de API de <strong>ChatGPT (OpenAI)</strong> o de <strong>Claude (Anthropic)</strong>.
          Se guarda solo en este dispositivo y el coste (céntimos por plan) lo pagas tú al proveedor. También puedes cambiarla en{" "}
          <Link href="/settings" className="underline">Ajustes</Link>.
        </p>
        <AiSettings compact />
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
            <input
              type="number"
              min={5}
              max={240}
              value={prefs.minutesPerDay}
              onChange={(e) => setPrefs({ ...prefs, minutesPerDay: Math.max(5, Math.min(240, Number(e.target.value) || 0)) })}
              className="w-full rounded-2xl px-3 py-2 text-sm bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Días por semana</span>
            <input
              type="number"
              min={1}
              max={7}
              value={prefs.daysPerWeek}
              onChange={(e) => setPrefs({ ...prefs, daysPerWeek: Math.max(1, Math.min(7, Number(e.target.value) || 0)) })}
              className="w-full rounded-2xl px-3 py-2 text-sm bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent"
            />
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
          {model && (
            <p>
              Modelo: {model.name}{model.recommended ? " (recomendado)" : ""} · {formatCost(estimatePlanCost(model))}.{" "}
              <Link href="/settings" className="underline">Cambiar</Link>
            </p>
          )}
          {!model && <p>Modelo: {target.model}</p>}
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
                <p className="text-sm text-ink-2">
                  Un profesor con IA lee la pieza y prepara el análisis, los objetivos por compases con sus digitaciones y una rutina a tu
                  medida. El plan se guarda en la partitura y puedes ir marcando lo que cumples.
                </p>
              </div>
            </div>
            {form(false)}
          </section>
        )
      )}
    </div>
  );
}

/* ---------- El plan ---------- */

function PlanView({ state, onToggle, action }: { state: PlanState; onToggle: (id: string) => void; action?: React.ReactNode }) {
  const { plan, progress } = state;
  const done = plan.goals.filter((g) => progress[g.id]).length;
  const pct = plan.goals.length ? Math.round((done / plan.goals.length) * 100) : 0;
  const lessonTitle = (slug: string) => LESSON_SECTIONS.flatMap((s) => s.lessons).find((l) => l.slug === slug)?.title ?? slug;
  const exerciseTitle = (id: string) => EXERCISES.find((e) => e.id === id)?.title ?? id;

  return (
    <div className="space-y-4">
      <section className="card p-5 space-y-3">
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
      </section>

      {plan.prerequisites.length > 0 && (
        <section className="card p-5 space-y-3">
          <h3 className="font-bold">Antes de empezar (y mientras estudias)</h3>
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
        </section>
      )}

      {plan.warmups.length > 0 && (
        <section className="card p-5 space-y-2">
          <h3 className="font-bold">Calentamiento</h3>
          <ul className="list-disc pl-5 text-sm text-ink-2 space-y-1">
            {plan.warmups.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-5 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold">Objetivos</h3>
            <span className="text-xs text-ink-2 tabular-nums">{done} de {plan.goals.length} · {pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-ok transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <ol className="space-y-3">
          {plan.goals.map((g, i) => (
            <GoalItem key={g.id} index={i + 1} goal={g} done={!!progress[g.id]} onToggle={() => onToggle(g.id)} />
          ))}
        </ol>
      </section>

      <section className="card p-5 space-y-3">
        <h3 className="font-bold">Rutina de estudio</h3>
        <p className="text-sm text-ink-2">
          Sesiones de unos {plan.routine.sessionMinutes} minutos; el plan completo, unas {plan.routine.weeks} semanas.
        </p>
        {plan.routine.blocks.length > 0 && (
          <ul className="space-y-1.5 text-sm">
            {plan.routine.blocks.map((b, i) => (
              <li key={i} className="flex gap-3">
                <span className="tabular-nums text-ink-3 w-14 shrink-0">{b.minutes} min</span>
                <span>{b.activity}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-ink-2">{plan.routine.advice}</p>
      </section>
    </div>
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

/* ---------- Chat con el profesor ---------- */

function Teacher({ record, state, parsed }: { record: ScoreRecord; state: PlanState; parsed: ReturnType<typeof useParsedXml>["parsed"] }) {
  const config = useAiConfig();
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
        target: activeTarget(config),
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
        setError(e instanceof AiError ? e.message : "No se pudo obtener respuesta.");
        setTurns((prev) => (prev[prev.length - 1]?.content ? prev : prev.slice(0, -1)));
      }
    } finally {
      if (abort.current === ac) abort.current = null;
      setBusy(false);
    }
  };

  const suggestions = ["¿Cómo digito el pasaje más difícil?", "¿Qué escala y arpegio caliento hoy?", "¿Cómo estudio la mano izquierda sola?"];

  return (
    <section className="card p-5 space-y-3">
      <div>
        <h3 className="font-bold">Pregunta al profesor</h3>
        <p className="text-xs text-ink-2">Conoce tu plan y la partitura. Pregunta por un compás, una digitación o cómo organizar la sesión de hoy.</p>
      </div>

      {turns.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {turns.map((t, i) => (
            <div key={i} className={`text-sm whitespace-pre-wrap rounded-2xl px-3 py-2 ${t.role === "user" ? "bg-accent text-white ml-8" : "bg-surface-2 mr-4"}`}>
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
          className="flex-1 min-w-0 rounded-2xl px-3 py-2 text-sm bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
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

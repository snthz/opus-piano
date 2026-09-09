import { describe, expect, test } from "bun:test";
import {
  addMinutes,
  agendaByDay,
  dayKey,
  defaultSchedule,
  describeSchedule,
  MAX_SESSIONS,
  nextSession,
  parseDay,
  planKey,
  planSessions,
  scheduleSchema,
  sessionSteps,
  startOfWeek,
  weekSummary,
  type Schedule,
} from "@/lib/agenda";
import type { Goal, PlanState, StudyPlan } from "@/lib/study-plan";

const goal = (id: string, sessions: number): Goal => ({
  id,
  title: `Objetivo ${id}`,
  from: 1,
  to: 8,
  hands: "juntas",
  description: "",
  tips: [],
  fingering: "",
  targetTempo: "",
  sessions,
});

function makePlan(goals: Goal[], blocks: { minutes: number; activity: string; kind?: "calentamiento" | "objetivo" | "repaso" }[] = []): StudyPlan {
  return {
    title: "Minueto",
    composer: "Bach",
    analysis: { key: "Sol mayor", scale: "", timeSignature: "3/4", tempo: "", form: "", difficulty: "elemental", character: "", challenges: [] },
    prerequisites: [],
    warmups: [],
    goals,
    routine: { sessionMinutes: 30, weeks: 4, blocks, advice: "" },
  };
}

/** 2026-09-07 es lunes. */
const schedule: Schedule = { weekdays: [1, 3, 5], time: "18:00", startDate: "2026-09-07", minutes: 30, done: {}, skip: [] };

describe("fechas locales", () => {
  test("dayKey y parseDay van y vuelven sin cruzar la medianoche UTC", () => {
    // Una fecha que en UTC−N cae en el día anterior si se pasa por toISOString.
    const d = new Date(2026, 8, 7, 23, 30);
    expect(dayKey(d)).toBe("2026-09-07");
    expect(dayKey(parseDay("2026-09-07"))).toBe("2026-09-07");
    expect(parseDay("2026-09-07").getDay()).toBe(1);
  });

  test("la semana empieza en lunes", () => {
    expect(dayKey(startOfWeek(parseDay("2026-09-07")))).toBe("2026-09-07"); // lunes
    expect(dayKey(startOfWeek(parseDay("2026-09-13")))).toBe("2026-09-07"); // domingo
    expect(dayKey(startOfWeek(parseDay("2026-09-14")))).toBe("2026-09-14"); // lunes siguiente
  });

  test("addMinutes suma la hora y se planta en 23:59 en vez de dar la vuelta", () => {
    expect(addMinutes("18:00", 45)).toBe("18:45");
    expect(addMinutes("18:40", 25)).toBe("19:05");
    expect(addMinutes("23:30", 60)).toBe("23:59");
  });
});

describe("reparto de las sesiones", () => {
  test("cada objetivo ocupa tantas sesiones seguidas como estima el plan", () => {
    const sessions = planSessions(makePlan([goal("g1", 2), goal("g2", 3)]), schedule);
    expect(sessions.map((s) => s.goal.id)).toEqual(["g1", "g1", "g2", "g2", "g2"]);
    expect(sessions.map((s) => s.ofGoal)).toEqual([
      { n: 1, total: 2 },
      { n: 2, total: 2 },
      { n: 1, total: 3 },
      { n: 2, total: 3 },
      { n: 3, total: 3 },
    ]);
    expect(sessions.map((s) => s.index)).toEqual([1, 2, 3, 4, 5]);
  });

  test("caen solo en los días de la semana elegidos, desde la fecha de inicio", () => {
    const sessions = planSessions(makePlan([goal("g1", 5)]), schedule);
    expect(sessions.map((s) => s.day)).toEqual(["2026-09-07", "2026-09-09", "2026-09-11", "2026-09-14", "2026-09-16"]);
    expect(sessions.every((s) => [1, 3, 5].includes(parseDay(s.day).getDay()))).toBe(true);
  });

  test("si la fecha de inicio no es día de estudio, empieza en el siguiente que lo sea", () => {
    const sessions = planSessions(makePlan([goal("g1", 1)]), { ...schedule, startDate: "2026-09-08" });
    expect(sessions[0].day).toBe("2026-09-09");
  });

  test("un día a la semana reparte las sesiones semana a semana", () => {
    const sessions = planSessions(makePlan([goal("g1", 3)]), { ...schedule, weekdays: [6] });
    expect(sessions.map((s) => s.day)).toEqual(["2026-09-12", "2026-09-19", "2026-09-26"]);
  });

  test("los objetivos de «skip» no ocupan sesión", () => {
    const sessions = planSessions(makePlan([goal("g1", 2), goal("g2", 2)]), { ...schedule, skip: ["g1"] });
    expect(sessions.map((s) => s.goal.id)).toEqual(["g2", "g2"]);
    expect(sessions[0].day).toBe("2026-09-07");
  });

  test("un día marcado en la agenda o un objetivo ya cumplido dan la sesión por estudiada", () => {
    const plan = makePlan([goal("g1", 2), goal("g2", 2)]);
    const sessions = planSessions(plan, { ...schedule, done: { "2026-09-09": true } }, { g2: true });
    expect(sessions.map((s) => s.done)).toEqual([false, true, true, true]);
  });

  test("un «sessions» disparatado del modelo no genera años de calendario", () => {
    const sessions = planSessions(makePlan([goal("g1", 5000), goal("g2", 5000)]), schedule);
    expect(sessions.length).toBeLessThanOrEqual(MAX_SESSIONS);
    expect(sessions.length).toBeGreaterThan(0);
  });

  test("sessions a 0 o negativo sigue valiendo una sesión", () => {
    expect(planSessions(makePlan([goal("g1", 0)]), schedule)).toHaveLength(1);
    expect(planSessions(makePlan([goal("g1", -3)]), schedule)).toHaveLength(1);
  });
});

describe("los pasos de una sesión", () => {
  const blocks = [
    { minutes: 5, activity: "Escala de sol mayor, manos separadas" },
    { minutes: 15, activity: "Compases 1-8 a ♩ = 60" },
    { minutes: 10, activity: "Repaso de lo aprendido" },
  ];

  test("cada paso arranca donde acaba el anterior, con su hora si la sesión la tiene", () => {
    const plan = makePlan([goal("g1", 1)], blocks);
    const [session] = planSessions(plan, schedule);
    const steps = sessionSteps(plan, session);
    expect(steps.map((s) => [s.kind, s.minutes, s.from, s.to])).toEqual([
      ["calentamiento", 5, "18:00", "18:05"],
      ["objetivo", 15, "18:05", "18:20"],
      ["repaso", 10, "18:20", "18:30"],
    ]);
    expect(steps.map((s) => s.offset)).toEqual([0, 5, 20]);
    expect(steps[1].title).toBe("Objetivo g1");
    expect(steps[0].title).toBe("Calentamiento");
  });

  test("sin hora fija no hay horas de reloj, solo minutos desde el inicio", () => {
    const plan = makePlan([goal("g1", 1)], blocks);
    const [session] = planSessions(plan, { ...schedule, time: null });
    const steps = sessionSteps(plan, session);
    expect(steps.every((s) => s.from === null && s.to === null)).toBe(true);
    expect(steps.map((s) => s.offset)).toEqual([0, 5, 20]);
  });

  test("los bloques se escalan a los minutos elegidos y suman exactamente la sesión", () => {
    const plan = makePlan([goal("g1", 1)], blocks); // 30 min de rutina
    const [session] = planSessions(plan, { ...schedule, minutes: 20 });
    const steps = sessionSteps(plan, session);
    expect(steps.reduce((n, s) => n + s.minutes, 0)).toBe(20);
    expect(steps.map((s) => s.minutes)).toEqual([3, 10, 7]);
    const [longer] = planSessions(plan, { ...schedule, minutes: 45 });
    expect(sessionSteps(plan, longer).reduce((n, s) => n + s.minutes, 0)).toBe(45);
  });

  test("el «kind» del modelo manda sobre la redacción", () => {
    const plan = makePlan([goal("g1", 1)], [{ minutes: 10, activity: "Escala", kind: "repaso" }]);
    const [session] = planSessions(plan, schedule);
    expect(sessionSteps(plan, session)[0].kind).toBe("repaso");
  });

  test("un plan sin bloques recibe calentamiento, objetivo y repaso", () => {
    const plan = makePlan([goal("g1", 1)]);
    const [session] = planSessions(plan, schedule);
    const steps = sessionSteps(plan, session);
    expect(steps.map((s) => s.kind)).toEqual(["calentamiento", "objetivo", "repaso"]);
    expect(steps.reduce((n, s) => n + s.minutes, 0)).toBe(30);
  });

  test("ningún paso baja de un minuto aunque la sesión sea muy corta", () => {
    const plan = makePlan([goal("g1", 1)], blocks);
    const [session] = planSessions(plan, { ...schedule, minutes: 5 });
    expect(sessionSteps(plan, session).every((s) => s.minutes >= 1)).toBe(true);
  });

  test("la tonalidad sale del cifrado corto o, en planes viejos, del texto", () => {
    const plan = makePlan([goal("g1", 1)]);
    expect(planKey(plan)?.vex).toBe("G");
    expect(planKey({ ...plan, analysis: { ...plan.analysis, key: "Sol mayor", keySignature: "Em" } })?.vex).toBe("Em");
    expect(planKey({ ...plan, analysis: { ...plan.analysis, key: "no consta" } })).toBeNull();
  });
});

describe("la agenda de toda la biblioteca", () => {
  const state = (plan: StudyPlan, s: Schedule, progress: Record<string, boolean> = {}): PlanState => ({
    plan,
    progress,
    model: "claude-sonnet-5",
    createdAt: 1,
    schedule: s,
  });

  test("agrupa por día y ordena por hora las partituras que coinciden", () => {
    const byDay = agendaByDay([
      { id: "a", name: "Minueto", plan: state(makePlan([goal("g1", 1)]), { ...schedule, time: "20:00" }) },
      { id: "b", name: "Gymnopédie", plan: state(makePlan([goal("g1", 1)]), { ...schedule, time: "08:30" }) },
      { id: "c", name: "Sin plan" },
    ]);
    expect(byDay.get("2026-09-07")?.map((e) => e.score.name)).toEqual(["Gymnopédie", "Minueto"]);
  });

  test("una partitura con plan pero sin horario no entra en la agenda", () => {
    const noSchedule: PlanState = { plan: makePlan([goal("g1", 3)]), progress: {}, model: "m", createdAt: 1 };
    expect(agendaByDay([{ id: "a", name: "Minueto", plan: noSchedule }]).size).toBe(0);
  });

  test("las sesiones sin hora van después de las que la tienen", () => {
    const byDay = agendaByDay([
      { id: "a", name: "Sin hora", plan: state(makePlan([goal("g1", 1)]), { ...schedule, time: null }) },
      { id: "b", name: "A las ocho", plan: state(makePlan([goal("g1", 1)]), { ...schedule, time: "20:00" }) },
    ]);
    expect(byDay.get("2026-09-07")?.map((e) => e.score.name)).toEqual(["A las ocho", "Sin hora"]);
    expect(nextSession(byDay, "2026-09-07")?.score.name).toBe("A las ocho");
  });

  test("el resumen de la semana cuenta sus sesiones y las hechas", () => {
    const byDay = agendaByDay([{ id: "a", name: "Minueto", plan: state(makePlan([goal("g1", 4)]), { ...schedule, done: { "2026-09-07": true } }) }]);
    expect(weekSummary(byDay, parseDay("2026-09-07"))).toEqual({ total: 3, done: 1 });
    expect(weekSummary(byDay, parseDay("2026-09-14"))).toEqual({ total: 1, done: 0 });
  });

  test("la próxima sesión es la primera sin estudiar desde la fecha dada", () => {
    const byDay = agendaByDay([{ id: "a", name: "Minueto", plan: state(makePlan([goal("g1", 4)]), { ...schedule, done: { "2026-09-09": true } }) }]);
    expect(nextSession(byDay, "2026-09-08")?.session.day).toBe("2026-09-11");
    expect(nextSession(byDay, "2026-12-01")).toBeNull();
  });
});

describe("el horario que se guarda", () => {
  test("describeSchedule lo dice en castellano y en orden de semana", () => {
    expect(describeSchedule(schedule)).toBe("Lunes, miércoles y viernes a las 18:00");
    expect(describeSchedule({ ...schedule, weekdays: [0, 6] })).toBe("Sábado y domingo a las 18:00");
    expect(describeSchedule({ ...schedule, weekdays: [4] })).toBe("Jueves a las 18:00");
    expect(describeSchedule({ ...schedule, time: null })).toBe("Lunes, miércoles y viernes a cualquier hora");
  });

  test("defaultSchedule propone días repartidos y empieza hoy", () => {
    const s = defaultSchedule(3, 25, parseDay("2026-09-08"));
    expect(s.weekdays).toEqual([1, 3, 5]);
    expect(s.startDate).toBe("2026-09-08");
    expect(s.minutes).toBe(25);
    expect(scheduleSchema.safeParse(s).success).toBe(true);
  });

  test("el esquema rechaza horarios que romperían el reparto", () => {
    expect(scheduleSchema.safeParse({ ...schedule, weekdays: [] }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...schedule, weekdays: [7] }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...schedule, time: "25:00" }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...schedule, time: "8:00" }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...schedule, time: null }).success).toBe(true);
    expect(scheduleSchema.safeParse({ ...schedule, startDate: "8/9/2026" }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...schedule, minutes: 0 }).success).toBe(false);
  });
});

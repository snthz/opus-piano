import { z } from "zod";
import type { Goal, PlanState, StudyPlan } from "@/lib/study-plan";
import type { KeyInfo } from "@/lib/music/keys";
import { keyByVex } from "@/lib/music/keys";
import { parseKeyName } from "@/lib/music/fingering";

/**
 * Study sessions: what days (and, optionally, what time) each score gets
 * studied, and what each session consists of.
 *
 * No session is stored here. The schedule (weekdays, time, start date) is
 * saved with the plan, and sessions are derived from it plus the plan's
 * goals, which already carry each one's estimated session count. That way
 * the sessions can never contradict the plan.
 *
 * Everything here is deterministic and works with local dates
 * ("2026-09-08"), never UTC — a Monday-night session shouldn't show up on
 * Tuesday because of a timezone shift.
 */

/* ---------- Days and times ---------- */

/** Indices as returned by `Date.getDay()`: 0 = Sunday. */
export const WEEKDAY_LETTERS = ["D", "L", "M", "X", "J", "V", "S"] as const;
export const WEEKDAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;

/** Local date as "YYYY-MM-DD"; `toISOString` goes through UTC and can shift the day. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local midnight for the given day; `new Date("2026-09-08")` would be UTC midnight. */
export function parseDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

/** Monday of that date's week (weeks start on Monday here). */
export function startOfWeek(d: Date): Date {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

/** Adds minutes to an "HH:MM" time; clamps to 23:59 past midnight instead of wrapping. */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
  if (total >= 24 * 60) return "23:59";
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/* ---------- The schedule saved with the plan ---------- */

export const scheduleSchema = z.object({
  /** Weekdays with a session (0 = Sunday). */
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  /** Local start time, "HH:MM"; null = any time that day. */
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  /** First day counted when spreading sessions, "YYYY-MM-DD". */
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minutes: z.number().int().min(5).max(240),
  /** Days marked as studied: { "2026-09-10": true } */
  done: z.record(z.string().max(10), z.boolean()),
  /**
   * Goals no longer taking a calendar slot. Filled in by "Replan from today"
   * with whatever was already done, so the rest spreads from the new date
   * instead of dragging the delay.
   */
  skip: z.array(z.string().max(20)).max(30),
});
export type Schedule = z.infer<typeof scheduleSchema>;

/** Suggested days for someone studying N days/week; editable in the form. */
const WEEKDAY_PRESETS: Record<number, number[]> = {
  1: [6],
  2: [2, 5],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

export function defaultSchedule(daysPerWeek: number, minutes: number, today = new Date()): Schedule {
  const days = Math.max(1, Math.min(7, Math.round(daysPerWeek)));
  return {
    weekdays: WEEKDAY_PRESETS[days] ?? WEEKDAY_PRESETS[3],
    time: "18:00",
    startDate: dayKey(today),
    minutes: Math.max(5, Math.min(240, minutes)),
    done: {},
    skip: [],
  };
}

/**
 * The schedule made right after analysing a score, from what the form
 * already asked (days a week, minutes a day): sessions on the usual days for
 * that count, at any time, starting today. Re-analysing keeps the days and
 * hour the student had chosen and starts the new goals from today.
 */
export function scheduleForAnalysis(daysPerWeek: number, minutes: number, previous?: Schedule, today = new Date()): Schedule {
  const fresh = defaultSchedule(daysPerWeek, minutes, today);
  return {
    ...fresh,
    weekdays: previous?.weekdays ?? fresh.weekdays,
    time: previous ? previous.time : null,
    minutes: previous?.minutes ?? fresh.minutes,
  };
}

/** e.g. "Lunes, miércoles y viernes a las 18:00" or "… a cualquier hora". */
export function describeSchedule(s: Schedule): string {
  const names = [...new Set(s.weekdays)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAY_NAMES[d]);
  const list = names.length === 7 ? "todos los días" : names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} ${s.time ? `a las ${s.time}` : "a cualquier hora"}`;
}

/* ---------- From the plan's goals to the sessions ---------- */

export interface Session {
  /** Session number within the plan, starting at 1. */
  index: number;
  /** Local date "YYYY-MM-DD". */
  day: string;
  /** "HH:MM", or null when the session can happen at any time that day. */
  time: string | null;
  minutes: number;
  goal: Goal;
  /** Which session of that goal this is, and how many it has in total. */
  ofGoal: { n: number; total: number };
  done: boolean;
}

/**
 * Caps on the spread. A normal plan has 5-9 goals of 2-5 sessions each; these
 * limits exist so a bogus `sessions` value from the model can't generate
 * years of calendar, not to trim real plans.
 */
const MAX_SESSIONS_PER_GOAL = 30;
export const MAX_SESSIONS = 200;

/**
 * Spreads the plan's goals across the schedule's days in order: each goal
 * takes as many consecutive sessions as it estimates, landing on the next
 * chosen weekday from `startDate`.
 *
 * `progress` marks a goal's session as done once the goal itself is done, so
 * the plan and the sessions never disagree.
 */
export function planSessions(plan: StudyPlan, schedule: Schedule, progress: Record<string, boolean> = {}): Session[] {
  const skipped = new Set(schedule.skip);
  const slots: { goal: Goal; n: number; total: number }[] = [];
  for (const goal of plan.goals) {
    if (skipped.has(goal.id)) continue;
    const total = Math.max(1, Math.min(goal.sessions, MAX_SESSIONS_PER_GOAL));
    for (let n = 1; n <= total && slots.length < MAX_SESSIONS; n++) slots.push({ goal, n, total });
  }

  const weekdays = new Set(schedule.weekdays);
  const sessions: Session[] = [];
  const cursor = parseDay(schedule.startDate);
  // guard in case `weekdays` came out empty from corrupt data
  for (let guard = 0; guard < MAX_SESSIONS * 7 + 7 && sessions.length < slots.length; guard++) {
    if (weekdays.has(cursor.getDay())) {
      const slot = slots[sessions.length];
      const day = dayKey(cursor);
      sessions.push({
        index: sessions.length + 1,
        day,
        time: schedule.time,
        minutes: schedule.minutes,
        goal: slot.goal,
        ofGoal: { n: slot.n, total: slot.total },
        done: !!schedule.done[day] || !!progress[slot.goal.id],
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return sessions;
}

/* ---------- What a session consists of ---------- */

export const STEP_KINDS = ["calentamiento", "objetivo", "repaso"] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export const STEP_LABELS: Record<StepKind, string> = {
  calentamiento: "Calentamiento",
  objetivo: "Objetivo",
  repaso: "Repaso",
};

export interface SessionStep {
  kind: StepKind;
  minutes: number;
  /** Heading in the session: the kind, or the goal's title for goal steps. */
  title: string;
  /** What the plan says to do in this block, in one line. */
  activity: string;
  /** Minutes from the session's start. */
  offset: number;
  /** Clock times, only when the session has a fixed hour. */
  from: string | null;
  to: string | null;
}

/**
 * Sorts a routine block into a step kind from its wording, for plans made
 * before the model was asked to say it outright.
 */
export function classifyBlock(activity: string): StepKind {
  const t = activity.toLowerCase();
  if (/calent|escala|arpegio|warm|estir/.test(t)) return "calentamiento";
  if (/repas|revis|junta todo|entera|completa|de principio a fin|repite lo/.test(t)) return "repaso";
  return "objetivo";
}

const DEFAULT_SHARE: Record<StepKind, number> = { calentamiento: 0.2, objetivo: 0.65, repaso: 0.15 };

/**
 * The steps of one session. Comes from the plan's routine blocks, scaled to
 * the minutes chosen in the schedule (a 30-minute routine studied in 20
 * shrinks every block, never drops one); a plan without blocks gets the
 * usual three. Every step lasts at least a minute, and the total always
 * matches the session so the timer ends when the session does.
 */
export function sessionSteps(plan: StudyPlan, session: Session): SessionStep[] {
  const source: { kind: StepKind; minutes: number; activity: string }[] = plan.routine.blocks.length
    ? plan.routine.blocks.map((b) => ({ kind: b.kind ?? classifyBlock(b.activity), minutes: Math.max(0, b.minutes), activity: b.activity }))
    : [
        { kind: "calentamiento", minutes: DEFAULT_SHARE.calentamiento, activity: "Escala y arpegio de la tonalidad, manos separadas y despacio." },
        { kind: "objetivo", minutes: DEFAULT_SHARE.objetivo, activity: session.goal.description || "Trabaja el objetivo de hoy a un tempo cómodo." },
        { kind: "repaso", minutes: DEFAULT_SHARE.repaso, activity: "Toca de seguido lo que ya sabes y lo que acabas de trabajar." },
      ];

  const weightTotal = source.reduce((n, b) => n + b.minutes, 0) || 1;
  const minutes = source.map((b) => Math.max(1, Math.round((b.minutes / weightTotal) * session.minutes)));
  // rounding drifts a minute or two: settle it on the longest goal step (or the longest step)
  const diff = session.minutes - minutes.reduce((n, m) => n + m, 0);
  const goalIdx = source.flatMap((b, i) => (b.kind === "objetivo" ? [i] : []));
  const pool = goalIdx.length ? goalIdx : source.map((_, i) => i);
  const longest = pool.reduce((best, i) => (minutes[i] > minutes[best] ? i : best), pool[0]);
  // if every step is already at its minimum the session runs a minute over rather than losing a step
  minutes[longest] = Math.max(1, minutes[longest] + diff);

  let offset = 0;
  return source.map((b, i) => {
    const from = session.time ? addMinutes(session.time, offset) : null;
    const step: SessionStep = {
      kind: b.kind,
      minutes: minutes[i],
      title: b.kind === "objetivo" ? session.goal.title : STEP_LABELS[b.kind],
      activity: b.activity,
      offset,
      from,
      to: session.time ? addMinutes(session.time, offset + minutes[i]) : null,
    };
    offset += minutes[i];
    return step;
  });
}

/** The key the plan says the piece is in, for drawing its scale; null when it can't be read. */
export function planKey(plan: StudyPlan): KeyInfo | null {
  if (plan.analysis.keySignature) {
    try {
      return keyByVex(plan.analysis.keySignature);
    } catch {
      /* fall through to the prose */
    }
  }
  return parseKeyName(plan.analysis.key);
}

/* ---------- The plan answering back ---------- */

/** Extra sessions a single goal can earn from "this one's hard". */
export const MAX_EXTRA_SESSIONS = 3;

/**
 * The plan as it stands after what the student said at the end of each
 * session.
 *
 * A plan that never changes is a plan that stops being true by the second
 * week: the model guessed how many sessions each goal needed before anyone
 * had played a note. So a goal reported as hard earns another session — the
 * rest of the calendar moves along with it, which is the honest thing — and a
 * goal reported as achieved is done, freeing whatever it had left.
 *
 * Nothing is rewritten: the answers are stored apart and the plan is derived
 * from them, so the plan the model wrote can always be read as it was.
 */
export function adjustedPlan(state: PlanState): { plan: StudyPlan; progress: Record<string, boolean> } {
  const reviews = Object.values(state.reviews ?? {});
  if (!reviews.length) return { plan: state.plan, progress: state.progress };

  const progress = { ...state.progress };
  const goals = state.plan.goals.map((goal) => {
    const mine = reviews.filter((r) => r.goalId === goal.id);
    if (!mine.length) return goal;
    if (mine.some((r) => r.outcome === "conseguido")) progress[goal.id] = true;
    const hard = mine.filter((r) => r.outcome === "cuesta").length;
    return hard ? { ...goal, sessions: goal.sessions + Math.min(MAX_EXTRA_SESSIONS, hard) } : goal;
  });
  return { plan: { ...state.plan, goals }, progress };
}

/* ---------- Every scheduled score ---------- */

/** What the sessions view needs from a score; keeps it independent of IndexedDB and testable. */
export interface ScheduledScore {
  id: string;
  name: string;
  plan?: PlanState;
}

export interface AgendaEntry {
  score: { id: string; name: string };
  plan: StudyPlan;
  schedule: Schedule;
  session: Session;
}

/** Sort key: timed sessions by the clock, then the ones for "any time". */
const timeOrder = (t: string | null) => t ?? "~";

/** All sessions from all scheduled scores, grouped by day. */
export function agendaByDay(scores: ScheduledScore[]): Map<string, AgendaEntry[]> {
  const byDay = new Map<string, AgendaEntry[]>();
  for (const score of scores) {
    const state = score.plan;
    if (!state?.schedule) continue;
    const { plan, progress } = adjustedPlan(state);
    for (const session of planSessions(plan, state.schedule, progress)) {
      const entry: AgendaEntry = {
        score: { id: score.id, name: score.name },
        plan,
        schedule: state.schedule,
        session,
      };
      const list = byDay.get(session.day);
      if (list) list.push(entry);
      else byDay.set(session.day, [entry]);
    }
  }
  // multiple scores on the same day: keep them in the order they're studied
  // plain comparison, not localeCompare: collation would put the "~" of "any time" before the digits
  for (const list of byDay.values()) list.sort((a, b) => (timeOrder(a.session.time) < timeOrder(b.session.time) ? -1 : timeOrder(a.session.time) > timeOrder(b.session.time) ? 1 : 0));
  return byDay;
}

/** First unstudied session from today on; what the page shows when there's nothing today. */
export function nextSession(byDay: Map<string, AgendaEntry[]>, from = dayKey(new Date())): AgendaEntry | null {
  let best: AgendaEntry | null = null;
  for (const [day, list] of byDay) {
    if (day < from) continue;
    for (const entry of list) {
      if (entry.session.done) continue;
      if (!best || day < best.session.day || (day === best.session.day && timeOrder(entry.session.time) < timeOrder(best.session.time))) best = entry;
    }
  }
  return best;
}

/** Sessions of a week and how many are done: the week's goal is simply to do them all. */
export function weekSummary(byDay: Map<string, AgendaEntry[]>, weekStart: Date): { total: number; done: number } {
  let total = 0;
  let done = 0;
  for (let i = 0; i < 7; i++) {
    for (const e of byDay.get(dayKey(addDays(weekStart, i))) ?? []) {
      total++;
      if (e.session.done) done++;
    }
  }
  return { total, done };
}

/* ---------- The session shown while reading a score ---------- */

export type ScoreSession =
  /** The score isn't scheduled: nothing to show. */
  | null
  /** Every session of the plan is done. */
  | { kind: "done" }
  | {
      kind: "session";
      entry: AgendaEntry;
      /** Today's session, one that was missed, or the next one coming up. */
      when: "today" | "overdue" | "upcoming";
    };

/**
 * The session the reader shows beside the score: today's if there is one,
 * else the earliest still to do — a missed one first, so it's caught up
 * rather than skipped, then the next scheduled.
 */
export function scoreSession(score: ScheduledScore, today = dayKey(new Date())): ScoreSession {
  const state = score.plan;
  if (!state?.schedule) return null;
  const { plan, progress } = adjustedPlan(state);
  const sessions = planSessions(plan, state.schedule, progress);
  const pick = sessions.find((s) => s.day === today) ?? sessions.find((s) => !s.done);
  if (!pick) return { kind: "done" };
  return {
    kind: "session",
    entry: { score: { id: score.id, name: score.name }, plan, schedule: state.schedule, session: pick },
    when: pick.day === today ? "today" : pick.day < today ? "overdue" : "upcoming",
  };
}
